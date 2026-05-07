FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev gdal-bin && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and training script
COPY app/ app/
COPY train.py .
RUN mkdir -p models

# Pre-train models at IMAGE BUILD TIME using synthetic data so that:
# 1. No training ever happens at request time (no cold-start delay)
# 2. The .pkl files survive Render's ephemeral filesystem (baked into image)
# DATABASE_URL is not needed here because _load_training_data() falls back
# to synthetic data when the DB is unreachable.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost/placeholder" \
    SUPABASE_URL="https://placeholder.supabase.co" \
    SUPABASE_ANON_KEY="placeholder" \
    python -c "
import sys; sys.path.insert(0, '/app')
# Prevent SQLAlchemy from actually connecting during import
import unittest.mock as _m
import sqlalchemy as _sa
_sa.create_engine = _m.MagicMock(return_value=_m.MagicMock())

from app.ml.forecast import forecast_service
metrics = forecast_service.train()
print(f'Build-time training done: MAE={metrics[\"mae_kw\"]} kW, R2={metrics[\"r2\"]}')
"

# Production server: no --reload, 2 workers, keepalive tuned for Render
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "75"]
