"""Database session management for FastAPI dependency injection."""

from sqlalchemy.orm import sessionmaker, Session
from app.config import get_settings
from typing import Generator

settings = get_settings()

# Expose engine at module level so other modules (e.g. ml/forecast.py) can
# do `from app.utils.db import engine` without going through settings.
engine = settings.sqlalchemy_engine

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session; auto-closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
