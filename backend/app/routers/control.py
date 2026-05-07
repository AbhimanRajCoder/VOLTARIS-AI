"""Control router — fully integrated with existing forecast, scheduler, and alert systems."""

import time
import logging
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.utils.db import get_db
from app.control.schemas import (
    ExecuteRequest,
    OrchestrateRequest,
    RollbackRequest,
)
from app.control.orchestrator import orchestrator
from app.control.station_service import station_service
from app.control.state_manager import state_manager
from app.control.control_log import control_log

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/orchestrate")
def run_orchestration(
    body: OrchestrateRequest,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Run full Control Orchestration Engine pipeline.
    Uses real forecast data, zone capacity, active alerts, and LP scheduler.
    """
    start = time.time()
    result = orchestrator.orchestrate(body.zone_id, db)

    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"
        response.headers["X-COE-Action"] = result.action_taken.value
        response.headers["X-COE-Risk"] = result.risk_level.value

    return result.model_dump(mode="json")


@router.post("/execute")
def execute_manual(
    body: ExecuteRequest,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Manual operator control — uses real data, bypasses AI decision."""
    start = time.time()
    result = orchestrator.execute_manual(body, db)

    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"

    return result.model_dump(mode="json")


@router.get("/state")
def get_zone_state(
    zone_id: str = Query(..., description="Zone identifier, e.g. Z01"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Return current control state for a zone, enriched with live forecast data."""
    start = time.time()
    state = state_manager.get_state(zone_id)

    # Enrich with latest forecast data if state hasn't been populated yet
    if state.capacity_kw == 0 and db is not None:
        try:
            from app.models.db_models import Zone as ZoneDB, ZoneDemandForecast as ForecastDB
            zone = db.query(ZoneDB).filter(ZoneDB.zone_id == zone_id).first()
            if zone:
                state.capacity_kw = zone.transformer_capacity_kw
            latest = (
                db.query(ForecastDB)
                .filter(ForecastDB.zone_id == zone_id)
                .order_by(ForecastDB.timestamp.desc())
                .first()
            )
            if latest:
                state.peak_load_kw = latest.predicted_kw
                state.utilization_pct = round(
                    (latest.predicted_kw / state.capacity_kw * 100)
                    if state.capacity_kw > 0 else 0, 1
                )
        except Exception:
            pass

    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"

    return state.model_dump(mode="json")


@router.get("/state/all")
def get_all_states(response: Response = None):
    """Return control states for all tracked zones."""
    start = time.time()
    states = state_manager.get_all_states()
    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"
    return {k: v.model_dump(mode="json") for k, v in states.items()}


@router.get("/stations")
def get_stations(
    zone_id: str = Query(..., description="Zone identifier, e.g. Z01"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Return stations for a zone, synced with latest forecast data."""
    start = time.time()

    # Sync from real forecast before returning
    station_service.sync_from_forecast(zone_id, db)
    stations = station_service.get_stations(zone_id)

    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"

    return [s.model_dump(mode="json") for s in stations]


@router.post("/rollback")
def rollback_zone(
    body: RollbackRequest,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Rollback a zone to NORMAL state, re-sync stations from forecast."""
    start = time.time()

    from app.control.executor import executor as exec_instance
    station_updates = exec_instance.rollback(body.zone_id)

    # Re-sync from forecast to restore real loads
    station_service.sync_from_forecast(body.zone_id, db)

    zone_state = state_manager.rollback(body.zone_id)

    from app.control.schemas import ControlAction, RiskLevel
    log_entry = control_log.append(
        zone_id=body.zone_id,
        action=ControlAction.ROLLBACK,
        risk_level=RiskLevel.LOW,
        impact_kw=0.0,
        stations_affected=len(station_updates),
        detail="Zone rolled back to NORMAL by operator",
        operator="MANUAL_OPERATOR",
    )

    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"

    return {
        "status": "rolled_back",
        "zone_id": body.zone_id,
        "zone_state": zone_state.model_dump(mode="json"),
        "stations_restored": len(station_updates),
        "log_entry": log_entry.model_dump(mode="json"),
    }


@router.get("/log")
def get_control_log(
    zone_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    response: Response = None,
):
    """Return recent control action log entries."""
    start = time.time()
    entries = control_log.get_entries(zone_id=zone_id, limit=limit)
    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"
    return [e.model_dump(mode="json") for e in entries]


@router.get("/log/summary")
def get_log_summary(response: Response = None):
    """Return summary statistics for the control log."""
    start = time.time()
    summary = control_log.get_summary()
    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"
    return summary
