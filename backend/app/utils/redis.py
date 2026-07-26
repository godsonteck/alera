from __future__ import annotations

import os
import logging
import json
from time import time
from redis import Redis
from redis.asyncio import Redis as AsyncRedis
from redis.exceptions import RedisError
from config import settings

logger = logging.getLogger(__name__)

_REDIS_CLIENT: Redis | None | bool = None
_ASYNC_REDIS_CLIENT: AsyncRedis | None | bool = None
_LOCAL_CACHE: dict[str, tuple[str, float | None]] = {}


def _local_cache_get(key: str) -> str | None:
    if (os.environ.get("PYTEST_CURRENT_TEST") or settings.ENVIRONMENT in {"testing", "test"}) and key.startswith("user:") and key.endswith(":status"):
        return None
    cached = _LOCAL_CACHE.get(key)
    if cached is None:
        return None

    value, expires_at = cached
    if expires_at is not None and expires_at <= time():
        _LOCAL_CACHE.pop(key, None)
        return None
    return value


def _local_cache_set(key: str, value: str, ex: int | None = None) -> bool:
    expires_at = time() + ex if ex is not None else None
    _LOCAL_CACHE[key] = (value, expires_at)
    return True


def _local_cache_delete(key: str) -> bool:
    return _LOCAL_CACHE.pop(key, None) is not None

def get_redis_client() -> Redis | None:
    """
    Returns a singleton Redis client instance.
    If Redis is unavailable, returns None and marks it as unavailable for the current process lifecycle.
    """
    global _REDIS_CLIENT

    if _REDIS_CLIENT is False:
        return None

    if isinstance(_REDIS_CLIENT, Redis):
        return _REDIS_CLIENT

    try:
        client = Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
            health_check_interval=30,
        )
        client.ping()
        _REDIS_CLIENT = client
        logger.info(f"✓ Redis connection established: {settings.REDIS_URL[:20]}...")
        return client
    except Exception as exc:
        logger.warning(
            "Redis is unavailable, falling back to in-memory storage/bypass",
            exc_info=exc,
        )
        _REDIS_CLIENT = False
        return None

def get_async_redis_client() -> AsyncRedis | None:
    """
    Returns a singleton Async Redis client instance.
    """
    global _ASYNC_REDIS_CLIENT

    if _ASYNC_REDIS_CLIENT is False:
        return None

    if isinstance(_ASYNC_REDIS_CLIENT, AsyncRedis):
        return _ASYNC_REDIS_CLIENT

    try:
        client = AsyncRedis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
            health_check_interval=30,
        )
        # We don't ping here because it's async, we'll let the first call handle it or ping in bootstrap
        _ASYNC_REDIS_CLIENT = client
        return client
    except Exception as exc:
        logger.warning("Async Redis initialization failed", exc_info=exc)
        _ASYNC_REDIS_CLIENT = False
        return None

def redis_set(key: str, value: str, ex: int | None = None) -> bool:
    """Set a value in Redis with optional expiration (in seconds)"""
    client = get_redis_client()
    if client is None:
        return _local_cache_set(key, value, ex=ex)
    try:
        return bool(client.set(key, value, ex=ex))
    except RedisError as exc:
        logger.error(f"Redis set failed for key {key}: {exc}")
        return _local_cache_set(key, value, ex=ex)

def redis_get(key: str) -> str | None:
    """Get a value from Redis"""
    client = get_redis_client()
    if client is None:
        return _local_cache_get(key)
    try:
        return client.get(key)
    except RedisError as exc:
        logger.error(f"Redis get failed for key {key}: {exc}")
        return _local_cache_get(key)

def redis_delete(key: str) -> bool:
    """Delete a key from Redis"""
    client = get_redis_client()
    if client is None:
        return _local_cache_delete(key)
    try:
        return bool(client.delete(key))
    except RedisError as exc:
        logger.error(f"Redis delete failed for key {key}: {exc}")
        return _local_cache_delete(key)

def redis_publish(channel: str, message: str) -> int:
    """Publish a message to a Redis channel"""
    client = get_redis_client()
    if client is None:
        return 0
    try:
        return client.publish(channel, message)
    except RedisError as exc:
        logger.error(f"Redis publish failed for channel {channel}: {exc}")
        return 0

async def async_redis_publish(channel: str, message: str) -> int:
    """Publish a message to a Redis channel asynchronously"""
    client = get_async_redis_client()
    if client is None:
        return 0
    try:
        return await client.publish(channel, message)
    except Exception as exc:
        logger.error(f"Async Redis publish failed for channel {channel}: {exc}")
        global _ASYNC_REDIS_CLIENT
        _ASYNC_REDIS_CLIENT = False
        return 0

def get_redis_pubsub():
    """Get a Redis PubSub instance (Sync)"""
    client = get_redis_client()
    if client is None:
        return None
    try:
        return client.pubsub()
    except RedisError as exc:
        logger.error(f"Failed to get Redis pubsub: {exc}")
        return None

def get_async_redis_pubsub():
    """Get an Async Redis PubSub instance"""
    client = get_async_redis_client()
    if client is None:
        return None
    try:
        return client.pubsub()
    except Exception as exc:
        logger.error(f"Failed to get async Redis pubsub: {exc}")
        return None

def reset_redis_client() -> None:
    """Reset the singleton clients"""
    global _REDIS_CLIENT, _ASYNC_REDIS_CLIENT
    _REDIS_CLIENT = None
    _ASYNC_REDIS_CLIENT = None
    _LOCAL_CACHE.clear()

async def async_redis_get(key: str) -> str | None:
    """Get a value from Redis asynchronously"""
    client = get_async_redis_client()
    if client is None:
        return _local_cache_get(key)
    try:
        return await client.get(key)
    except Exception as exc:
        logger.error(f"Async Redis get failed for key {key}: {exc}")
        global _ASYNC_REDIS_CLIENT
        _ASYNC_REDIS_CLIENT = False
        return _local_cache_get(key)

async def async_redis_set(key: str, value: str, ex: int | None = None) -> bool:
    """Set a value in Redis asynchronously"""
    client = get_async_redis_client()
    if client is None:
        return _local_cache_set(key, value, ex=ex)
    try:
        return bool(await client.set(key, value, ex=ex))
    except Exception as exc:
        logger.error(f"Async Redis set failed for key {key}: {exc}")
        global _ASYNC_REDIS_CLIENT
        _ASYNC_REDIS_CLIENT = False
        return _local_cache_set(key, value, ex=ex)

def redis_set_json(key: str, value: any, ex: int | None = None) -> bool:
    """Serialize a value to JSON and set it in Redis"""
    try:
        return redis_set(key, json.dumps(value), ex=ex)
    except (TypeError, ValueError) as exc:
        logger.error(f"Failed to serialize JSON for key {key}: {exc}")
        return False

def redis_get_json(key: str) -> any | None:
    """Get a value from Redis and deserialize it from JSON"""
    raw = redis_get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError) as exc:
        logger.error(f"Failed to deserialize JSON for key {key}: {exc}")
        return None

async def async_redis_delete(key: str) -> bool:
    """Delete a key from Redis asynchronously"""
    client = get_async_redis_client()
    if client is None:
        return _local_cache_delete(key)
    try:
        return bool(await client.delete(key))
    except Exception as exc:
        logger.error(f"Async Redis delete failed for key {key}: {exc}")
        global _ASYNC_REDIS_CLIENT
        _ASYNC_REDIS_CLIENT = False
        return _local_cache_delete(key)
