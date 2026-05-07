"""LP charging scheduler using PuLP — replaces Phase 2 rule-based logic."""

import logging
from datetime import date
from typing import Optional

from pulp import (
    LpProblem,
    LpMinimize,
    LpVariable,
    lpSum,
    LpStatus,
    PULP_CBC_CMD,
    value,
)

from app.models.schemas import ActionEnum

logger = logging.getLogger(__name__)

PEAK_HOURS = set(range(18, 24))        # 18-23
OFF_PEAK_HOURS = {0, 1, 2, 3, 4, 5, 6, 7}


class OptimizerService:
    """LP-based charging schedule optimiser with rule-based fallback."""

    def optimize(
        self,
        zone_id: str,
        target_date: date,
        hourly_demand: list[float],
        capacity_limit_kw: float,
        user_window_start: int = 18,
        user_window_end: int = 22,
    ) -> list[dict]:
        """
        Solve the LP and return 24 hourly recommendations.
        Falls back to rule-based logic if infeasible.
        """
        assert len(hourly_demand) == 24, "hourly_demand must have 24 entries"

        try:
            result = self._solve_lp(
                zone_id, hourly_demand, capacity_limit_kw
            )
            if result is not None:
                return result
        except Exception as e:
            logger.warning("LP solver error for zone %s: %s", zone_id, e)

        logger.info("LP infeasible for zone %s — using rule-based fallback", zone_id)
        return self._rule_based_fallback(
            zone_id, hourly_demand, capacity_limit_kw
        )

    # ── LP solver ────────────────────────────────────────────────────────
    def _solve_lp(
        self,
        zone_id: str,
        demand: list[float],
        cap: float,
    ) -> Optional[list[dict]]:
        prob = LpProblem("ChargingSchedule", LpMinimize)

        # Variables
        shift = [
            LpVariable(f"shift_{h}", lowBound=0) for h in range(24)
        ]
        receive = [
            LpVariable(f"recv_{h}", lowBound=0) for h in range(24)
        ]
        excess = [
            LpVariable(f"excess_{h}", lowBound=0) for h in range(24)
        ]

        # Objective: flatten relative to current peak
        peak_demand = max(demand)
        target_load = peak_demand * 0.75  # target is 75 % of today's peak
        for h in range(24):
            adjusted = demand[h] - shift[h] + receive[h]
            prob += excess[h] >= adjusted - target_load

        prob += lpSum(excess)

        # Constraints
        mean_demand = sum(demand) / 24
        for h in range(24):
            # 1. shift only from peak
            if h not in PEAK_HOURS:
                prob += shift[h] == 0
            else:
                # Minimum shift enforcement for above-average peak hours
                if demand[h] > mean_demand:
                    prob += shift[h] >= demand[h] * 0.08

            # 2. receive only in off-peak
            if h not in OFF_PEAK_HOURS:
                prob += receive[h] == 0
            # 3. max shift 30 % of demand
            prob += shift[h] <= demand[h] * 0.30
            # 4. receive per off-peak hour capped at 50 % of that hour's demand
            if h in OFF_PEAK_HOURS and demand[h] > 0:
                prob += receive[h] <= demand[h] * 0.50

        # 5. conservation
        prob += lpSum(shift) == lpSum(receive)

        # Solve (suppress CBC output)
        prob.solve(PULP_CBC_CMD(msg=0))

        if LpStatus[prob.status] != "Optimal":
            return None

        # Build results
        recs: list[dict] = []
        total_shifted = 0.0
        total_received = 0.0
        for h in range(24):
            s = value(shift[h]) or 0.0
            r = value(receive[h]) or 0.0
            adjusted_load = demand[h] - s + r
            load_pct = (adjusted_load / cap * 100) if cap else 0.0
            total_shifted += s
            total_received += r

            if s > 0.01:
                action = ActionEnum.DEFER
                optimal_window = "22:00 - 07:00"
                reason = (
                    f"Peak demand detected at {h:02d}:00. Shifting {s:.1f} kW of EV load "
                    "to off-peak hours to maintain transformer headroom and prevent thermal stress."
                )
                delta = round(-s, 2)  # negative = load removed
            elif r > 0.01:
                action = ActionEnum.OPTIMAL_WINDOW
                optimal_window = f"{h:02d}:00 - {(h + 1) % 24:02d}:00"
                reason = (
                    f"Grid capacity available at {h:02d}:00. Absorbing {r:.1f} kW of redistributed "
                    "load from peak hours while maintaining local stability."
                )
                delta = round(r, 2)   # positive = load added
            else:
                action = ActionEnum.CHARGE_NOW
                optimal_window = None
                reason = f"Zone demand at {h:02d}:00 is within safe operational limits (Grid Load < 75%)."
                delta = 0.0

            recs.append({
                "zone_id": zone_id,
                "hour_slot": h,
                "action": action.value,
                "grid_load_pct": round(load_pct, 2),
                "optimal_window": optimal_window,
                "reason": reason,
                "expected_delta_kw": delta,
                "adjusted_load_kw": round(adjusted_load, 2),
            })

        logger.info(
            "LP solved for %s: shifted=%.1f kW, received=%.1f kW, conservation_err=%.3f",
            zone_id, total_shifted, total_received,
            abs(total_shifted - total_received),
        )
        return recs

    # ── rule-based fallback (Phase 2 logic) ──────────────────────────────
    def _rule_based_fallback(
        self,
        zone_id: str,
        demand: list[float],
        cap: float,
    ) -> list[dict]:
        recs: list[dict] = []
        for h in range(24):
            avg_kw = demand[h]
            load_pct = (avg_kw / cap * 100) if cap else 0.0

            if avg_kw > cap * 0.85:
                action = ActionEnum.DEFER.value
                optimal_window = "23:00 - 06:00"
                delta = round(-avg_kw * 0.25, 2)  # negative = removed
                adjusted = avg_kw + delta  # reduced
                reason = "Load exceeds 85% of transformer capacity during peak hours"
            elif avg_kw > cap * 0.65:
                action = ActionEnum.OPTIMAL_WINDOW.value
                optimal_window = "22:00 - 07:00"
                delta = round(avg_kw * 0.15, 2)   # positive = added
                adjusted = avg_kw + delta
                reason = "Moderate load — shifting to late night reduces peak stress"
            else:
                action = ActionEnum.CHARGE_NOW.value
                optimal_window = None
                delta = 0.0
                adjusted = avg_kw
                reason = "Grid load within safe limits"

            recs.append({
                "zone_id": zone_id,
                "hour_slot": h,
                "action": action,
                "grid_load_pct": round(load_pct, 2),
                "optimal_window": optimal_window,
                "reason": reason,
                "expected_delta_kw": delta,
                "adjusted_load_kw": round(adjusted, 2),
            })
        return recs


# Singleton
optimizer_service = OptimizerService()
