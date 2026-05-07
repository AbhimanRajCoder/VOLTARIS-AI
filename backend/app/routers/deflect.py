"""Soft-Deflect API router for routing penalties, partner alerts, and impact reporting."""

from __future__ import annotations

import random
from datetime import UTC, datetime, time, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.models.db_models import DeflectionEvent
from app.schemas.deflect import (
    CommunityAlertRequest,
    CommunityAlertResponse,
    DeflectionEventRecord,
    DeflectRoutingResponse,
    ImpactSummaryResponse,
    PartnerInfo,
    PartnerStatusResponse,
)
from app.services.deflect import (
    build_community_alert_payloads,
    build_routing_layer,
    fire_partner_webhook,
    mark_zone_alert_fired,
    now_utc,
    record_deflection_event_fired,
)
from app.utils.db import get_db

router = APIRouter()

_ROUTING_CACHE: dict[str, Any] = {"expires_at": None, "payload": None}
_ROUTING_CACHE_TTL_SECONDS = 30


def _docs_error_responses() -> dict[int, dict[str, str]]:
    return {
        400: {"description": "Bad request"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    }


@router.get(
    "/routing",
    response_model=DeflectRoutingResponse,
    tags=["Soft-Deflect"],
    responses={200: {"description": "Deflect routing layer response"}, **_docs_error_responses()},
)
def get_deflect_routing(
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Return the latest Soft-Deflect routing layer for all zones.

    This endpoint maps each zone's current load ratio to a congestion status and
    routing penalty so partner maps can de-prioritize routes into stressed zones.
    For CRITICAL zones, it suggests the current lowest-load alternative zone.
    """
    now = now_utc()
    if (
        _ROUTING_CACHE["payload"] is not None
        and _ROUTING_CACHE["expires_at"] is not None
        and now < _ROUTING_CACHE["expires_at"]
    ):
        payload = _ROUTING_CACHE["payload"]
    else:
        payload = {
            "timestamp": now.isoformat().replace("+00:00", "Z"),
            "deflect_layer": build_routing_layer(db),
        }
        _ROUTING_CACHE["payload"] = payload
        _ROUTING_CACHE["expires_at"] = now + timedelta(seconds=_ROUTING_CACHE_TTL_SECONDS)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return payload


@router.post(
    "/community-alert",
    response_model=CommunityAlertResponse,
    tags=["Soft-Deflect"],
    responses={200: {"description": "Community alert fired"}, **_docs_error_responses()},
)
async def post_community_alert(
    request: CommunityAlertRequest,
    db: Session = Depends(get_db),
):
    """
    Fire a community deflection alert for one zone or all zones above 85% load.

    If `zone_id` is omitted, all latest zones are scanned and the highest-load
    candidate is fired. Payloads are forwarded to MyGate webhook when configured,
    otherwise logged in mock mode. The generated payload is always returned.
    """
    candidates = build_community_alert_payloads(db, request.zone_id)
    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No zones above 85% load for community alert",
        )

    payload = max(candidates, key=lambda item: item["grid_load_pct"])
    await fire_partner_webhook(payload)

    fired_at = now_utc()
    record_deflection_event_fired(
        db,
        zone_id=payload["zone_id"],
        fired_at=fired_at,
        predicted_kw=payload["predicted_peak_kw"],
    )
    mark_zone_alert_fired(payload["zone_id"], fired_at)

    return {
        "event_id": payload["event_id"],
        "target_ward": payload["target_ward"],
        "affected_rwa_ids": payload["affected_rwa_ids"],
        "grid_load_pct": payload["grid_load_pct"],
        "action_required": payload["action_required"],
        "optimal_resume_time": payload["optimal_resume_time"],
        "partner_push_template": payload["partner_push_template"],
    }


@router.get(
    "/impact-summary",
    response_model=ImpactSummaryResponse,
    tags=["Soft-Deflect"],
    responses={200: {"description": "Soft-Deflect impact summary"}, **_docs_error_responses()},
)
def get_impact_summary(db: Session = Depends(get_db)):
    """
    Return today's Soft-Deflect impact summary and event records.

    Includes total kW deflected, total events fired, and a coarse estimate of
    blackouts prevented based on high-impact computed events.
    """
    now = now_utc()
    start = datetime.combine(now.date(), time(0, 0), tzinfo=UTC).replace(tzinfo=None)
    end = datetime.combine(now.date(), time(23, 59, 59), tzinfo=UTC).replace(tzinfo=None)

    events = (
        db.query(DeflectionEvent)
        .filter(DeflectionEvent.fired_at >= start, DeflectionEvent.fired_at <= end)
        .order_by(DeflectionEvent.fired_at.desc())
        .all()
    )

    total_deflected = int(sum((row.deflected_kw or 0.0) for row in events))
    events_fired = len(events)
    blackouts_prevented = sum(
        1
        for row in events
        if row.status == "COMPUTED" and (row.deflected_kw or 0.0) >= 80.0
    )

    rows = [
        DeflectionEventRecord(
            id=str(row.id),
            zone_id=row.zone_id,
            fired_at=row.fired_at.replace(tzinfo=UTC),
            predicted_kw=row.predicted_kw,
            actual_kw=row.actual_kw,
            deflected_kw=row.deflected_kw,
            status=row.status,
        )
        for row in events
    ]

    return {
        "total_deflected_kw_today": total_deflected,
        "events_fired_today": events_fired,
        "blackouts_prevented": blackouts_prevented,
        "events": rows,
    }


@router.get(
    "/partner-status",
    response_model=PartnerStatusResponse,
    tags=["Soft-Deflect"],
    responses={200: {"description": "Partner integration health"}, **_docs_error_responses()},
)
def get_partner_status():
    """
    Return synthetic live health for external Soft-Deflect integration partners.

    Latencies are randomized on each call to mimic real-time partner health
    telemetry for demos and operator dashboards.
    """
    now = now_utc().isoformat().replace("+00:00", "Z")
    base = [
        ("Ola Maps API", 42),
        ("MyGate Webhook", 87),
        ("MapMyIndia API", 55),
        ("NoBrokerHood Webhook", 61),
    ]
    partners = []
    for name, baseline in base:
        latency = max(20, baseline + random.randint(-12, 14))
        partners.append(
            PartnerInfo(
                name=name,
                status="healthy",
                latency_ms=latency,
                last_ping=now if name == "Ola Maps API" else None,
            )
        )

    return {"partners": partners}
