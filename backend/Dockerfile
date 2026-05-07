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
# The .pkl files are baked into the image layer so Render's ephemeral
# filesystem never causes "models not found" on deploy/restart.
RUN DATABASE_URL="postgresql://placeholder:x@localhost/placeholder" \
    SUPABASE_URL="https://placeholder.supabase.co" \
    SUPABASE_ANON_KEY="placeholder" \
    python _pretrain_build.py

# Production server: no --reload, 2 workers, keepalive tuned for Render
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "75"]
