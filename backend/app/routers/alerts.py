"""Alerts router — grid alert queries and acknowledgement."""

import time
import json
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.utils.db import get_db
from app.models.db_models import GridAlert as GridAlertDB
from app.models.schemas import GridAlert
from app.cache.redis_cache import (
    build_cache_key,
    cache_flush_pattern,
    cache_get_raw,
    cache_set,
    cache_ttl,
)

router = APIRouter()


@router.get("/alerts", response_model=List[GridAlert])
def get_alerts(
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity: CRITICAL, WARNING, INFO",
    ),
    zone_id: Optional[str] = Query(default=None, description="Filter by zone"),
    resolved: bool = Query(default=False, description="Show resolved alerts"),
    limit: int = Query(default=50, ge=1, le=1000, description="Max alerts to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Query grid alerts with optional filters.
    Returns an empty list gracefully when no alerts match.
    """
    start = time.time()
    cache_key = build_cache_key(
        "grid_alerts",
        severity=severity,
        zone_id=zone_id,
        resolved=resolved,
        limit=limit,
        offset=offset,
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

    q = db.query(GridAlertDB)

    if severity:
        q = q.filter(GridAlertDB.severity == severity.upper())
    if zone_id:
        q = q.filter(GridAlertDB.zone_id == zone_id)

    # resolved filter: by default show unresolved; if resolved=True show resolved
    q = q.filter(
        (GridAlertDB.resolved == resolved) | (GridAlertDB.resolved.is_(None))
    ) if not resolved else q.filter(GridAlertDB.resolved == True)

    q = q.order_by(GridAlertDB.triggered_at.desc())
    alerts = q.offset(offset).limit(limit).all()
    payload = [GridAlert.model_validate(alert).model_dump(mode="json") for alert in alerts]
    # Alerts should be quick to refetch, but caching prevents request storms.
    # TTL: 60 seconds.
    cache_set(cache_key, payload, ttl_seconds=60)
    
    content = json.dumps(payload, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Mark an alert as acknowledged."""
    alert = db.query(GridAlertDB).filter(GridAlertDB.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert.acknowledged = True
    db.commit()
    db.expire_all()  # Clear identity map so next query returns fresh data
    
    # Invalidate both alerts list and briefing summary
    cache_flush_pattern("grid_alerts")
    cache_flush_pattern("briefing_today")

    if response is not None:
        response.headers["X-Cache"] = "MISS"

    return {"status": "acknowledged", "alert_id": str(alert_id)}
