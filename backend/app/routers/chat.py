"""Chat router — GridWise Assistant using Groq API."""

import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from groq import Groq

from app.utils.db import get_db
from app.config import get_settings
from app.models.db_models import (
    Zone as ZoneDB,
    ZoneDemandForecast as ZoneDemandForecastDB,
    GridAlert as GridAlertDB,
    InfraSiteCandidate as InfraSiteCandidateDB,
    ChargingRecommendation as ChargingRecDB,
)
from sqlalchemy import func
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

if not settings.GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set in environment or .env file.")

client = Groq(api_key=settings.GROQ_API_KEY)

def build_gridwise_context(db: Session) -> str:
    """
    Gather data from across the system to provide context for the LLM.
    """
    try:
        # 1. Forecast Summary (Latest load for all zones)
        latest_ts = db.query(func.max(ZoneDemandForecastDB.timestamp)).scalar()
        latest_demand = []
        if latest_ts:
            latest_demand = (
                db.query(ZoneDemandForecastDB)
                .filter(ZoneDemandForecastDB.timestamp == latest_ts)
                .all()
            )

        # 2. Alerts (unresolved)
        alerts = db.query(GridAlertDB).filter(GridAlertDB.resolved == False).all()
        
        # 3. Top Infra Candidates
        infra = (
            db.query(InfraSiteCandidateDB)
            .order_by(InfraSiteCandidateDB.composite_rank.asc())
            .limit(5)
            .all()
        )
        
        # 4. Recent Charging Recommendations
        recs = (
            db.query(ChargingRecDB)
            .order_by(ChargingRecDB.id.desc()) # Assuming latest entries are most relevant
            .limit(5)
            .all()
        )

        context = {
            "timestamp": datetime.now().isoformat(),
            "grid_summary": [
                {"zone": d.zone_id, "load_kw": d.predicted_kw}
                for d in latest_demand
            ],
            "active_alerts": [
                {"zone": a.zone_id, "severity": a.severity, "message": a.message}
                for a in alerts
            ],
            "top_ev_site_candidates": [
                {"site_id": s.site_id, "score": s.composite_score, "rank": s.composite_rank}
                for s in infra
            ],
            "latest_charging_recs": [
                {"zone": r.zone_id, "hour": r.hour_slot, "action": r.action, "reason": r.reason}
                for r in recs
            ]
        }
        return json.dumps(context, default=str)
    except Exception as e:
        logger.error(f"Error building context: {e}")
        return "System data currently unavailable."

@router.post("/message")
async def chat_message(
    message: str = Body(..., embed=True),
    language: str = Body("en", pattern="^(en|kn)$"),
    history: List[dict] = Body([]),
    db: Session = Depends(get_db)
):
    """
    Stream a response from Groq based on user message and grid context.
    """
    system_context = build_gridwise_context(db)
    
    system_prompt = (
        "You are the GridWise Strategic Assistant, an elite AI advisor for BESCOM (Bangalore Electricity Supply Company) Bengaluru. "
        "Your mission is to provide high-precision insights for grid management, EV infrastructure planning, and operational efficiency.\n\n"
        f"### LIVE GRID CONTEXT (JSON Format):\n{system_context}\n\n"
        "### CORE OPERATIONAL PROTOCOLS:\n"
        "1. **Absolute Language Locking**: "
        f"   - The current session language is set to: {'KANNADA' if language == 'kn' else 'ENGLISH'}.\n"
        "   - You MUST ignore the language used in previous conversation history if it differs from the current setting.\n"
        "   - If the current language is KANNADA, your entire output (Analysis, Recommendation, Next Action) MUST be in professional Kannada script.\n"
        "   - If the current language is ENGLISH, your entire output MUST be in professional English.\n"
        "2. **Data Integrity**: Never speculate or hallucinate. Use only the provided grid context. If information is missing, state it clearly.\n"
        "3. **Strategic Conciseness**: Keep insights under 120 words. Focus on actionable intelligence rather than generic descriptions.\n"
        "4. **Response Architecture**: Always structure your response as follows:\n"
        "   - **Analysis**: A brief overview of the situation based on the context.\n"
        "   - **Recommendation**: A specific, data-driven advice.\n"
        "   - **Next Action**: A direct command for the user (e.g., 'Deploy mobile charging unit to Zone A').\n"
        "5. **Tone**: Executive, authoritative, and data-centric. You are a tool for BESCOM engineers and decision-makers."
    )

    messages = [{"role": "system", "content": system_prompt}]
    # Limit history to last 10 messages to keep context window manageable
    messages.extend(history[-10:])
    
    # Final language enforcement message to override any history bias
    language_instruction = (
        "Respond EXCLUSIVELY in professional Kannada." 
        if language == "kn" 
        else "Respond EXCLUSIVELY in professional English."
    )
    messages.append({"role": "system", "content": f"CRITICAL: {language_instruction}"})
    messages.append({"role": "user", "content": message})

    try:
        def generate():
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        raise HTTPException(status_code=500, detail="Error communicating with AI service.")
