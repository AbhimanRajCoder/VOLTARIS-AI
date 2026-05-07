"""Shared Soft-Deflect business logic for router and background tasks."""

from __future__ import annotations

import logging
import os
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db_models import DeflectionEvent, Zone, ZoneDemandForecast

logger = logging.getLogger(__name__)

_ALERT_COOLDOWN_SECONDS = 30 * 60
_EVAL_DELAY = timedelta(minutes=45)
_zone_alert_cooldown: dict[str, datetime] = {}


def now_utc() -> datetime:
    """Return timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def congestion_translate(load_ratio: float) -> tuple[float, str]:
    """Translate normalized load ratio to routing penalty + status."""
    if load_ratio < 0.65:
        return 0.0, "GREEN"
    if load_ratio <= 0.85:
        return 0.4, "AMBER"
    return 0.95, "CRITICAL"


def _next_off_peak_window(reference: datetime) -> datetime:
    """Return next 11 PM UTC window for temporal deflection messaging."""
    target = reference.replace(hour=23, minute=0, second=0, microsecond=0)
    if target <= reference:
        target = target + timedelta(days=1)
    return target


def _rwa_ids_for_zone(zone_id: str) -> list[str]:
    """Generate deterministic mock RWA IDs per zone for demo payloads."""
    seed = sum(ord(c) for c in zone_id)
    rng = random.Random(seed)
    return [f"RWA_{rng.randint(100, 999)}", f"RWA_{rng.randint(100, 999)}"]


def _latest_zone_forecast_rows(db: Session) -> list[tuple[ZoneDemandForecast, Zone]]:
    """Fetch latest forecast row for each zone along with zone metadata."""
    latest_subquery = (
        db.query(
            ZoneDemandForecast.zone_id.label("zone_id"),
            func.max(ZoneDemandForecast.timestamp).label("latest_ts"),
        )
        .group_by(ZoneDemandForecast.zone_id)
        .subquery()
    )

    rows = (
        db.query(ZoneDemandForecast, Zone)
        .join(
            latest_subquery,
            (ZoneDemandForecast.zone_id == latest_subquery.c.zone_id)
            & (ZoneDemandForecast.timestamp == latest_subquery.c.latest_ts),
        )
        .join(Zone, Zone.zone_id == ZoneDemandForecast.zone_id)
        .all()
    )
    return rows


def build_routing_layer(db: Session) -> list[dict[str, Any]]:
    """Build latest Soft-Deflect routing layer across all zones."""
    latest = _latest_zone_forecast_rows(db)
    if not latest:
        return []

    zone_loads: list[tuple[str, float, Zone]] = []
    for forecast, zone in latest:
        cap = zone.transformer_capacity_kw or 1.0
        load_ratio = max(0.0, min(1.5, forecast.predicted_kw / cap))
        zone_loads.append((forecast.zone_id, load_ratio, zone))

    lowest_zone = min(zone_loads, key=lambda item: item[1])[0] if zone_loads else None

    layer: list[dict[str, Any]] = []
    for zone_id, load_ratio, _zone in zone_loads:
        penalty, status = congestion_translate(load_ratio)
        layer.append(
            {
                "zone_id": zone_id,
                "status": status,
                "routing_penalty": penalty,
                "user_facing_message": (
                    "Grid Congestion: Charging speeds may be throttled. "
                    "Consider alternative locations."
                ),
                "recommended_alternative_zone": (
                    lowest_zone if status == "CRITICAL" and lowest_zone != zone_id else None
                ),
            }
        )
    return layer


def zone_is_on_cooldown(zone_id: str, at_time: datetime | None = None) -> bool:
    """Return True if zone alert was recently fired and still cooling down."""
    ts = _zone_alert_cooldown.get(zone_id)
    if not ts:
        return False
    check_time = at_time or now_utc()
    return (check_time - ts).total_seconds() < _ALERT_COOLDOWN_SECONDS


def mark_zone_alert_fired(zone_id: str, at_time: datetime | None = None) -> None:
    """Record latest alert fire time for cooldown enforcement."""
    _zone_alert_cooldown[zone_id] = at_time or now_utc()


def build_community_alert_payloads(db: Session, zone_id: str | None = None) -> list[dict[str, Any]]:
    """Build one payload per zone above the 85% threshold."""
    latest = _latest_zone_forecast_rows(db)
    results: list[dict[str, Any]] = []
    now = now_utc()

    for forecast, zone in latest:
        if zone_id and forecast.zone_id != zone_id:
            continue
        cap = zone.transformer_capacity_kw or 1.0
        load_pct = (forecast.predicted_kw / cap) * 100.0
        if load_pct <= 85.0:
            continue

        resume_at = _next_off_peak_window(now)
        ward = zone.zone_name
        payload = {
            "event_id": f"evt_{uuid.uuid4()}",
            "zone_id": zone.zone_id,
            "target_ward": ward,
            "affected_rwa_ids": _rwa_ids_for_zone(zone.zone_id),
            "grid_load_pct": round(load_pct, 1),
            "action_required": "DEFER_EV_CHARGING",
            "optimal_resume_time": resume_at.isoformat().replace("+00:00", "Z"),
            "partner_push_template": {
                "title": "⚠️ Urgent: BESCOM Grid Stress",
                "body": (
                    f"{ward} grid is at {load_pct:.1f}% capacity. "
                    f"Please schedule EV charging after {resume_at.strftime('%I:%M %p')} tonight."
                ),
            },
            "predicted_peak_kw": forecast.predicted_kw,
        }
        results.append(payload)

    return results


async def fire_partner_webhook(payload: dict[str, Any]) -> None:
    """Fire payload to configured partner endpoint or print in mock mode."""
    webhook_url = os.getenv("MYGATE_WEBHOOK_URL", "").strip()
    if not webhook_url:
        logger.info("Soft-Deflect mock mode payload: %s", payload)
        return

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(webhook_url, json=payload)
    except Exception as exc:  # pragma: no cover - external network boundary
        logger.error("Soft-Deflect webhook delivery failed: %s", exc)


def record_deflection_event_fired(
    db: Session,
    *,
    zone_id: str,
    fired_at: datetime,
    predicted_kw: float,
) -> DeflectionEvent:
    """Insert a pending deflection event row at fire time."""
    row = DeflectionEvent(
        zone_id=zone_id,
        fired_at=fired_at.replace(tzinfo=None),
        predicted_kw=predicted_kw,
        actual_kw=None,
        deflected_kw=None,
        status="PENDING_EVAL",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _resolve_actual_metered_kw(db: Session, zone_id: str) -> float:
    """Approximate latest metered load from forecast stream for demo environments."""
    latest = (
        db.query(ZoneDemandForecast)
        .filter(ZoneDemandForecast.zone_id == zone_id)
        .order_by(ZoneDemandForecast.timestamp.desc())
        .first()
    )
    if not latest:
        return 0.0
    # Simulate real-world deviation from predicted value for impact estimates.
    return round(max(0.0, latest.predicted_kw * random.uniform(0.72, 0.96)), 2)


def compute_matured_deflection_events(db: Session) -> int:
    """Compute deflection deltas for events that have reached 45-minute maturity."""
    mature_before = (now_utc() - _EVAL_DELAY).replace(tzinfo=None)
    pending = (
        db.query(DeflectionEvent)
        .filter(DeflectionEvent.status == "PENDING_EVAL", DeflectionEvent.fired_at <= mature_before)
        .all()
    )
    updates = 0
    for row in pending:
        actual_kw = _resolve_actual_metered_kw(db, row.zone_id)
        row.actual_kw = actual_kw
        row.deflected_kw = round(max(0.0, (row.predicted_kw or 0.0) - actual_kw), 2)
        row.status = "COMPUTED"
        updates += 1

    if updates:
        db.commit()
    return updates

