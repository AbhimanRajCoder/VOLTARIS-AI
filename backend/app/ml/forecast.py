"""XGBoost demand forecasting — train + inference with quantile confidence."""

import os
import math
import logging
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
from sqlalchemy import text

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

FEATURE_NAMES = [
    "hour", "day_of_week", "month", "is_weekend",
    "is_peak_hour", "zone_id_encoded", "hour_sin", "hour_cos",
]


def _engineer_features(df: pd.DataFrame, encoder: LabelEncoder) -> pd.DataFrame:
    """Build ML features from a DataFrame with 'timestamp' and 'zone_id' columns."""
    ts = pd.to_datetime(df["timestamp"])
    out = pd.DataFrame()
    out["hour"] = ts.dt.hour
    out["day_of_week"] = ts.dt.dayofweek
    out["month"] = ts.dt.month
    out["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)
    out["is_peak_hour"] = ts.dt.hour.between(18, 23).astype(int)
    out["zone_id_encoded"] = encoder.transform(df["zone_id"])
    out["hour_sin"] = np.sin(2 * math.pi * out["hour"] / 24)
    out["hour_cos"] = np.cos(2 * math.pi * out["hour"] / 24)
    return out


class ForecastService:
    """Singleton XGBoost forecasting service with quantile confidence."""

    def __init__(self):
        self._model: Optional[XGBRegressor] = None
        self._model_lo: Optional[XGBRegressor] = None
        self._model_hi: Optional[XGBRegressor] = None
        self._encoder: Optional[LabelEncoder] = None
        self._loaded = False

    # ── persistence helpers ──────────────────────────────────────────────
    def _model_path(self, name: str) -> str:
        return os.path.join(settings.MODEL_DIR, name)

    def _models_exist(self) -> bool:
        return all(
            os.path.isfile(self._model_path(f))
            for f in [
                "forecast_model.pkl",
                "forecast_model_lo.pkl",
                "forecast_model_hi.pkl",
                "zone_encoder.pkl",
            ]
        )

    # ── data loading ──────────────────────────────────────────────────────
    def _load_training_data(self) -> pd.DataFrame:
        """Load training data from DB; fall back to synthetic data if unavailable."""
        try:
            from app.utils.db import engine
            df = pd.read_sql(
                "SELECT zone_id, timestamp, predicted_kw "
                "FROM zone_demand_forecast ORDER BY timestamp",
                engine,
            )
            if len(df) >= 100:
                return df
            logger.warning("DB returned %d rows — too few; using synthetic fallback", len(df))
        except Exception as exc:
            logger.warning("DB unavailable for training (%s); using synthetic data", exc)

        # Synthetic fallback — 10 000 hourly rows across 5 zones
        rng = np.random.default_rng(42)
        zones = ["Z01", "Z02", "Z03", "Z04", "Z05"]
        base = pd.Timestamp("2024-01-01")
        timestamps = pd.date_range(base, periods=2000, freq="h")
        records = []
        for zone in zones:
            for ts in timestamps:
                hour = ts.hour
                base_kw = 300 + 200 * np.sin(2 * math.pi * hour / 24)
                noise = rng.normal(0, 20)
                records.append({"zone_id": zone, "timestamp": ts, "predicted_kw": max(50, base_kw + noise)})
        return pd.DataFrame(records)

    # ── load ─────────────────────────────────────────────────────────────
    def load_models(self):
        if self._loaded:
            return
        if not self._models_exist():
            logger.warning("Models not found — training from scratch …")
            self.train()
        self._model = joblib.load(self._model_path("forecast_model.pkl"))
        self._model_lo = joblib.load(self._model_path("forecast_model_lo.pkl"))
        self._model_hi = joblib.load(self._model_path("forecast_model_hi.pkl"))
        self._encoder = joblib.load(self._model_path("zone_encoder.pkl"))
        self._loaded = True
        logger.info("Forecast models loaded (version %s)", settings.MODEL_VERSION)

    # ── train ────────────────────────────────────────────────────────────
    def train(self) -> dict:
        """Train 3 XGBoost models and persist to MODEL_DIR."""
        logger.info("Loading training data from database …")
        df = self._load_training_data()
        logger.info("Loaded %d rows", len(df))

        # Encode zones
        encoder = LabelEncoder()
        encoder.fit(df["zone_id"])

        X = _engineer_features(df, encoder)
        y = df["predicted_kw"].values

        # time-based 80/20 split
        split = int(len(df) * 0.8)
        X_train, X_test = X.iloc[:split], X.iloc[split:]
        y_train, y_test = y[:split], y[split:]

        # ── main model ───────────────────────────────────────────────────
        model = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
        )
        model.fit(X_train, y_train)

        # ── quantile models ──────────────────────────────────────────────
        model_lo = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            objective="reg:quantileerror",
            quantile_alpha=0.05,
        )
        model_lo.fit(X_train, y_train)

        model_hi = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            objective="reg:quantileerror",
            quantile_alpha=0.95,
        )
        model_hi.fit(X_train, y_train)

        # ── evaluate ─────────────────────────────────────────────────────
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = math.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        metrics = {
            "mae_kw": round(mae, 2),
            "rmse_kw": round(rmse, 2),
            "r2": round(r2, 4),
            "train_rows": len(X_train),
            "test_rows": len(X_test),
        }

        logger.info(
            "MAE: %.2f kW | RMSE: %.2f kW | R²: %.4f | test=%d rows",
            mae, rmse, r2, len(X_test),
        )

        # ── save ─────────────────────────────────────────────────────────
        os.makedirs(settings.MODEL_DIR, exist_ok=True)
        joblib.dump(model, self._model_path("forecast_model.pkl"))
        joblib.dump(model_lo, self._model_path("forecast_model_lo.pkl"))
        joblib.dump(model_hi, self._model_path("forecast_model_hi.pkl"))
        joblib.dump(encoder, self._model_path("zone_encoder.pkl"))
        logger.info("Models saved to %s", settings.MODEL_DIR)

        # Update in-memory refs
        self._model, self._model_lo, self._model_hi = model, model_lo, model_hi
        self._encoder = encoder
        self._loaded = True

        return metrics

    # ── inference ─────────────────────────────────────────────────────────
    def predict(self, zone_id: str, timestamps: list[datetime]) -> list[dict]:
        """Generate demand predictions for a zone at given timestamps."""
        self.load_models()

        df = pd.DataFrame({
            "timestamp": timestamps,
            "zone_id": [zone_id] * len(timestamps),
        })
        X = _engineer_features(df, self._encoder)

        preds = self._model.predict(X)
        lo = self._model_lo.predict(X)
        hi = self._model_hi.predict(X)

        results = []
        for i, ts in enumerate(timestamps):
            results.append({
                "predicted_kw": round(float(preds[i]), 2),
                "confidence_lo": round(float(lo[i]), 2),
                "confidence_hi": round(float(hi[i]), 2),
                "model_version": settings.MODEL_VERSION,
            })
        return results

    def get_feature_names(self) -> list[str]:
        return FEATURE_NAMES.copy()


# Singleton
forecast_service = ForecastService()
