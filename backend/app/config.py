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

        Supabase transaction-mode pooler (port 6543) supports many logical
        connections but has a physical pool_size cap per plan.  Session-mode
        (port 5432) is capped at 15 total.  We keep the SQLAlchemy pool tiny
        so we never exceed that cap even under multi-worker deploys.

        Rule of thumb for Supabase free tier (session mode, 15 cap):
          pool_size = floor(15 / workers) - 1  →  floor(15/2) - 1 = 6
        For transaction mode (port 6543) this is much more relaxed.
        """
        global _ENGINE_CACHE
        if _ENGINE_CACHE is None:
            from sqlalchemy import create_engine, event
            _ENGINE_CACHE = create_engine(
                self.DATABASE_URL,
                # ── Pool sizing ────────────────────────────────────────────
                # Keep small to avoid EMAXCONNSESSION on Supabase.
                # With 2 uvicorn workers: 2 × (pool_size + max_overflow) must
                # stay well below Supabase's hard limit (15 for session mode,
                # much higher for transaction mode on port 6543).
                pool_size=3,          # persistent connections per worker
                max_overflow=2,       # burst connections above pool_size
                # ── Resilience ─────────────────────────────────────────────
                pool_pre_ping=True,   # validate connections before use
                pool_recycle=1800,    # recycle connections every 30 min
                pool_timeout=10,      # fail fast instead of hanging 30s
                pool_use_lifo=True,   # reuse warm connections; idle ones are closed sooner
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
