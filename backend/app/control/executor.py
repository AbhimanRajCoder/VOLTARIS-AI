"""Control Executor — applies control actions to the station network."""

from __future__ import annotations

import logging
from typing import List

from app.control.schemas import (
    ControlAction,
    StationUpdate,
)
from app.control.station_service import station_service

logger = logging.getLogger(__name__)


class Executor:
    """
    Applies control directives to the virtual station fleet.

    In production this would send OCPP 2.0 SetChargingProfile
    commands to real charge point management systems. The current
    implementation operates against the in-memory station service
    for demonstration purposes.
    """

    def execute(
        self, zone_id: str, action: ControlAction
    ) -> List[StationUpdate]:
        """
        Execute a control action on all stations in a zone.

        Parameters
        ----------
        zone_id : str
            Target zone identifier.
        action : ControlAction
            The action to apply.

        Returns
        -------
        List[StationUpdate]
            Per-station change report.
        """
        logger.info("Executing %s on zone %s …", action.value, zone_id)
        updates = station_service.apply_action(zone_id, action)
        total_reduction = sum(u.load_reduction_kw for u in updates)
        logger.info(
            "Execution complete: %d stations, total reduction=%.1f kW",
            len(updates),
            total_reduction,
        )
        return updates

    def rollback(self, zone_id: str) -> List[StationUpdate]:
        """Restore all stations in a zone to NORMAL."""
        logger.info("Rolling back zone %s to NORMAL …", zone_id)
        return station_service.rollback(zone_id)


# Singleton
executor = Executor()
