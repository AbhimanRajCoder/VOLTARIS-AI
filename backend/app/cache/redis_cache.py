"""Redis cache helpers with graceful fallback when Redis is unavailable."""

from __future__ import annotations

import time
import hashlib
import json
from typing import Any, Optional

import redis

from app.config import get_settings

settings = get_settings()

class RedisHealth:
    """Track Redis health to avoid timeout penalties when down."""
    is_available = True
    last_check = 0
    failure_count = 0
    COOLDOWN = 10 # seconds to wait before retrying after failure

    @classmethod
    def mark_failed(cls):
        cls.is_available = False
        cls.last_check = time.time()
        cls.failure_count += 1

    @classmethod
    def check_status(cls) -> bool:
        if cls.is_available:
            return True
        if time.time() - cls.last_check > cls.COOLDOWN:
            # Try to recover
            try:
                client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
                client.ping()
                cls.is_available = True
                cls.failure_count = 0
                return True
            except:
                cls.last_check = time.time()
                return False
        return False

def get_redis_client():
    """Return a connected Redis client, or None if Redis is unavailable."""
    try:
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1, # Reduced timeout for faster failure
            socket_timeout=1,
        )
        client.ping()
        return client
    except Exception:
        RedisHealth.mark_failed()
        return None


redis_client = get_redis_client()


def build_cache_key(prefix: str, **kwargs) -> str:
    """Build deterministic key from a prefix and hashed kwargs payload."""
    key_data = json.dumps(kwargs, sort_keys=True, default=str)
    hash_suffix = hashlib.md5(key_data.encode("utf-8")).hexdigest()[:8]
    return f"gridwise:{prefix}:{hash_suffix}"


def cache_get(key: str) -> Any | None:
    if not RedisHealth.check_status() or not redis_client:
        return None
    try:
        value = redis_client.get(key)
        return json.loads(value) if value else None
    except Exception:
        RedisHealth.mark_failed()
        return None


def cache_get_raw(key: str) -> str | None:
    """Return raw string value from cache without JSON decoding."""
    if not RedisHealth.check_status() or not redis_client:
        return None
    try:
        return redis_client.get(key)
    except Exception:
        RedisHealth.mark_failed()
        return None


def cache_set(key: str, value: Any, ttl_seconds: int) -> bool:
    if not RedisHealth.check_status() or not redis_client:
        return False
    try:
        # If it's already a string, don't double-encode
        data = value if isinstance(value, str) else json.dumps(value, default=str)
        redis_client.setex(key, ttl_seconds, data)
        return True
    except Exception:
        RedisHealth.mark_failed()
        return False


def cache_delete(key: str) -> bool:
    if not RedisHealth.check_status() or not redis_client:
        return False
    try:
        redis_client.delete(key)
        return True
    except Exception:
        RedisHealth.mark_failed()
        return False


def cache_flush_pattern(pattern: str) -> int:
    if not RedisHealth.check_status() or not redis_client:
        return 0
    try:
        # Use SCAN instead of KEYS for better performance and reliability
        count = 0
        cursor = 0
        while True:
            cursor, keys = redis_client.scan(cursor, match=f"gridwise:{pattern}:*", count=100)
            if keys:
                redis_client.delete(*keys)
                count += len(keys)
            if cursor == 0:
                break
        return count
    except Exception:
        RedisHealth.mark_failed()
        return 0


def cache_flush_all() -> int:
    """Flush all GridWise namespaced cache keys."""
    return cache_flush_pattern("*")


def cache_ttl(key: str) -> int:
    """Return remaining TTL in seconds, or -1 when unavailable/unknown."""
    if not redis_client:
        return -1
    try:
        ttl = redis_client.ttl(key)
        return int(ttl) if ttl is not None else -1
    except Exception:
        return -1


CACHE_TTL = {
    "forecast_demand": 300,
    "forecast_explain": 300,
    "schedule_optimize": 600,
    "schedule_comparison": 600,
    "infra_hotspots": 900,
    "infra_recommend": 900,
    "infra_site": 900,
    "grid_alerts": 60,
}


def _count_keys_for_prefix(prefix: str) -> int:
    if not redis_client:
        return 0
    try:
        return len(redis_client.keys(f"gridwise:{prefix}:*"))
    except Exception:
        return 0


def get_cache_stats() -> dict:
    if not redis_client:
        return {"redis_status": "unavailable", "total_keys": 0, "used_memory": "N/A"}
    try:
        info = redis_client.info("memory")
        total_keys = int(redis_client.dbsize())
        return {
            "redis_status": "connected",
            "total_keys": total_keys,
            "used_memory": info.get("used_memory_human", "N/A"),
            "cached_endpoints": {
                "forecast_demand": _count_keys_for_prefix("forecast_demand"),
                "forecast_explain": _count_keys_for_prefix("forecast_explain"),
                "schedule_optimize": _count_keys_for_prefix("schedule_optimize"),
                "schedule_comparison": _count_keys_for_prefix("schedule_comparison"),
                "infra_hotspots": _count_keys_for_prefix("infra_hotspots"),
                "infra_recommend": _count_keys_for_prefix("infra_recommend"),
                "infra_site": _count_keys_for_prefix("infra_site"),
                "grid_alerts": _count_keys_for_prefix("grid_alerts"),
            },
        }
    except Exception:
        return {"redis_status": "error", "total_keys": 0, "used_memory": "N/A"}
