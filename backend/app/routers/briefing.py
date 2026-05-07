"""Briefing router — daily summary and zone status briefings."""

import time
import json
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List

from app.utils.db import get_db
from app.models.db_models import (
    Zone as ZoneDB,
    ZoneDemandForecast as ZoneDemandForecastDB,
    GridAlert as GridAlertDB,
)
from app.cache.redis_cache import (
    CACHE_TTL,
    build_cache_key,
    cache_get,
    cache_get_raw,
    cache_set,
    cache_ttl,
)

router = APIRouter()


@router.get("/today")
def get_daily_briefing(db: Session = Depends(get_db), response: Response = None):
    """
    Return a comprehensive system summary for the dashboard.
    Includes system-wide KPIs, alert counts, and per-zone status.
    """
    start = time.time()
    # Cache varies per calendar day so we don't serve yesterday's summary.
    # Keep the key deterministic with only primitive values.
    cache_key = build_cache_key("briefing_today", date=str(date.today()))
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

    # 1. Get latest demand data for all zones (closest to now)
    now = datetime.utcnow()
    latest_ts = (
        db.query(func.max(ZoneDemandForecastDB.timestamp))
        .filter(ZoneDemandForecastDB.timestamp <= now)
        .scalar()
    )
    if not latest_ts:
        # Fallback to absolute latest if no historical data
        latest_ts = db.query(func.max(ZoneDemandForecastDB.timestamp)).scalar()
    
    if not latest_ts:
        return {
            "system_summary": {"overall_status": "UNKNOWN", "peak_hour": 0, "timestamp": datetime.utcnow().isoformat()},
            "alerts_summary": {"critical": 0, "warning": 0, "info": 0},
            "zone_briefings": [],
            "top_actions": []
        }

    latest_demand = (
        db.query(ZoneDemandForecastDB)
        .filter(ZoneDemandForecastDB.timestamp == latest_ts)
        .all()
    )

    peak_loads = (
        db.query(ZoneDemandForecastDB.zone_id, func.max(ZoneDemandForecastDB.predicted_kw).label("peak"))
        .group_by(ZoneDemandForecastDB.zone_id)
        .all()
    )
    peak_map = {p.zone_id: p.peak for p in peak_loads}

    # 2. Get zone capacities
    zones = db.query(ZoneDB).all()
    capacity_map = {z.zone_id: {
        "name": z.zone_name,
        "capacity": z.transformer_capacity_kw
    } for z in zones}

    # 3. Get alerts summary (unresolved)
    alerts = db.query(GridAlertDB).filter(GridAlertDB.resolved == False).all()
    critical_count = sum(1 for a in alerts if a.severity == "CRITICAL")
    warning_count = sum(1 for a in alerts if a.severity == "WARNING")
    info_count = sum(1 for a in alerts if a.severity == "INFO")

    # 4. Build zone briefings
    zone_briefings = []
    for d in latest_demand:
        cap_info = capacity_map.get(d.zone_id, {"name": d.zone_id, "capacity": 5000})
        load_kw = d.predicted_kw
        capacity_kw = cap_info["capacity"]
        utilization = load_kw / capacity_kw if capacity_kw > 0 else 0
        
        status = "NORMAL"
        if utilization > 0.9 or d.zone_id in [a.zone_id for a in alerts if a.severity == "CRITICAL"]:
            status = "CRITICAL"
        elif utilization > 0.75 or d.zone_id in [a.zone_id for a in alerts if a.severity == "WARNING"]:
            status = "WARNING"

        zone_briefings.append({
            "zone_id": d.zone_id,
            "zone_name": cap_info["name"],
            "load_kw": round(load_kw, 2),
            "peak_load_kw": round(peak_map.get(d.zone_id, load_kw), 2),
            "capacity_kw": capacity_kw,
            "ev_share_pct": round(d.ev_share_pct, 4),
            "status": status,
            "timestamp": d.timestamp.isoformat()
        })

    # Sort by zone_id
    zone_briefings.sort(key=lambda x: x["zone_id"])

    # 5. System summary
    overall_status = "NORMAL"
    if critical_count > 0:
        overall_status = "CRITICAL"
    elif warning_count > 0:
        overall_status = "WARNING"

    payload = {
        "system_summary": {
            "overall_status": overall_status,
            "peak_hour": latest_ts.hour,
            "timestamp": latest_ts.isoformat()
        },
        "alerts_summary": {
            "critical": critical_count,
            "warning": warning_count,
            "info": info_count
        },
        "zone_briefings": zone_briefings,
        "top_actions": [
            {"zone_id": b["zone_id"], "action_type": "DEFER" if b["status"] == "CRITICAL" else "OPTIMAL_WINDOW", "reason": "High demand" if b["status"] != "NORMAL" else "Optimisation"}
            for b in zone_briefings if b["status"] != "NORMAL"
        ][:3]
    }

    # Cache the full response for 10 minutes to avoid repeated expensive work.
    cache_set(cache_key, payload, ttl_seconds=600)
    
    content = json.dumps(payload, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )
