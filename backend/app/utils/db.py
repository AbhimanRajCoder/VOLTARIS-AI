"""Database session management for FastAPI dependency injection."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import get_settings
from typing import Generator

settings = get_settings()

SessionLocal = sessionmaker(bind=settings.sqlalchemy_engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session; auto-closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
