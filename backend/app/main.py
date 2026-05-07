"""GridWise API — main application entry point."""

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.cache.redis_cache import (
    cache_flush_all,
    cache_flush_pattern,
    get_cache_stats,
    redis_client,
    RedisHealth,
)
from app.config import get_settings
from app.models.db_models import Base
from app.routers.alerts import router as alerts_router
from app.routers.briefing import router as briefing_router
from app.routers.chat import router as chat_router
from app.routers.forecast import router as forecast_router
from app.routers.infra import router as infra_router
from app.routers.deflect import router as deflect_router
from app.routers.schedule import router as schedule_router
from app.routers.simulate import router as simulate_router
from app.routers.control import router as control_router
from app.tasks.background import monitor_grid_alerts
from app.utils.errors import (
    global_exception_handler,
    value_error_handler,
    sqlalchemy_exception_handler,
)
from app.websocket.live_load import manager, websocket_live_load

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
APP_START_TIME = time.time()
alert_monitor_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global alert_monitor_task
    engine = settings.sqlalchemy_engine
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()

        Base.metadata.create_all(bind=engine)
        logging.info("Database tables created/verified.")
    except Exception as e:
        logging.error(f"Error during startup: {e}")

    alert_monitor_task = asyncio.create_task(monitor_grid_alerts())
    logging.info("Background alert monitor started")

    yield

    if alert_monitor_task:
        alert_monitor_task.cancel()
        logging.info("Background alert monitor stopped")


app = FastAPI(
    title="GridWise API",
    description="EV Grid Intelligence — demand forecasting, charge scheduling, "
    "infrastructure planning, and grid alerts.",
    version="1.0.0",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def add_response_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000

    if "X-Response-Time" not in response.headers:
        response.headers["X-Response-Time"] = f"{duration:.0f}ms"

    if duration > 2000:
        print(f"SLOW REQUEST: {request.url.path} took {duration:.0f}ms")

    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.include_router(forecast_router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(schedule_router, prefix="/api/schedule", tags=["Schedule"])
app.include_router(infra_router, prefix="/api/infra", tags=["Infrastructure"])
app.include_router(alerts_router, prefix="/api/grid", tags=["Alerts"])
app.include_router(briefing_router, prefix="/api/briefing", tags=["Briefing"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(simulate_router, prefix="/api/simulate", tags=["Simulate"])
app.include_router(control_router, prefix="/api/control", tags=["Control"])
app.include_router(deflect_router, prefix="/api/deflect")


@app.websocket("/ws/live-load")
async def ws_live_load(websocket: WebSocket, zone_id: str = Query(default=None)):
    await websocket_live_load(websocket, zone_id)


@app.get("/api/cache/stats", tags=["Cache"])
async def cache_stats():
    return get_cache_stats()


@app.get("/api/cache/flush", tags=["Cache"])
async def cache_flush(pattern: str | None = Query(default=None)):
    flushed = cache_flush_pattern(pattern) if pattern else cache_flush_all()
    return {"flushed_keys": flushed}


_db_health_cache = {"status": "unknown", "last_check": 0}
_DB_HEALTH_TTL = 30  # seconds


@app.get("/health", tags=["Health"])
async def health_check():
    now = time.time()

    # Only ping the database if the cached result is stale (>30s old)
    if now - _db_health_cache["last_check"] > _DB_HEALTH_TTL:
        try:
            engine = settings.sqlalchemy_engine
            with engine.connect() as conn:
                conn.execute(text("SELECT 1")).fetchone()
            _db_health_cache["status"] = "connected"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            _db_health_cache["status"] = "unavailable"
        _db_health_cache["last_check"] = now

    db_status = _db_health_cache["status"]

    # Simplified cache check - just ping redis, don't count all keys
    redis_ok = "connected" if redis_client and redis_client.ping() else "unavailable"
    
    background_status = (
        "running" if alert_monitor_task is not None and not alert_monitor_task.done() else "stopped"
    )
    
    return {
        "status": "ok",
        "model_version": settings.MODEL_VERSION,
        "db": db_status,
        "redis": redis_ok,
        "background_monitor": background_status,
        "uptime_seconds": int(time.time() - APP_START_TIME),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
