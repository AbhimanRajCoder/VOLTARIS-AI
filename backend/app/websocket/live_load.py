"""WebSocket manager and live load streamer for dashboard updates."""

from __future__ import annotations

import asyncio
import random
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool

from app.models.db_models import ZoneDemandForecast
from app.utils.db import SessionLocal


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WS client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WS client disconnected. Total: {len(self.active_connections)}")

    async def send_to_one(self, websocket: WebSocket, data: dict) -> None:
        try:
            await websocket.send_json(data)
        except Exception:
            self.disconnect(websocket)

    async def broadcast(self, data: dict) -> None:
        for connection in self.active_connections.copy():
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


class LiveLoadStreamer:
    def __init__(self) -> None:
        self.current_index = 0
        self.zone_ids = [
            "Z01",
            "Z02",
            "Z03",
            "Z04",
            "Z05",
            "Z06",
            "Z07",
            "Z08",
            "Z09",
            "Z10",
        ]

    async def get_next_frame(self) -> list[dict]:
        def fetch_rows(offset: int) -> list[ZoneDemandForecast]:
            db = SessionLocal()
            try:
                rows = (
                    db.query(ZoneDemandForecast)
                    .order_by(ZoneDemandForecast.timestamp.asc(), ZoneDemandForecast.zone_id.asc())
                    .offset(offset)
                    .limit(10)
                    .all()
                )
                if not rows:
                    rows = (
                        db.query(ZoneDemandForecast)
                        .order_by(ZoneDemandForecast.timestamp.asc(), ZoneDemandForecast.zone_id.asc())
                        .limit(10)
                        .all()
                    )
                return rows
            finally:
                db.close()

        rows = await run_in_threadpool(fetch_rows, self.current_index)
        
        if not rows:
            return []

        if len(rows) < 10:
            self.current_index = 0
        else:
            self.current_index += 10

            frame: list[dict] = []
            for row in rows:
                jitter = random.uniform(-0.02, 0.02)
                load_kw = row.predicted_kw * (1 + jitter)
                frame.append(
                    {
                        "zone_id": row.zone_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "load_kw": round(load_kw, 2),
                        "ev_share_pct": round(row.ev_share_pct, 4),
                        "confidence_lo": round(row.confidence_lo * (1 + jitter), 2),
                        "confidence_hi": round(row.confidence_hi * (1 + jitter), 2),
                        "status": (
                            "CRITICAL"
                            if row.predicted_kw > 600
                            else "WARNING" if row.predicted_kw > 450 else "NORMAL"
                        ),
                    }
                )
            return frame

streamer = LiveLoadStreamer()


async def websocket_live_load(websocket: WebSocket, zone_id: str | None = None) -> None:
    await manager.connect(websocket)
    await manager.send_to_one(
        websocket,
        {
            "type": "connected",
            "message": "GridWise live feed connected",
            "update_interval_ms": 5000,
            "zones": streamer.zone_ids,
        },
    )

    try:
        while True:
            frame = await streamer.get_next_frame()
            if zone_id:
                frame = [item for item in frame if item["zone_id"] == zone_id]

            await manager.send_to_one(
                websocket,
                {
                    "type": "load_update",
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": frame,
                },
            )
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
