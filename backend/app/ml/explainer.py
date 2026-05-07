"""SHAP explainability wrapper for the XGBoost forecast model."""

import math
import logging
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import shap
import redis

from app.config import get_settings
from app.ml.forecast import forecast_service, _engineer_features

logger = logging.getLogger(__name__)
settings = get_settings()

FEATURE_LABELS = {
    "hour": "hour",
    "day_of_week": "day_of_week",
    "month": "month",
    "is_weekend": "is_weekend",
    "is_peak_hour": "is_peak_hour",
    "zone_id_encoded": "zone_id_encoded",
    "hour_sin": "hour_sin",
    "hour_cos": "hour_cos",
}


class ExplainerService:
    """SHAP TreeExplainer wrapper with optional Redis caching."""

    def __init__(self):
        self._explainer: Optional[shap.TreeExplainer] = None
        self._redis: Optional[redis.Redis] = None
        self._init_redis()

    def _init_redis(self):
        try:
            self._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
            self._redis.ping()
            logger.info("SHAP cache: Redis connected")
        except Exception:
            self._redis = None
            logger.info("SHAP cache: Redis unavailable — computing without cache")

    def _get_explainer(self) -> shap.TreeExplainer:
        if self._explainer is None:
            forecast_service.load_models()
            self._explainer = shap.TreeExplainer(forecast_service._model)
        return self._explainer

    def _cache_key(self, zone_id: str, ts: datetime) -> str:
        # Round to the hour
        rounded = ts.replace(minute=0, second=0, microsecond=0)
        return f"shap:{zone_id}:{rounded.isoformat()}"

    def explain(self, zone_id: str, timestamp: datetime) -> dict:
        """Return SHAP feature attribution for a single prediction."""
        # Check cache
        key = self._cache_key(zone_id, timestamp)
        if self._redis:
            try:
                import json
                cached = self._redis.get(key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        # Build features
        forecast_service.load_models()
        df = pd.DataFrame({
            "timestamp": [timestamp],
            "zone_id": [zone_id],
        })
        X = _engineer_features(df, forecast_service._encoder)

        # SHAP
        explainer = self._get_explainer()
        sv = explainer.shap_values(X)

        # sv may be a 2D array; we need row 0
        shap_row = sv[0] if isinstance(sv, np.ndarray) and sv.ndim == 2 else sv
        if isinstance(shap_row, np.ndarray):
            shap_row = shap_row.flatten()

        feature_names = list(FEATURE_LABELS.keys())
        shap_dict = {
            feature_names[i]: round(float(shap_row[i]), 4)
            for i in range(len(feature_names))
        }

        # Find top feature
        top_idx = int(np.argmax(np.abs(shap_row)))
        top_feature = feature_names[top_idx]
        top_val = float(shap_row[top_idx])

        # Prediction
        pred = forecast_service._model.predict(X)[0]

        # Human-readable explanation
        direction = "increasing" if top_val > 0 else "decreasing"
        explanation = (
            f"{top_feature} is the strongest driver, "
            f"{direction} the prediction by {abs(top_val):.1f} kW"
        )

        result = {
            "zone_id": zone_id,
            "timestamp": timestamp.isoformat(),
            "predicted_kw": round(float(pred), 2),
            "base_value": round(float(explainer.expected_value), 2),
            "shap_values": shap_dict,
            "top_feature": top_feature,
            "explanation": explanation,
        }

        # Cache in Redis
        if self._redis:
            try:
                import json
                self._redis.setex(key, 300, json.dumps(result))
            except Exception:
                pass

        return result


# Singleton
explainer_service = ExplainerService()
