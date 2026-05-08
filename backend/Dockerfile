FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev gdal-bin && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and helper scripts
COPY app/ app/
COPY .env app/.env
COPY train.py pretrain_models.py _pretrain_build.py ./
RUN mkdir -p models

# Pre-train models at IMAGE BUILD TIME using real Supabase credentials.
# The .pkl files are baked into the image layer so Render's ephemeral
# filesystem never causes "models not found" on deploy/restart.
# _pretrain_build.py uses the synthetic fallback if DB is unreachable.
RUN python _pretrain_build.py

# Production server: no --reload, single worker per container
# (Render scales horizontally via multiple instances, not via workers)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "75"]
