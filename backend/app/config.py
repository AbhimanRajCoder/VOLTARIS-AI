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
        """Returns a cached SQLAlchemy engine configured for Supabase connection pooling."""
        global _ENGINE_CACHE
        if _ENGINE_CACHE is None:
            from sqlalchemy import create_engine, event
            _ENGINE_CACHE = create_engine(
                self.DATABASE_URL,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20,
                connect_args={"sslmode": "require"}
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
