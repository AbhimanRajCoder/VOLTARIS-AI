"""Forecast router — XGBoost demand predictions and SHAP explainability."""

import time
import json
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List

from app.utils.db import get_db
from app.models.db_models import ZoneDemandForecast as ZoneDemandForecastDB
from app.models.schemas import ZoneDemandForecast
from app.ml.forecast import forecast_service
from app.ml.explainer import explainer_service
from app.cache.redis_cache import (
    CACHE_TTL,
    build_cache_key,
    cache_get,
    cache_get_raw,
    cache_set,
    cache_ttl,
)

router = APIRouter()


@router.get("/zones")
def list_zones(db: Session = Depends(get_db)):
    """Return list of all grid zones and their capacities."""
    from app.models.db_models import Zone as ZoneDB
    zones = db.query(ZoneDB).order_by(ZoneDB.zone_id.asc()).all()
    return [{
        "zone_id": z.zone_id,
        "zone_name": z.zone_name,
        "capacity_kw": z.transformer_capacity_kw
    } for z in zones]


@router.get("/summary")
def get_grid_summary(db: Session = Depends(get_db), response: Response = None):
    """Return latest load telemetry for all zones."""
    start = time.time()
    cache_key = build_cache_key("forecast_summary")
    cached = cache_get_raw(cache_key)
    if cached is not None:
        ttl = cache_ttl(cache_key)
        return Response(
            content=cached,
            media_type="application/json",
            headers={
                "X-Cache": "HIT",
                "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms"
            }
        )

    from app.models.db_models import Zone as ZoneDB, ZoneDemandForecast as ZoneDemandForecastDB
    
    # Get latest timestamp in DB
    latest_ts = db.query(func.max(ZoneDemandForecastDB.timestamp)).scalar()
    if not latest_ts:
        return []

    # Get latest record for each zone
    results = (
        db.query(ZoneDemandForecastDB)
        .filter(ZoneDemandForecastDB.timestamp == latest_ts)
        .all()
    )
    
    # Also get capacities
    zones = db.query(ZoneDB).all()
    capacity_map = {z.zone_id: z.transformer_capacity_kw for z in zones}
    
    payload = [{
        "zone_id": r.zone_id,
        "load_kw": r.predicted_kw,
        "capacity_kw": capacity_map.get(r.zone_id, 5000),
        "ev_share_pct": r.ev_share_pct,
        "timestamp": r.timestamp
    } for r in results]
    
    cache_set(cache_key, payload, CACHE_TTL.get("forecast_demand", 300))
    if response is not None:
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"
    return payload


def _floor_to_15min(ts: datetime) -> datetime:
    """Round down timestamp to 15-minute boundary for stable cache keys."""
    return ts.replace(minute=(ts.minute // 15) * 15, second=0, microsecond=0)


@router.get("/demand", response_model=List[ZoneDemandForecast])
def get_demand_forecast(
    zone_id: str = Query(..., description="Zone identifier, e.g. Z01"),
    start_ts: datetime = Query(
        default=None,
        description="Start of time range (default: 7 days ago)",
    ),
    end_ts: datetime = Query(
        default=None,
        description="End of time range (default: now)",
    ),
    interval: str = Query(
        default="15min",
        description="Time interval granularity (placeholder — ignored in Phase 2)",
    ),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Return demand forecast data for a zone within a time range.
    Serves historical data from DB, and uses XGBoost for future timestamps.
    """
    start = time.time()
    user_provided_range = start_ts is not None or end_ts is not None
    
    # Normalize inputs to naive UTC to avoid comparison errors with DB timestamps
    if start_ts and start_ts.tzinfo:
        start_ts = start_ts.replace(tzinfo=None)
    if end_ts and end_ts.tzinfo:
        end_ts = end_ts.replace(tzinfo=None)
    
    # ── Fast path: check cache BEFORE any DB queries ────────────────────
    # For default (no user range), build a stable cache key using the
    # current 15-min boundary so repeated calls within a window share a key.
    if not user_provided_range:
        now_floor = _floor_to_15min(datetime.utcnow())
        default_start = now_floor - timedelta(days=2)
        early_cache_key = build_cache_key(
            "forecast_demand",
            zone_id=zone_id,
            start_ts=str(default_start),
            end_ts="__default__",
            interval=interval,
        )
        cached = cache_get_raw(early_cache_key)
        if cached is not None:
            ttl = cache_ttl(early_cache_key)
            return Response(
                content=cached,
                media_type="application/json",
                headers={
                    "X-Cache": "HIT",
                    "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                    "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
                },
            )
    else:
        # User-provided range: we can build cache key immediately
        # Normalize boundaries to 15-min intervals for stable cache keys
        norm_start = _floor_to_15min(start_ts) if start_ts else start_ts
        norm_end = _floor_to_15min(end_ts) if end_ts else end_ts
        cache_key = build_cache_key(
            "forecast_demand",
            zone_id=zone_id,
            start_ts=str(norm_start),
            end_ts=str(norm_end),
            interval=interval,
        )
        cached = cache_get_raw(cache_key)
        if cached is not None:
            ttl = cache_ttl(cache_key)
            return Response(
                content=cached,
                media_type="application/json",
                headers={
                    "X-Cache": "HIT",
                    "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                    "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
                },
            )

    # ── Cache MISS — query DB ───────────────────────────────────────────
    last_ts_in_db = (
        db.query(func.max(ZoneDemandForecastDB.timestamp))
        .filter(ZoneDemandForecastDB.zone_id == zone_id)
        .scalar()
    )

    if end_ts is None:
        # Default to latest DB data if available, else utcnow
        end_ts = last_ts_in_db if last_ts_in_db else _floor_to_15min(datetime.utcnow())
    
    if start_ts is None:
        start_ts = end_ts - timedelta(days=2) # Default to 2 days instead of 7 for tighter view
    else:
        start_ts = _floor_to_15min(start_ts)
    
    if not user_provided_range:
        # Keep default rolling window cacheable by using normalized boundaries.
        start_ts = _floor_to_15min(start_ts)

    # Build the final cache key for storing MISS results
    if not user_provided_range:
        now_floor = _floor_to_15min(datetime.utcnow())
        default_start = now_floor - timedelta(days=2)
        store_cache_key = build_cache_key(
            "forecast_demand",
            zone_id=zone_id,
            start_ts=str(default_start),
            end_ts="__default__",
            interval=interval,
        )
    else:
        norm_start = _floor_to_15min(start_ts) if start_ts else start_ts
        norm_end = _floor_to_15min(end_ts) if end_ts else end_ts
        store_cache_key = build_cache_key(
            "forecast_demand",
            zone_id=zone_id,
            start_ts=str(norm_start),
            end_ts=str(norm_end),
            interval=interval,
        )

    # Historical data from DB
    rows = (
        db.query(ZoneDemandForecastDB)
        .filter(
            ZoneDemandForecastDB.zone_id == zone_id,
            ZoneDemandForecastDB.timestamp >= start_ts,
            ZoneDemandForecastDB.timestamp <= end_ts,
        )
        .order_by(ZoneDemandForecastDB.timestamp.asc())
        .all()
    )

    # Check if requested range extends beyond baseline
    baseline_ts = last_ts_in_db if last_ts_in_db else _floor_to_15min(datetime.utcnow())
    
    if end_ts > baseline_ts:
        # Generate future predictions with XGBoost
        future_start = max(start_ts, baseline_ts + (timedelta(minutes=15) if last_ts_in_db else timedelta(0)))
        future_timestamps = []
        current = _floor_to_15min(future_start)
        while current <= end_ts:
            future_timestamps.append(current)
            current += timedelta(minutes=15)

        if future_timestamps:
            preds = forecast_service.predict(zone_id, future_timestamps)
            # Convert to ORM-like objects for consistent serialization
            import uuid
            for ts, pred in zip(future_timestamps, preds):
                rows.append(
                    ZoneDemandForecastDB(
                        id=uuid.uuid4(),
                        zone_id=zone_id,
                        timestamp=ts,
                        predicted_kw=pred["predicted_kw"],
                        ev_share_pct=15.0 + (ts.hour / 24.0) * 10.0,  # mock EV share (15-25%) for future predictions
                        confidence_lo=pred["confidence_lo"],
                        confidence_hi=pred["confidence_hi"],
                        model_version=pred["model_version"],
                        created_at=datetime.utcnow(),
                    )
                )

    payload = [ZoneDemandForecast.model_validate(row).model_dump(mode="json") for row in rows]
    cache_set(store_cache_key, payload, CACHE_TTL["forecast_demand"])
    
    # Return directly as Response to ensure consistency with cache HITs
    # and bypass Pydantic double-validation/serialization overhead on return
    content = json.dumps(payload, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )


@router.get("/explain")
def get_forecast_explanation(
    zone_id: str = Query(..., description="Zone identifier"),
    timestamp: datetime = Query(..., description="Prediction timestamp to explain"),
    response: Response = None,
):
    """
    Return SHAP feature attribution for a specific prediction.
    Uses real TreeExplainer on the trained XGBoost model.
    """
    start = time.time()
    if timestamp and timestamp.tzinfo:
        timestamp = timestamp.replace(tzinfo=None)
        
    cache_key = build_cache_key(
        "forecast_explain",
        zone_id=zone_id,
        timestamp=str(timestamp),
    )
    cached = cache_get_raw(cache_key)
    if cached is not None:
        ttl = cache_ttl(cache_key)
        return Response(
            content=cached,
            media_type="application/json",
            headers={
                "X-Cache": "HIT",
                "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
            },
        )

    result = explainer_service.explain(zone_id, timestamp)
    cache_set(cache_key, result, CACHE_TTL["forecast_explain"])
    
    content = json.dumps(result, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )
