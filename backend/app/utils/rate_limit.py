from __future__ import annotations

from collections import deque
import logging
from threading import Lock
from time import time
from typing import Deque

from fastapi import HTTPException, Request, status
from redis import Redis
from redis.exceptions import RedisError

from config import settings


from app.utils.redis import get_redis_client, reset_redis_client as reset_redis_utility_client

logger = logging.getLogger(__name__)


_RATE_LIMIT_BUCKETS: dict[str, Deque[float]] = {}
_RATE_LIMIT_LOCK = Lock()
_REDIS_KEY_PREFIX = "rate_limit"


def _client_identifier(request: Request | None) -> str:
    if request is None:
        return "unknown"

    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def _get_redis_client() -> Redis | None:
    return get_redis_client()


def _enforce_in_memory_rate_limit(*, bucket_key: str, limit: int, window_seconds: int) -> None:
    now = time()

    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_BUCKETS.setdefault(bucket_key, deque())
        while bucket and (now - bucket[0]) >= window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)


def _enforce_redis_rate_limit(*, bucket_key: str, limit: int, window_seconds: int) -> bool:
    client = _get_redis_client()
    if client is None:
        return False

    redis_key = f"{_REDIS_KEY_PREFIX}:{bucket_key}"

    try:
        # Use a pipeline or Lua script for atomicity if needed, 
        # but for simple rate limiting, this multi-step approach is usually fine 
        # if we handle the TTL correctly.
        current_count = client.incr(redis_key)
        
        # If it's a new key, set expiration
        if current_count == 1:
            client.expire(redis_key, window_seconds)
        else:
            # Safety check: if for some reason the key has no TTL (e.g. server crash after INCR but before EXPIRE)
            # we must set it to avoid permanent blocking.
            ttl = client.ttl(redis_key)
            if ttl < 0:
                client.expire(redis_key, window_seconds)

        if current_count > limit:
            ttl = client.ttl(redis_key)
            retry_after = max(1, ttl if ttl > 0 else window_seconds)
            
            # Log high-frequency rate limit hits as they might indicate an attack or misconfiguration
            if current_count > limit * 2:
                logger.warning(f"SEVERE RATE LIMIT HIT: {bucket_key} reached {current_count}/{limit}")
                
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        return True
    except HTTPException:
        raise
    except RedisError as exc:
        # At scale (100k users), falling back to in-memory will cause memory pressure on the app servers
        # and inconsistent rate limiting. We log this as a warning.
        logger.error(
            "Redis rate limiting FAILED. Falling back to in-memory. THIS IS NOT SCALABLE.",
            exc_info=exc,
        )
        return False


def enforce_rate_limit(
    *,
    request: Request | None,
    scope: str,
    limit: int,
    window_seconds: int,
) -> None:
    if request is None:
        return

    identifier = _client_identifier(request)
    bucket_key = f"{scope}:{identifier}"
    if _enforce_redis_rate_limit(bucket_key=bucket_key, limit=limit, window_seconds=window_seconds):
        return

    _enforce_in_memory_rate_limit(bucket_key=bucket_key, limit=limit, window_seconds=window_seconds)


def reset_rate_limit_state() -> None:
    with _RATE_LIMIT_LOCK:
        _RATE_LIMIT_BUCKETS.clear()
    reset_redis_utility_client()
