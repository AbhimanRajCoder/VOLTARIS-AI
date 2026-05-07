"""Zone Control State Manager — maintains per-zone operational state."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

from app.control.schemas import (
    ControlAction,
    RiskLevel,
    ZoneControlState,
    ZoneStatus,
)

logger = logging.getLogger(__name__)

# Duration control actions remain active (default 30 minutes)
_DEFAULT_CONTROL_DURATION = timedelta(minutes=30)


class StateManager:
    """In-memory state manager for zone control status."""

    def __init__(self) -> None:
        self._states: Dict[str, ZoneControlState] = {}

    def get_state(self, zone_id: str) -> ZoneControlState:
        """Get or initialise the control state for a zone."""
        if zone_id not in self._states:
            self._states[zone_id] = ZoneControlState(zone_id=zone_id)
        return self._states[zone_id]

    def update_state(
        self,
        zone_id: str,
        *,
        action: ControlAction,
        risk_level: RiskLevel,
        reduction_kw: float = 0.0,
        peak_load_kw: float = 0.0,
        capacity_kw: float = 0.0,
        stations_affected: int = 0,
    ) -> ZoneControlState:
        """
        Update zone state after a control action.
        """
        state = self.get_state(zone_id)
        now = datetime.utcnow()

        state.last_action = action
        state.last_action_at = now
        state.risk_level = risk_level
        state.reduction_kw = round(reduction_kw, 1)
        state.peak_load_kw = round(peak_load_kw, 1)
        state.capacity_kw = round(capacity_kw, 1)
        state.stations_affected = stations_affected

        # Utilization
        state.utilization_pct = (
            round((peak_load_kw / capacity_kw) * 100, 1)
            if capacity_kw > 0
            else 0.0
        )

        # Status mapping
        if action == ControlAction.DEFER:
            state.status = ZoneStatus.CONTROL_ACTIVE
            state.active_until = now + _DEFAULT_CONTROL_DURATION
        elif action == ControlAction.OPTIMAL_WINDOW:
            state.status = ZoneStatus.WARNING
            state.active_until = now + _DEFAULT_CONTROL_DURATION
        elif action == ControlAction.ROLLBACK:
            state.status = ZoneStatus.NORMAL
            state.active_until = None
            state.reduction_kw = 0.0
        else:
            # NO_ACTION
            if risk_level in (RiskLevel.SEVERE, RiskLevel.CRITICAL):
                state.status = ZoneStatus.WARNING
            else:
                state.status = ZoneStatus.NORMAL
            state.active_until = None

        logger.info(
            "State updated: %s → status=%s, risk=%s, action=%s, reduction=%.1f kW",
            zone_id,
            state.status.value,
            state.risk_level.value,
            state.last_action.value if state.last_action else "NONE",
            state.reduction_kw,
        )
        return state

    def rollback(self, zone_id: str) -> ZoneControlState:
        """Reset zone state to NORMAL."""
        return self.update_state(
            zone_id,
            action=ControlAction.ROLLBACK,
            risk_level=RiskLevel.LOW,
        )

    def get_all_states(self) -> Dict[str, ZoneControlState]:
        """Return all tracked zone states."""
        return dict(self._states)


# Singleton
state_manager = StateManager()
