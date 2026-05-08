from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from functools import lru_cache
import json
import os
from pathlib import Path

# Base directory of the project (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # App
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    MODEL_DIR: str = "./models"
    APP_ENV: str = "dev"
    SECRET_KEY: str = "changeme"
    SEED_DATA_DIR: str = "./data/output"
    MODEL_VERSION: str = "v1.0"
    GROQ_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"), 
        extra="ignore"
    )

    @property
    def sqlalchemy_engine(self):
        """Returns a cached SQLAlchemy engine tuned for Supabase's connection limits.

        Uses session-mode pooler (port 5432) because psycopg2 is incompatible
        with PgBouncer transaction mode (port 6543) — it requires the server
        to return client_encoding in the startup response.

        Session mode is capped at 15 connections on Supabase free tier.
        With 1 uvicorn worker: pool_size(5) + max_overflow(3) = 8 max,
        leaving 7 slots for Supabase dashboard, migrations, etc.
        """
        global _ENGINE_CACHE
        if _ENGINE_CACHE is None:
            from sqlalchemy import create_engine, event
            _ENGINE_CACHE = create_engine(
                self.DATABASE_URL,
                # ── Pool sizing (session mode, 1 worker) ──────────────────
                # Supabase free tier: 15 session-mode connections max.
                # 1 worker × (5 + 3) = 8 connections at peak burst.
                pool_size=5,          # persistent connections
                max_overflow=3,       # burst connections above pool_size
                # ── Resilience ─────────────────────────────────────────────
                pool_pre_ping=True,   # validate connections before use
                pool_recycle=300,     # recycle every 5 min (Supabase drops idle conns)
                pool_timeout=10,      # fail fast instead of hanging 30s
                pool_use_lifo=True,   # reuse warm connections; idle ones close sooner
                connect_args={"sslmode": "require", "connect_timeout": 10},
            )

            @event.listens_for(_ENGINE_CACHE, "connect")
            def set_read_write(dbapi_connection, connection_record):
                """Force session to read-write mode to bypass Supabase read-only defaults."""
                cursor = dbapi_connection.cursor()
                try:
                    cursor.execute("SET default_transaction_read_only = off")
                except Exception:
                    pass
                finally:
                    cursor.close()

        return _ENGINE_CACHE

_ENGINE_CACHE = None

@lru_cache()
def get_settings():
    return Settings()
