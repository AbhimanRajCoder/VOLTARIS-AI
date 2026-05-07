#!/usr/bin/env python3
"""
Build-time model pre-training script (called from Dockerfile).
Uses synthetic data only — no DB connection required.
"""
import sys
import os

sys.path.insert(0, "/app")

# Prevent SQLAlchemy from actually connecting during import by patching
# create_engine before any app module loads it.
from unittest.mock import MagicMock
import sqlalchemy
sqlalchemy.create_engine = MagicMock(return_value=MagicMock())

from app.ml.forecast import forecast_service, _MODEL_DIR

print(f"[pretrain] Training models into {_MODEL_DIR} …")
metrics = forecast_service.train()
print(
    f"[pretrain] Done — MAE={metrics['mae_kw']} kW | "
    f"RMSE={metrics['rmse_kw']} kW | R²={metrics['r2']}"
)
