import pytest
from httpx import AsyncClient
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "db" in data

@pytest.mark.asyncio
async def test_not_found():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/undefined-route")
    assert response.status_code == 404
