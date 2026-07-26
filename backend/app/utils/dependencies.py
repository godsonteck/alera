from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from database import get_db
from app.models.user import User, UserRole
from app.utils.auth import decode_token, get_user_id_from_payload
from app.utils.access import require_verified_workforce_member

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user from a bearer token or auth cookie."""
    token: str | None = None
    if credentials is not None:
        token = credentials.credentials
    else:
        authorization = request.headers.get("Authorization")
        if authorization:
            scheme, _, token_value = authorization.partition(" ")
            if scheme.lower() == "bearer" and token_value:
                token = token_value.strip()
        if not token:
            token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token not found"
        )

    payload = decode_token(token)
    user_id = get_user_id_from_payload(payload)

    # ── User Status Caching ──────────────────────────────────────────────────
    from app.utils.redis import async_redis_get, async_redis_set
    import json
    cache_key = f"user:{user_id}:status"
    cached_status = await async_redis_get(cache_key)
    
    user_data = None
    if cached_status:
        try:
            user_data = json.loads(cached_status)
        except Exception:
            user_data = None

    if user_data:
        # Check basic status without full DB user object yet
        if not user_data.get("is_active"):
            raise HTTPException(status_code=403, detail="User account is inactive")
        
        token_sv = payload.get("sv")
        if token_sv is not None and int(token_sv) != user_data.get("session_version"):
            raise HTTPException(status_code=401, detail="Session expired")
            
        # We still need the full user object for most routes, but some might only need ID/Role.
        # For now, we still fetch from DB if we need the full object, BUT we can optimize
        # by checking the status FIRST.
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Update cache if it was a miss or stale
    if not user_data:
        await async_redis_set(cache_key, json.dumps({
            "is_active": user.is_active,
            "session_version": user.session_version,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role)
        }), ex=60)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    token_session_version = payload.get("sv")
    if token_session_version is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    try:
        token_session_version_int = int(token_session_version)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        ) from exc

    if token_session_version_int != user.session_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    return user


async def get_current_patient(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are a patient"""
    if current_user.role.value != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this resource"
        )
    return current_user


async def get_current_provider(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are a provider"""
    if current_user.role.value not in ["provider", "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only providers can access this resource"
        )
    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "access provider resources")
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are an admin (regular or super)"""
    if current_user.role.value not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access this resource"
        )
    return current_user


async def get_current_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are a super admin"""
    if current_user.role.value != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can access this resource"
        )
    return current_user


async def get_current_pharmacist(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are a pharmacist"""
    if current_user.role.value not in ["pharmacist", "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only pharmacists can access this resource"
        )
    if current_user.role.value == "pharmacist":
        require_verified_workforce_member(current_user, "access pharmacist resources")
    return current_user
