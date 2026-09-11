import os
import time
import logging
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status

logger = logging.getLogger("securerag-ratelimit")

REDIS_URL = os.getenv("REDIS_URL")
_redis_client = None
_redis_available = False

if REDIS_URL:
    try:
        import redis
        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
        _redis_client.ping()
        _redis_available = True
        logger.info("Connected to Redis server for rate limiting & caching: %s", REDIS_URL)
    except Exception as e:
        logger.warning("Redis connection failed (%s). Falling back to in-memory rate limiting.", str(e))

# In-memory storage fallback: key -> list of timestamps
_memory_store: Dict[str, List[float]] = {}


def check_rate_limit(
    identifier: str,
    max_requests: int = 15,
    window_seconds: int = 60,
) -> Tuple[bool, int]:
    """
    Rate limiting check.
    Returns (is_allowed, remaining_requests).
    """
    now = time.time()
    key = f"ratelimit:{identifier}"

    if _redis_available and _redis_client:
        try:
            pipe = _redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window_seconds)
            results = pipe.execute()
            count = results[2]
            allowed = count <= max_requests
            remaining = max(0, max_requests - count)
            return allowed, remaining
        except Exception as e:
            logger.warning("Redis rate limit check error (%s), using memory fallback", str(e))

    # Memory fallback
    timestamps = _memory_store.get(identifier, [])
    # Filter expired timestamps
    valid_timestamps = [ts for ts in timestamps if now - ts < window_seconds]
    valid_timestamps.append(now)
    _memory_store[identifier] = valid_timestamps

    count = len(valid_timestamps)
    allowed = count <= max_requests
    remaining = max(0, max_requests - count)
    return allowed, remaining


def rate_limit_dependency(max_requests: int = 20, window_seconds: int = 60):
    """
    FastAPI dependency factory enforcing rate limits on endpoints.
    """
    async def dependency(request: Request):
        client_ip = request.client.host if request.client else "127.0.0.1"
        identifier = f"{request.url.path}:{client_ip}"
        
        allowed, remaining = check_rate_limit(identifier, max_requests, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait before sending more requests.",
                headers={"Retry-After": str(window_seconds)},
            )
    return dependency
