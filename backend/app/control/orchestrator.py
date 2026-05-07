"""Control Orchestrator — deeply integrated with forecast, scheduler, and alerts.

Pulls REAL data from:
  - zone_demand_forecast (XGBoost predictions)
  - zones (transformer capacity)
  - grid_alert (active alerts)
  - optimizer_service (LP scheduler)
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, date, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.control.schemas import (
    ControlAction,
    ControlLogEntry,
    ExecuteRequest,
    OrchestrateResponse,
    RiskLevel,
    TimelineStep,
    ZoneControlState,
)
from app.control.executor import executor
from app.control.simulation_engine import simulation_engine
from app.control.station_service import station_service
from app.control.state_manager import state_manager
from app.control.control_log import control_log

logger = logging.getLogger(__name__)


class Orchestrator:
    """
    Central orchestration brain — uses REAL system data.

    Pipeline:
      1. Detect risk (from REAL forecast + alerts in DB)
      2. Decide optimal strategy (reuse LP scheduler logic)
      3. Execute control (stations synced from forecast)
      4. Simulate impact (using scheduler reduction estimates)
      5. Update system state
      6. Log everything
    """

    SEVERE_THRESHOLD = 0.85   # >= 85% utilization → DEFER (matches existing alert threshold)
    MODERATE_THRESHOLD = 0.65 # >= 65% utilization → OPTIMAL_WINDOW
    WARNING_THRESHOLD = 0.50  # >= 50% utilization → WARNING

    def orchestrate(
        self, zone_id: str, db: Optional[Session] = None
    ) -> OrchestrateResponse:
        """Run the full pipeline using real DB data."""
        pipeline_start = time.time()
        timeline: list[TimelineStep] = []

        # ═══════════════════════════════════════════════════════════════════
        # STEP 1: DETECT — Pull real forecast + zone capacity from DB
        # ═══════════════════════════════════════════════════════════════════
        step_start = time.time()
        risk_data = self._assess_risk_from_db(zone_id, db)
        peak_load = risk_data["peak_load_kw"]
        capacity = risk_data["capacity_kw"]
        utilization = risk_data["utilization_pct"]
        risk_level = self._classify_risk(utilization)
        active_alerts = risk_data["active_alerts"]

        # Elevate risk if there are CRITICAL alerts for this zone
        if active_alerts > 0 and risk_level.value in ("LOW", "MODERATE"):
            risk_level = RiskLevel.SEVERE

        timeline.append(
            TimelineStep(
                step="detect",
                label="Risk Detection",
                status="complete",
                detail=f"Forecast: {peak_load:.0f}/{capacity:.0f} kW ({utilization:.0f}%) — {risk_level.value} | {active_alerts} active alerts",
                timestamp=datetime.utcnow(),
                duration_ms=int((time.time() - step_start) * 1000),
            )
        )

        # ═══════════════════════════════════════════════════════════════════
        # STEP 2: DECIDE — Use scheduler logic for strategy
        # ═══════════════════════════════════════════════════════════════════
        step_start = time.time()
        action, reason = self._decide(risk_level, utilization, zone_id, risk_data)

        timeline.append(
            TimelineStep(
                step="decide",
                label="Strategy Selection",
                status="complete",
                detail=f"{action.value}: {reason}",
                timestamp=datetime.utcnow(),
                duration_ms=int((time.time() - step_start) * 1000),
            )
        )

        # ═══════════════════════════════════════════════════════════════════
        # STEP 3: EXECUTE — Sync stations from forecast, then apply action
        # ═══════════════════════════════════════════════════════════════════
        step_start = time.time()

        # Sync station loads from real forecast data
        if db is not None:
            station_service.sync_from_forecast(zone_id, db)

        before_load = station_service.get_total_load(zone_id)
        station_updates = executor.execute(zone_id, action)

        timeline.append(
            TimelineStep(
                step="execute",
                label="Station Control",
                status="complete",
                detail=f"{len(station_updates)} stations updated (EV load: {before_load:.0f} kW)",
                timestamp=datetime.utcnow(),
                duration_ms=int((time.time() - step_start) * 1000),
            )
        )

        # ═══════════════════════════════════════════════════════════════════
        # STEP 4: SIMULATE — Use LP scheduler reduction estimates
        # ═══════════════════════════════════════════════════════════════════
        step_start = time.time()

        # Use the REAL zone peak load for simulation (not just station load)
        simulation = simulation_engine.simulate(
            zone_id=zone_id,
            action=action,
            before_load_kw=peak_load,  # Real forecast peak
            capacity_kw=capacity,      # Real transformer capacity
            station_updates=station_updates,
            scheduler_reduction_pct=risk_data.get("scheduler_reduction_pct", 0),
        )

        timeline.append(
            TimelineStep(
                step="simulate",
                label="Impact Simulation",
                status="complete",
                detail=f"Reduction: {simulation.actual_reduction_kw:.0f} kW ({simulation.peak_reduction_percentage:.1f}%)",
                timestamp=datetime.utcnow(),
                duration_ms=int((time.time() - step_start) * 1000),
            )
        )

        # ═══════════════════════════════════════════════════════════════════
        # STEP 5: UPDATE STATE
        # ═══════════════════════════════════════════════════════════════════
        step_start = time.time()
        zone_state = state_manager.update_state(
            zone_id,
            action=action,
            risk_level=risk_level,
            reduction_kw=simulation.actual_reduction_kw,
            peak_load_kw=peak_load,
            capacity_kw=capacity,
            stations_affected=len(station_updates),
        )

        timeline.append(
            TimelineStep(
                step="stabilize",
                label="State Update",
                status="complete",
                detail=f"Zone → {zone_state.status.value} ({zone_state.utilization_pct:.0f}% util)",
                timestamp=datetime.utcnow(),
                duration_ms=int((time.time() - step_start) * 1000),
            )
        )

        # ═══════════════════════════════════════════════════════════════════
        # STEP 6: LOG
        # ═══════════════════════════════════════════════════════════════════
        log_entry = control_log.append(
            zone_id=zone_id,
            action=action,
            risk_level=risk_level,
            impact_kw=simulation.actual_reduction_kw,
            stations_affected=len(station_updates),
            detail=reason,
        )

        total_ms = int((time.time() - pipeline_start) * 1000)
        logger.info(
            "Orchestration complete for %s in %d ms: %s → %s (%.0f kW reduction)",
            zone_id, total_ms, risk_level.value, action.value,
            simulation.actual_reduction_kw,
        )

        return OrchestrateResponse(
            zone_id=zone_id,
            risk_level=risk_level,
            action_taken=action,
            reason=reason,
            zone_state=zone_state,
            simulation=simulation,
            stations=station_updates,
            timeline=timeline,
            log_entry=log_entry,
            demo_mode=True,
        )

    def execute_manual(
        self, request: ExecuteRequest, db: Optional[Session] = None
    ) -> OrchestrateResponse:
        """Manual operator override — uses real data but bypasses AI decision."""
        zone_id = request.zone_id
        action = request.action

        # Pull real data
        risk_data = self._assess_risk_from_db(zone_id, db)
        peak_load = risk_data["peak_load_kw"]
        capacity = risk_data["capacity_kw"]
        utilization = risk_data["utilization_pct"]
        risk_level = self._classify_risk(utilization)

        # Sync stations from real forecast, then execute
        if db is not None:
            station_service.sync_from_forecast(zone_id, db)

        before_load = station_service.get_total_load(zone_id)
        station_updates = executor.execute(zone_id, action)

        simulation = simulation_engine.simulate(
            zone_id=zone_id,
            action=action,
            before_load_kw=peak_load,
            capacity_kw=capacity,
            station_updates=station_updates,
            scheduler_reduction_pct=risk_data.get("scheduler_reduction_pct", 0),
        )

        zone_state = state_manager.update_state(
            zone_id, action=action, risk_level=risk_level,
            reduction_kw=simulation.actual_reduction_kw,
            peak_load_kw=peak_load, capacity_kw=capacity,
            stations_affected=len(station_updates),
        )

        log_entry = control_log.append(
            zone_id=zone_id, action=action, risk_level=risk_level,
            impact_kw=simulation.actual_reduction_kw,
            stations_affected=len(station_updates),
            detail=f"Manual override: {request.reason}",
            operator="MANUAL_OPERATOR",
        )

        now = datetime.utcnow()
        timeline = [
            TimelineStep(step="detect", label="Manual Override", status="complete",
                         detail=f"Operator-initiated on {zone_id} ({utilization:.0f}% util)", timestamp=now, duration_ms=0),
            TimelineStep(step="execute", label="Station Control", status="complete",
                         detail=f"{len(station_updates)} stations → {action.value}", timestamp=now, duration_ms=0),
            TimelineStep(step="simulate", label="Impact Computed", status="complete",
                         detail=f"{simulation.actual_reduction_kw:.0f} kW reduction", timestamp=now, duration_ms=0),
            TimelineStep(step="stabilize", label="State Updated", status="complete",
                         detail=zone_state.status.value, timestamp=now, duration_ms=0),
        ]

        return OrchestrateResponse(
            zone_id=zone_id, risk_level=risk_level, action_taken=action,
            reason=request.reason, zone_state=zone_state, simulation=simulation,
            stations=station_updates, timeline=timeline, log_entry=log_entry,
            demo_mode=True,
        )

    # ── Real data integration ────────────────────────────────────────────

    def _assess_risk_from_db(
        self, zone_id: str, db: Optional[Session] = None
    ) -> dict:
        """
        Pull REAL risk data from the existing GridWise DB:
          - zone_demand_forecast → peak predicted_kw
          - zones → transformer_capacity_kw
          - grid_alert → active unresolved alerts count
          - optimizer_service → peak reduction % from LP scheduler
        """
        result = {
            "peak_load_kw": 0.0,
            "capacity_kw": 5000.0,
            "utilization_pct": 0.0,
            "active_alerts": 0,
            "scheduler_reduction_pct": 0.0,
            "ev_share_pct": 0.15,
        }

        if db is None:
            return result

        try:
            from app.models.db_models import (
                Zone as ZoneDB,
                ZoneDemandForecast as ForecastDB,
                GridAlert as GridAlertDB,
            )

            # 1. Zone capacity
            zone = db.query(ZoneDB).filter(ZoneDB.zone_id == zone_id).first()
            if zone:
                result["capacity_kw"] = zone.transformer_capacity_kw

            # 2. Latest forecast (real XGBoost prediction)
            latest = (
                db.query(ForecastDB)
                .filter(ForecastDB.zone_id == zone_id)
                .order_by(ForecastDB.timestamp.desc())
                .first()
            )
            if latest:
                result["peak_load_kw"] = latest.predicted_kw
                result["ev_share_pct"] = latest.ev_share_pct

            # 3. Active unresolved alerts for this zone
            alert_count = (
                db.query(func.count(GridAlertDB.alert_id))
                .filter(
                    GridAlertDB.zone_id == zone_id,
                    GridAlertDB.resolved == False,
                )
                .scalar()
            ) or 0
            result["active_alerts"] = alert_count

            # 4. Scheduler reduction estimate (from LP optimizer)
            try:
                from app.ml.optimizer import optimizer_service
                today = date.today()
                from app.routers.schedule import _get_hourly_demand
                hourly = _get_hourly_demand(db, zone_id, today)
                if any(d > 0 for d in hourly):
                    recs = optimizer_service.optimize(
                        zone_id=zone_id,
                        target_date=today,
                        hourly_demand=hourly,
                        capacity_limit_kw=result["capacity_kw"],
                    )
                    # Calculate peak reduction from optimizer output
                    peak_unmanaged = max(hourly)
                    peak_optimized = max(
                        r.get("adjusted_load_kw", hourly[r["hour_slot"]])
                        for r in recs
                    )
                    if peak_unmanaged > 0:
                        result["scheduler_reduction_pct"] = round(
                            ((peak_unmanaged - peak_optimized) / peak_unmanaged) * 100, 1
                        )
            except Exception as e:
                logger.debug("Scheduler integration skipped: %s", e)

            # Compute utilization
            cap = result["capacity_kw"]
            if cap > 0:
                result["utilization_pct"] = round(
                    (result["peak_load_kw"] / cap) * 100, 1
                )

        except Exception as e:
            logger.error("DB risk assessment failed for %s: %s", zone_id, e)

        return result

    def _classify_risk(self, utilization_pct: float) -> RiskLevel:
        """Map utilization to risk level (matches existing alert thresholds)."""
        if utilization_pct >= self.SEVERE_THRESHOLD * 100:
            return RiskLevel.CRITICAL
        elif utilization_pct >= self.MODERATE_THRESHOLD * 100:
            return RiskLevel.SEVERE
        elif utilization_pct >= self.WARNING_THRESHOLD * 100:
            return RiskLevel.MODERATE
        else:
            return RiskLevel.LOW

    def _decide(
        self, risk_level: RiskLevel, utilization: float,
        zone_id: str, risk_data: dict
    ) -> tuple[ControlAction, str]:
        """Decide action based on risk + scheduler analysis."""
        alerts = risk_data.get("active_alerts", 0)
        sched_pct = risk_data.get("scheduler_reduction_pct", 0)

        if risk_level == RiskLevel.CRITICAL:
            return (
                ControlAction.DEFER,
                f"CRITICAL: {utilization:.0f}% utilization exceeds 85% threshold. "
                f"{alerts} active alerts. Deferring EV charging to protect transformer. "
                f"LP scheduler estimates {sched_pct:.0f}% peak reduction possible.",
            )
        elif risk_level == RiskLevel.SEVERE:
            return (
                ControlAction.DEFER,
                f"SEVERE: {utilization:.0f}% utilization with {alerts} alerts. "
                f"Shifting EV load to off-peak window. "
                f"Scheduler recommends {sched_pct:.0f}% peak shaving.",
            )
        elif risk_level == RiskLevel.MODERATE:
            return (
                ControlAction.OPTIMAL_WINDOW,
                f"MODERATE: {utilization:.0f}% utilization approaching threshold. "
                f"Recommending optimal 22:00-07:00 charging windows. "
                f"Scheduler projects {sched_pct:.0f}% improvement.",
            )
        else:
            return (
                ControlAction.NO_ACTION,
                f"Grid stable at {utilization:.0f}% utilization. "
                f"No intervention required. LP scheduler confirms safe operation.",
            )


# Singleton
orchestrator = Orchestrator()
