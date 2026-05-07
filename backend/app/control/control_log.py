"""Control Action Log — append-only audit trail for orchestration events."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List

from app.control.schemas import (
    ControlAction,
    ControlLogEntry,
    RiskLevel,
)

logger = logging.getLogger(__name__)


class ControlLog:
    """
    In-memory, append-only control action log.

    In production this would write to PostgreSQL / TimescaleDB.
    The in-memory store is sufficient for demo and hackathon use.
    """

    def __init__(self) -> None:
        self._entries: List[ControlLogEntry] = []

    def append(
        self,
        zone_id: str,
        action: ControlAction,
        risk_level: RiskLevel,
        impact_kw: float,
        stations_affected: int,
        detail: str,
        operator: str = "AI_ORCHESTRATOR",
    ) -> ControlLogEntry:
        """Record a new control event."""
        entry = ControlLogEntry(
            timestamp=datetime.utcnow(),
            zone_id=zone_id,
            action=action,
            risk_level=risk_level,
            impact_kw=round(impact_kw, 1),
            stations_affected=stations_affected,
            detail=detail,
            operator=operator,
        )
        self._entries.append(entry)
        logger.info(
            "ControlLog [%s] %s → %s (impact=%.1f kW, stations=%d)",
            zone_id,
            action.value,
            detail,
            impact_kw,
            stations_affected,
        )
        return entry

    def get_entries(
        self,
        zone_id: str | None = None,
        limit: int = 50,
    ) -> List[ControlLogEntry]:
        """Return recent log entries, optionally filtered by zone."""
        entries = self._entries
        if zone_id:
            entries = [e for e in entries if e.zone_id == zone_id]
        return list(reversed(entries[-limit:]))

    def get_summary(self) -> Dict:
        """Quick stats for the log."""
        return {
            "total_entries": len(self._entries),
            "actions": {
                action.value: sum(
                    1 for e in self._entries if e.action == action
                )
                for action in ControlAction
            },
            "zones_acted": list(set(e.zone_id for e in self._entries)),
        }


# Singleton
control_log = ControlLog()
