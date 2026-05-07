"""Control Orchestration Engine — Pydantic schemas and enums."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────

class ControlAction(str, Enum):
    """Actions the orchestrator can execute."""
    DEFER = "DEFER"
    OPTIMAL_WINDOW = "OPTIMAL_WINDOW"
    NO_ACTION = "NO_ACTION"
    ROLLBACK = "ROLLBACK"


class ZoneStatus(str, Enum):
    """Zone-level grid status."""
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    CONTROL_ACTIVE = "CONTROL_ACTIVE"


class StationMode(str, Enum):
    """Virtual charging station mode."""
    NORMAL = "NORMAL"
    LIMITED = "LIMITED"
    DELAY = "DELAY"
    OFFLINE = "OFFLINE"


class RiskLevel(str, Enum):
    """Risk severity assessment."""
    LOW = "LOW"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    CRITICAL = "CRITICAL"


# ── Station Schemas ──────────────────────────────────────────────────────

class Station(BaseModel):
    """Virtual EV charging station."""
    station_id: str
    zone_id: str
    name: str
    lat: float
    lon: float
    capacity_kw: float = 50.0
    current_load_kw: float = 0.0
    mode: StationMode = StationMode.NORMAL
    connected_vehicles: int = 0
    uptime_pct: float = 99.5


class StationUpdate(BaseModel):
    """Result of a station mode change."""
    station_id: str
    previous_mode: StationMode
    new_mode: StationMode
    load_before_kw: float
    load_after_kw: float
    load_reduction_kw: float


# ── Simulation Schemas ───────────────────────────────────────────────────

class SimulationResult(BaseModel):
    """Impact simulation output."""
    before_load_kw: float
    after_load_kw: float
    expected_reduction_kw: float
    compliance_rate: float = Field(ge=0.0, le=1.0)
    actual_reduction_kw: float
    peak_reduction_percentage: float
    stress_hours_before: int
    stress_hours_after: int
    stress_hours_prevented: int
    timeline_minutes: int = 15


# ── State Schemas ────────────────────────────────────────────────────────

class ZoneControlState(BaseModel):
    """Zone-level control state snapshot."""
    zone_id: str
    status: ZoneStatus = ZoneStatus.NORMAL
    risk_level: RiskLevel = RiskLevel.LOW
    last_action: Optional[ControlAction] = None
    last_action_at: Optional[datetime] = None
    active_until: Optional[datetime] = None
    reduction_kw: float = 0.0
    peak_load_kw: float = 0.0
    capacity_kw: float = 0.0
    utilization_pct: float = 0.0
    stations_affected: int = 0


# ── Control Log ──────────────────────────────────────────────────────────

class ControlLogEntry(BaseModel):
    """Single entry in the control action log."""
    timestamp: datetime
    zone_id: str
    action: ControlAction
    risk_level: RiskLevel
    impact_kw: float
    stations_affected: int
    detail: str
    operator: str = "AI_ORCHESTRATOR"


# ── Orchestration Request / Response ─────────────────────────────────────

class OrchestrateRequest(BaseModel):
    """Request body for /api/control/orchestrate."""
    zone_id: str = Field(..., description="Target zone, e.g. Z01")


class ExecuteRequest(BaseModel):
    """Request body for /api/control/execute (manual override)."""
    zone_id: str = Field(..., description="Target zone")
    action: ControlAction = Field(..., description="Action to execute")
    reason: str = Field(default="Manual operator override")


class RollbackRequest(BaseModel):
    """Request body for /api/control/rollback."""
    zone_id: str = Field(..., description="Zone to rollback")


class TimelineStep(BaseModel):
    """A step in the orchestration timeline."""
    step: str
    label: str
    status: str = "pending"  # pending | active | complete
    detail: str = ""
    timestamp: Optional[datetime] = None
    duration_ms: int = 0


class OrchestrateResponse(BaseModel):
    """Full response from the orchestrate pipeline."""
    zone_id: str
    risk_level: RiskLevel
    action_taken: ControlAction
    reason: str
    zone_state: ZoneControlState
    simulation: SimulationResult
    stations: List[StationUpdate]
    timeline: List[TimelineStep]
    log_entry: ControlLogEntry
    demo_mode: bool = True
