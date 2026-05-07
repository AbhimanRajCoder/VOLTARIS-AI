"""Virtual Charging Station Network — loads derived from real zone forecast data."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.control.schemas import (
    ControlAction,
    Station,
    StationMode,
    StationUpdate,
)

logger = logging.getLogger(__name__)

# ── Bangalore ward-level station seeds (real coordinates) ────────────────
_STATION_SEEDS: Dict[str, List[dict]] = {
    "Z01": [
        {"name": "Koramangala Hub-A", "lat": 12.9352, "lon": 77.6245},
        {"name": "Koramangala Hub-B", "lat": 12.9340, "lon": 77.6280},
        {"name": "Indiranagar DC-1",  "lat": 12.9784, "lon": 77.6408},
    ],
    "Z02": [
        {"name": "Whitefield Plaza",    "lat": 12.9698, "lon": 77.7500},
        {"name": "ITPL Gateway",        "lat": 12.9857, "lon": 77.7320},
        {"name": "Marathahalli Jn",     "lat": 12.9591, "lon": 77.7010},
    ],
    "Z03": [
        {"name": "Jayanagar 4th Block", "lat": 12.9250, "lon": 77.5830},
        {"name": "JP Nagar Phase-2",    "lat": 12.9075, "lon": 77.5850},
        {"name": "BTM Layout DC",       "lat": 12.9166, "lon": 77.6101},
    ],
    "Z04": [
        {"name": "Rajajinagar Hub",     "lat": 12.9900, "lon": 77.5550},
        {"name": "Malleshwaram EV",     "lat": 13.0035, "lon": 77.5690},
        {"name": "Yeshwanthpur DC",     "lat": 13.0200, "lon": 77.5500},
    ],
    "Z05": [
        {"name": "Electronic City P1",  "lat": 12.8440, "lon": 77.6600},
        {"name": "Electronic City P2",  "lat": 12.8510, "lon": 77.6700},
        {"name": "Bommasandra Hub",     "lat": 12.8200, "lon": 77.6950},
    ],
    "Z06": [
        {"name": "Hebbal Flyover EV",   "lat": 13.0358, "lon": 77.5970},
        {"name": "Yelahanka Base",      "lat": 13.1007, "lon": 77.5960},
        {"name": "Thanisandra DC",      "lat": 13.0555, "lon": 77.6340},
    ],
    "Z07": [
        {"name": "HSR Layout Hub",      "lat": 12.9116, "lon": 77.6474},
        {"name": "Bellandur EV",        "lat": 12.9260, "lon": 77.6760},
        {"name": "Sarjapur Road DC",    "lat": 12.9100, "lon": 77.6900},
    ],
    "Z08": [
        {"name": "Banashankari DC",     "lat": 12.9255, "lon": 77.5468},
        {"name": "Kanakapura Rd",       "lat": 12.8920, "lon": 77.5600},
        {"name": "RR Nagar Hub",        "lat": 12.9380, "lon": 77.5200},
    ],
    "Z09": [
        {"name": "MG Road Metro EV",    "lat": 12.9756, "lon": 77.6068},
        {"name": "Brigade Road DC",     "lat": 12.9716, "lon": 77.6077},
        {"name": "Cubbon Park Hub",     "lat": 12.9763, "lon": 77.5929},
    ],
    "Z10": [
        {"name": "Peenya Industrial",   "lat": 13.0290, "lon": 77.5190},
        {"name": "Dasarahalli EV",      "lat": 13.0450, "lon": 77.5130},
        {"name": "Nagasandra DC",       "lat": 13.0390, "lon": 77.5080},
    ],
}

# Realistic station capacities per zone (kW per station)
_STATION_CAPACITIES = [50.0, 120.0, 60.0]


class StationService:
    """
    Manages a virtual fleet of charging stations per zone.

    Station loads are derived from REAL zone forecast data from the DB,
    distributed proportionally across stations based on capacity share.
    """

    def __init__(self) -> None:
        self._stations: Dict[str, List[Station]] = {}
        self._initialised = False

    def _ensure_init(self) -> None:
        """Build station objects with default loads (will be synced from DB)."""
        if self._initialised:
            return
        for zone_id, seeds in _STATION_SEEDS.items():
            stations = []
            for idx, seed in enumerate(seeds):
                cap = _STATION_CAPACITIES[idx % len(_STATION_CAPACITIES)]
                stations.append(
                    Station(
                        station_id=f"{zone_id}-ST{idx + 1:02d}",
                        zone_id=zone_id,
                        name=seed["name"],
                        lat=seed["lat"],
                        lon=seed["lon"],
                        capacity_kw=cap,
                        current_load_kw=0.0,  # Will be set from forecast
                        mode=StationMode.NORMAL,
                        connected_vehicles=0,
                        uptime_pct=99.5,
                    )
                )
            self._stations[zone_id] = stations
        self._initialised = True
        logger.info("StationService initialised with %d zones", len(self._stations))

    def sync_from_forecast(self, zone_id: str, db: Session) -> None:
        """
        Sync station loads from the REAL zone_demand_forecast table.

        EV charging stations represent ev_share_pct of the zone's total load.
        Load is distributed proportionally across stations by capacity.
        """
        self._ensure_init()
        stations = self._stations.get(zone_id, [])
        if not stations:
            return

        try:
            from app.models.db_models import (
                ZoneDemandForecast as ForecastDB,
                Zone as ZoneDB,
            )

            # Get latest forecast for this zone
            latest = (
                db.query(ForecastDB)
                .filter(ForecastDB.zone_id == zone_id)
                .order_by(ForecastDB.timestamp.desc())
                .first()
            )
            if not latest:
                return

            # EV charging load = total predicted × ev_share_pct
            ev_load_kw = latest.predicted_kw * latest.ev_share_pct
            total_capacity = sum(s.capacity_kw for s in stations)

            # Distribute proportionally
            for st in stations:
                share = st.capacity_kw / total_capacity if total_capacity > 0 else 1.0 / len(stations)
                st.current_load_kw = round(ev_load_kw * share, 1)
                # Connected vehicles: roughly 1 EV per 7 kW average draw
                st.connected_vehicles = max(1, int(st.current_load_kw / 7))

            logger.info(
                "Synced %s stations from forecast: total_ev_load=%.1f kW (predicted=%.1f, ev_share=%.2f)",
                zone_id, ev_load_kw, latest.predicted_kw, latest.ev_share_pct,
            )
        except Exception as e:
            logger.warning("Failed to sync stations from forecast for %s: %s", zone_id, e)

    # ── Public API ───────────────────────────────────────────────────────

    def get_stations(self, zone_id: str) -> List[Station]:
        """Return all stations for a zone."""
        self._ensure_init()
        return self._stations.get(zone_id, [])

    def get_total_load(self, zone_id: str) -> float:
        """Sum of current_load_kw across all stations in a zone."""
        return sum(s.current_load_kw for s in self.get_stations(zone_id))

    def apply_action(
        self, zone_id: str, action: ControlAction
    ) -> List[StationUpdate]:
        """
        Apply a control action to all stations in a zone.
        Returns a list of StationUpdate objects describing the change.
        """
        self._ensure_init()
        stations = self._stations.get(zone_id, [])
        updates: List[StationUpdate] = []

        for st in stations:
            prev_mode = st.mode
            prev_load = st.current_load_kw

            if action == ControlAction.DEFER:
                st.mode = StationMode.LIMITED
                st.current_load_kw = round(prev_load * 0.4, 1)
            elif action == ControlAction.OPTIMAL_WINDOW:
                st.mode = StationMode.DELAY
                st.current_load_kw = round(prev_load * 0.7, 1)
            elif action in (ControlAction.NO_ACTION, ControlAction.ROLLBACK):
                st.mode = StationMode.NORMAL
                # Keep current load (NO_ACTION) or it will be re-synced

            updates.append(
                StationUpdate(
                    station_id=st.station_id,
                    previous_mode=prev_mode,
                    new_mode=st.mode,
                    load_before_kw=prev_load,
                    load_after_kw=st.current_load_kw,
                    load_reduction_kw=round(prev_load - st.current_load_kw, 1),
                )
            )

        logger.info(
            "Applied %s to %d stations in %s", action.value, len(updates), zone_id
        )
        return updates

    def rollback(self, zone_id: str) -> List[StationUpdate]:
        """Restore all stations to NORMAL mode."""
        return self.apply_action(zone_id, ControlAction.ROLLBACK)


# Singleton
station_service = StationService()
