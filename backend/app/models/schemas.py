"""Pydantic v2 schemas — response models, request bodies, and enums."""

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List
from uuid import UUID


class ActionEnum(str, Enum):
    CHARGE_NOW = "CHARGE_NOW"
    DEFER = "DEFER"
    OPTIMAL_WINDOW = "OPTIMAL_WINDOW"


class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Response Models ──────────────────────────────────────────────────────

class ZoneDemandForecast(BaseSchema):
    id: UUID
    zone_id: str
    timestamp: datetime
    predicted_kw: float
    ev_share_pct: float
    confidence_lo: float
    confidence_hi: float
    model_version: str
    created_at: datetime


class ChargingRecommendation(BaseSchema):
    id: UUID
    zone_id: str
    hour_slot: int
    action: ActionEnum
    grid_load_pct: float
    optimal_window: Optional[str] = None
    reason: str
    expected_delta_kw: float
    created_at: datetime


class InfraSiteCandidate(BaseSchema):
    site_id: str
    lat: float
    lon: float
    ward_name: str
    demand_score: float
    gap_score: float
    transformer_score: float
    access_score: float
    composite_rank: int
    composite_score: float
    nearest_transformer_id: str
    existing_chargers_500m: int


class GridAlert(BaseSchema):
    alert_id: UUID
    zone_id: str
    severity: SeverityEnum
    triggered_at: datetime
    message: str
    recommended_action: Optional[str] = None
    acknowledged: Optional[bool] = False
    resolved: Optional[bool] = False


# ── Request Models ───────────────────────────────────────────────────────

class ScheduleOptimizeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    zone_id: str = Field(..., description="Target zone for optimisation, e.g. Z01")
    target_date: date = Field(..., alias="date", description="Date to optimise (YYYY-MM-DD)")
    capacity_limit_kw: float = Field(..., gt=0, description="Transformer capacity limit in kW")
    user_window_start: int = Field(default=18, ge=0, le=23, description="User preferred start hour")
    user_window_end: int = Field(default=22, ge=0, le=23, description="User preferred end hour")


class SimulateDataRequest(BaseModel):
    zone_id: str
    scenario: str = Field(..., description="Scenario name like 'heavy_load' or 'peak_summer'")
