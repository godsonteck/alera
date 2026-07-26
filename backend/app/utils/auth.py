from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from importlib.metadata import PackageNotFoundError, version as package_version
import hashlib
import secrets
from config import settings
from fastapi import HTTPException, status, Request

try:
    import argon2

    # Passlib still inspects argon2.__version__, which now emits a deprecation warning.
    # Seed the module attribute from package metadata before Passlib touches it.
    argon2.__version__ = package_version("argon2-cffi")
except (ImportError, PackageNotFoundError):
    pass

# Password hashing - use argon2 for modern password verification
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def validate_password_strength(password: str) -> str:
    """Enforce a baseline password policy for all credential-setting flows."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isalpha() for c in password):
        raise ValueError("Password must contain at least one letter")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one digit")
    return password


def hash_password(password: str) -> str:
    """Hash a password using argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        raw_sub = payload.get("sub")
        if not isinstance(raw_sub, (str, int)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def get_token_from_request(request: Request | None) -> str | None:
    if request is None:
        return None

    authorization = request.headers.get("Authorization")
    if authorization:
        scheme, _, token_value = authorization.partition(" ")
        if scheme.lower() == "bearer" and token_value:
            return token_value.strip()

    return request.cookies.get("access_token")


def _extract_subject_as_int(payload: dict) -> int:
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    if isinstance(raw_sub, int):
        return raw_sub

    if isinstance(raw_sub, str):
        try:
            return int(raw_sub)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token subject"
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token subject"
    )


def get_user_id_from_token(token: str) -> int:
    """Extract user ID from token"""
    payload = decode_token(token)
    return _extract_subject_as_int(payload)


def get_user_id_from_payload(payload: dict) -> int:
    """Extract user ID from a decoded JWT payload."""
    return _extract_subject_as_int(payload)


def generate_secure_token() -> str:
    """Generate a high-entropy random token for recovery flows."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a recovery token for storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
