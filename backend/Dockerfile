FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev gdal-bin && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and helper scripts
COPY app/ app/
COPY train.py pretrain_models.py _pretrain_build.py ./
RUN mkdir -p models

# Pre-train models at IMAGE BUILD TIME using synthetic data.
# Dummy env vars satisfy pydantic Settings validation; the DB connection
# fails immediately and _pretrain_build.py uses the synthetic fallback.
# The .pkl files are baked into the image so Render's ephemeral filesystem
# never causes "models not found" on deploy or restart.
RUN DATABASE_URL="postgresql://u:p@localhost/db" \
    SUPABASE_URL="https://placeholder.supabase.co" \
    SUPABASE_ANON_KEY="placeholder" \
    python _pretrain_build.py

# Production server: no --reload, single worker per container
# (Render scales horizontally via multiple instances, not via workers)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "75"]
