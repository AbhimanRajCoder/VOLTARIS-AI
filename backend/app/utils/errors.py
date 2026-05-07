"""Global exception handlers — never expose raw stack traces to clients."""

import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error"},
    )


async def value_error_handler(request: Request, exc: ValueError):
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )


async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
