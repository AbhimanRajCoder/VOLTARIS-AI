FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev gdal-bin && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY train.py .

# Pre-train ML models at build time so the first request is instant
# (Render will have DATABASE_URL available as a build-time secret if needed,
#  otherwise models fall back to lazy-train on first request)
RUN mkdir -p models

# Production server: no --reload, use 2 workers (Render free = 512MB RAM, 1 vCPU)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "75"]
