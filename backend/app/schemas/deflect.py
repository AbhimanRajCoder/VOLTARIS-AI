"""Soft-Deflect request/response schemas with OpenAPI examples."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ZoneDeflectInfo(BaseModel):
    zone_id: str = Field(example="Z01")
    status: Literal["GREEN", "AMBER", "CRITICAL"] = Field(example="CRITICAL")
    routing_penalty: float = Field(example=0.95)
    user_facing_message: str = Field(
        example=(
            "Grid Congestion: Charging speeds may be throttled. "
            "Consider alternative locations."
        )
    )
    recommended_alternative_zone: str | None = Field(example="Z02", default=None)


class DeflectRoutingResponse(BaseModel):
    timestamp: datetime = Field(example="2026-05-06T10:30:00Z")
    deflect_layer: list[ZoneDeflectInfo] = Field(
        example=[
            {
                "zone_id": "Z01",
                "status": "CRITICAL",
                "routing_penalty": 0.95,
                "user_facing_message": (
                    "Grid Congestion: Charging speeds may be throttled. "
                    "Consider alternative locations."
                ),
                "recommended_alternative_zone": "Z02",
            }
        ]
    )


class CommunityAlertRequest(BaseModel):
    zone_id: str | None = Field(
        default=None,
        example="Z01",
        description="Optional zone identifier. If omitted, all zones are evaluated.",
    )


class PushTemplate(BaseModel):
    title: str = Field(example="⚠️ Urgent: BESCOM Grid Stress")
    body: str = Field(
        example=(
            "Whitefield grid is at 92.5% capacity. "
            "Please schedule EV charging after 11:00 PM tonight."
        )
    )


class CommunityAlertResponse(BaseModel):
    event_id: str = Field(example="evt_123e4567-e89b-12d3-a456-426614174000")
    target_ward: str = Field(example="Whitefield")
    affected_rwa_ids: list[str] = Field(example=["RWA_402", "RWA_891"])
    grid_load_pct: float = Field(example=92.5)
    action_required: Literal["DEFER_EV_CHARGING"] = Field(example="DEFER_EV_CHARGING")
    optimal_resume_time: datetime = Field(example="2026-05-06T23:00:00Z")
    partner_push_template: PushTemplate


class DeflectionEventRecord(BaseModel):
    id: str = Field(example="6be2e9a5-8c40-4fc7-9fe9-8fbe3d4bfe66")
    zone_id: str = Field(example="Z01")
    fired_at: datetime = Field(example="2026-05-06T09:45:00Z")
    predicted_kw: float = Field(example=612.0)
    actual_kw: float | None = Field(example=487.0, default=None)
    deflected_kw: float | None = Field(example=125.0, default=None)
    status: str = Field(example="COMPUTED")


class ImpactSummaryResponse(BaseModel):
    total_deflected_kw_today: int = Field(example=412)
    events_fired_today: int = Field(example=5)
    blackouts_prevented: int = Field(example=3)
    events: list[DeflectionEventRecord]


class PartnerInfo(BaseModel):
    name: str = Field(example="Ola Maps API")
    status: Literal["healthy", "degraded", "offline"] = Field(example="healthy")
    latency_ms: int = Field(example=42)
    last_ping: datetime | None = Field(example="2026-05-06T10:30:00Z", default=None)


class PartnerStatusResponse(BaseModel):
    partners: list[PartnerInfo]

