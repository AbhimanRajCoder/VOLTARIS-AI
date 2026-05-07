"""Simulate router — scenario-based grid stress testing."""

import time
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.utils.db import get_db

router = APIRouter()

class SimulationPayload(BaseModel):
    zone_id: str
    date: str
    scenario: str
    ev_adoption_multiplier: float = 1.5
    follow_recommendations: bool = True

@router.post("/scenario")
def simulate_scenario(
    body: SimulationPayload,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Simulate the impact of different EV adoption scenarios on the grid.
    Returns estimated stress hours and peak reduction potential.
    """
    start = time.time()
    
    # Mock simulation logic based on the multiplier
    multiplier = body.ev_adoption_multiplier
    follow_recs = body.follow_recommendations
    
    # Base stress hours (unmanaged) increases with multiplier
    unmanaged_stress = int(multiplier * 6)
    
    # Optimized stress hours is lower if following recommendations
    if follow_recs:
        optimized_stress = max(1, int(unmanaged_stress * 0.3))
        peak_reduction = 20 + (multiplier * 5)
    else:
        optimized_stress = int(unmanaged_stress * 0.9)
        peak_reduction = 5
        
    payload = {
        "unmanaged": {
            "stress_hours": unmanaged_stress,
            "peak_load_kw": 2500 * multiplier,
            "violation_count": int(multiplier * 3)
        },
        "optimized": {
            "stress_hours": optimized_stress,
            "peak_load_kw": 2100 * multiplier if follow_recs else 2400 * multiplier,
            "violation_count": 0 if follow_recs else int(multiplier * 2)
        },
        "peak_reduction_pct": round(peak_reduction, 2),
        "savings_estimate_inr": round(multiplier * 15000, 2)
    }

    if response is not None:
        response.headers["X-Response-Time"] = f"{(time.time() - start) * 1000:.0f}ms"
        
    return payload
