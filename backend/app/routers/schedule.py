"""Schedule router — LP-optimised charging and load-curve comparison."""

import time
import json
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, datetime, timedelta
from typing import List
import uuid

from app.utils.db import get_db
from app.models.db_models import (
    ZoneDemandForecast as ZoneDemandForecastDB,
    ChargingRecommendation as ChargingRecDB,
)
from app.models.schemas import (
    ChargingRecommendation,
    ScheduleOptimizeRequest,
)
from app.ml.forecast import forecast_service
from app.ml.optimizer import optimizer_service
from app.cache.redis_cache import (
    CACHE_TTL,
    build_cache_key,
    cache_get,
    cache_get_raw,
    cache_set,
    cache_ttl,
)

router = APIRouter()

# ── Peak / off-peak hour sets ───────────────────────────────────────────
PEAK_HOURS = {18, 19, 20, 21, 22, 23}
OFF_PEAK_HOURS = {0, 1, 2, 3, 4, 5, 6}


def _hourly_averages(db: Session, zone_id: str, target_date: date) -> dict[int, float]:
    """Return {hour: avg_predicted_kw} for a zone on a given date."""
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = start_dt + timedelta(days=1)

    rows = (
        db.query(
            extract("hour", ZoneDemandForecastDB.timestamp).label("hr"),
            func.avg(ZoneDemandForecastDB.predicted_kw).label("avg_kw"),
        )
        .filter(
            ZoneDemandForecastDB.zone_id == zone_id,
            ZoneDemandForecastDB.timestamp >= start_dt,
            ZoneDemandForecastDB.timestamp < end_dt,
        )
        .group_by("hr")
        .all()
    )
    return {int(r.hr): float(r.avg_kw) for r in rows}


def _get_hourly_demand(
    db: Session, zone_id: str, target_date: date
) -> list[float]:
    """
    Get 24 hourly demand values: use DB data if available,
    otherwise use XGBoost forecast.
    """
    hourly = _hourly_averages(db, zone_id, target_date)

    if hourly:
        return [hourly.get(h, 0.0) for h in range(24)]

    # Fall back to XGBoost predictions
    start_dt = datetime.combine(target_date, datetime.min.time())
    timestamps = [start_dt + timedelta(hours=h) for h in range(24)]
    preds = forecast_service.predict(zone_id, timestamps)
    return [p["predicted_kw"] for p in preds]


# ─────────────────────────────────────────────────────────────────────────
# POST /optimize
# ─────────────────────────────────────────────────────────────────────────
@router.post("/optimize", response_model=List[ChargingRecommendation])
def optimize_schedule(
    body: ScheduleOptimizeRequest,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    LP-optimised charging schedule for a zone on a given date.
    Uses PuLP solver with rule-based fallback if infeasible.
    """
    start = time.time()
    cache_key = build_cache_key(
        "schedule_optimize",
        zone_id=body.zone_id,
        date=str(body.target_date),
        capacity_limit_kw=body.capacity_limit_kw,
        user_window_start=body.user_window_start,
        user_window_end=body.user_window_end,
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

    hourly_demand = _get_hourly_demand(db, body.zone_id, body.target_date)

    if all(d == 0.0 for d in hourly_demand):
        raise HTTPException(
            status_code=404,
            detail=f"No forecast data for zone {body.zone_id} on {body.target_date}",
        )

    # Run LP optimiser
    recs_data = optimizer_service.optimize(
        zone_id=body.zone_id,
        target_date=body.target_date,
        hourly_demand=hourly_demand,
        capacity_limit_kw=body.capacity_limit_kw,
        user_window_start=body.user_window_start,
        user_window_end=body.user_window_end,
    )

    # Persist to DB
    db_recs: list[ChargingRecDB] = []
    for r in recs_data:
        rec = ChargingRecDB(
            id=uuid.uuid4(),
            zone_id=r["zone_id"],
            hour_slot=r["hour_slot"],
            action=r["action"],
            grid_load_pct=r["grid_load_pct"],
            optimal_window=r["optimal_window"],
            reason=r["reason"],
            expected_delta_kw=r["expected_delta_kw"],
        )
        db_recs.append(rec)

    db.add_all(db_recs)
    db.commit()
    for rec in db_recs:
        db.refresh(rec)

    payload = [ChargingRecommendation.model_validate(rec).model_dump(mode="json") for rec in db_recs]
    cache_set(cache_key, payload, CACHE_TTL["schedule_optimize"])
    
    content = json.dumps(payload, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )


# ─────────────────────────────────────────────────────────────────────────
# GET /comparison
# ─────────────────────────────────────────────────────────────────────────
@router.get("/comparison")
def get_schedule_comparison(
    zone_id: str = Query(..., description="Zone identifier"),
    target_date: date = Query(..., alias="date", description="Date to compare (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Compare unmanaged vs LP-optimised load curves for a zone on a date.
    """
    start = time.time()
    cache_key = build_cache_key(
        "schedule_comparison",
        zone_id=zone_id,
        date=str(target_date),
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

    hourly_demand = _get_hourly_demand(db, zone_id, target_date)

    if all(d == 0.0 for d in hourly_demand):
        raise HTTPException(
            status_code=404,
            detail=f"No forecast data for zone {zone_id} on {target_date}",
        )

    unmanaged = [
        {"hour": h, "load_kw": round(hourly_demand[h], 2)} for h in range(24)
    ]

    # Use LP optimiser to compute the optimised curve
    # Get capacity from zones table
    from app.models.db_models import Zone as ZoneDB
    zone = db.query(ZoneDB).filter(ZoneDB.zone_id == zone_id).first()
    capacity_kw = zone.transformer_capacity_kw if zone else 1000.0

    recs = optimizer_service.optimize(
        zone_id=zone_id,
        target_date=target_date,
        hourly_demand=hourly_demand,
        capacity_limit_kw=capacity_kw,
    )

    # Build optimised curve — use adjusted_load_kw directly from LP solver
    optimized = []
    for h in range(24):
        rec = recs[h]
        # LP solver returns the exact adjusted load per hour
        opt_load = rec.get("adjusted_load_kw", hourly_demand[h])
        optimized.append({"hour": h, "load_kw": round(max(0, opt_load), 2)})

    peak_unmanaged = max(p["load_kw"] for p in unmanaged)
    peak_optimized = max(p["load_kw"] for p in optimized)
    peak_delta = round(peak_unmanaged - peak_optimized, 2)
    peak_reduction_pct = (
        round((peak_delta / peak_unmanaged) * 100, 2) if peak_unmanaged else 0.0
    )

    result = {
        "zone_id": zone_id,
        "date": str(target_date),
        "unmanaged_curve": unmanaged,
        "optimized_curve": optimized,
        "peak_delta_kw": peak_delta,
        "peak_reduction_pct": peak_reduction_pct,
    }
    cache_set(cache_key, result, CACHE_TTL["schedule_comparison"])
    
    content = json.dumps(result, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )


# ─────────────────────────────────────────────────────────────────────────
# GET /heatmap
# ─────────────────────────────────────────────────────────────────────────
@router.get("/heatmap")
def get_schedule_heatmap(
    target_date: date = Query(..., alias="date", description="Date for heatmap (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Return optimization recommendations for ALL zones for a given date.
    Used to populate the Grid Network Schedule Heatmap.
    """
    start = time.time()
    cache_key = build_cache_key("schedule_heatmap", date=str(target_date))
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

    from app.models.db_models import Zone as ZoneDB
    zones = db.query(ZoneDB).all()
    
    heatmap_data = {}
    for zone in zones:
        # For each zone, get 24h demand
        hourly_demand = _get_hourly_demand(db, zone.zone_id, target_date)
        
        # If no demand, skip or return empty
        if all(d == 0.0 for d in hourly_demand):
            heatmap_data[zone.zone_id] = []
            continue

        # Run LP optimiser (or fetch from cache if we were smarter, 
        # but let's just run it here for simplicity as it's fast enough for 10 zones)
        recs = optimizer_service.optimize(
            zone_id=zone.zone_id,
            target_date=target_date,
            hourly_demand=hourly_demand,
            capacity_limit_kw=zone.transformer_capacity_kw,
        )
        
        # We only need {hour: action} for the heatmap
        # Ensure we have exactly 24 entries
        zone_recs = [{"hour": h, "action": "CHARGE_NOW"} for h in range(24)]
        for r in recs:
            if 0 <= r["hour_slot"] < 24:
                zone_recs[r["hour_slot"]] = {"hour": r["hour_slot"], "action": r["action"]}
        
        heatmap_data[zone.zone_id] = zone_recs

    cache_set(cache_key, heatmap_data, CACHE_TTL["schedule_optimize"])
    
    content = json.dumps(heatmap_data, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )
