import logging
import time
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, model_validator
from database import get_db
from app.schemas import (
    LoginRequest,
    UserCreate,
    UserResponse,
    PasswordChangeRequest,
    PasswordResetRequest,
    PasswordResetConfirmRequest,
    EmailVerificationConfirmRequest,
)
from app.models.user import User, UserRole
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_user_id_from_payload,
    generate_secure_token,
    hash_token,
)
from app.utils.cookies import set_auth_cookies, clear_auth_cookies, set_csrf_token, clear_csrf_token
from app.utils.csrf import generate_csrf_token
from app.utils.dependencies import get_current_user
from app.utils.rate_limit import enforce_rate_limit
from app.services.email_service import EmailService
from app.utils.time import utcnow
from config import settings
from app.services.audit_service import client_ip_from_request, summarize_device_info, log_action
import sys
import httpx
from jose import JWTError, jwt

try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    HAS_GOOGLE_AUTH = True
except ImportError:
    HAS_GOOGLE_AUTH = False

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)
APPLE_JWKS_CACHE: dict[str, dict] = {}
APPLE_JWKS_CACHE_EXPIRES_AT = 0.0


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class DeleteAccountRequest(BaseModel):
    password: str


class OAuthRequest(BaseModel):
    credential: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class OAuthRegisterRequest(BaseModel):
    credential: str
    role: UserRole
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    specialty: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    @model_validator(mode="after")
    def validate_role_specific_fields(self):
        if self.role != UserRole.PATIENT:
            if not self.license_number or not self.license_state:
                raise ValueError("license_number and license_state are required for professional accounts")
        return self


def _frontend_link(path: str, token: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}?token={token}"


def _issue_email_verification_token(user: User) -> str:
    token = generate_secure_token()
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_expires_at = utcnow() + timedelta(hours=24)
    return token


def _issue_password_reset_token(user: User) -> str:
    token = generate_secure_token()
    user.password_reset_token_hash = hash_token(token)
    user.password_reset_expires_at = utcnow() + timedelta(hours=24)
    return token


def _build_token_pair(user: User) -> tuple[str, str]:
    session_version = int(user.session_version or 0)
    payload = {"sub": str(user.id), "sv": session_version}
    access_token = create_access_token(
        data=payload,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data=payload)
    return access_token, refresh_token


def _serialize_user(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


def _commit_or_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


async def _verify_apple_token(credential: str) -> dict:
    """Verify an Apple identity token against Apple's public signing keys."""
    if not settings.APPLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Apple Sign In is not configured on the server")
    global APPLE_JWKS_CACHE_EXPIRES_AT
    try:
        header = jwt.get_unverified_header(credential)
        if time.monotonic() >= APPLE_JWKS_CACHE_EXPIRES_AT:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get("https://appleid.apple.com/auth/keys")
                response.raise_for_status()
                keys = response.json().get("keys", [])
            if not isinstance(keys, list):
                raise ValueError("Apple signing keys response is invalid")
            APPLE_JWKS_CACHE.clear()
            APPLE_JWKS_CACHE.update({key["kid"]: key for key in keys if isinstance(key, dict) and key.get("kid")})
            APPLE_JWKS_CACHE_EXPIRES_AT = time.monotonic() + 3600
        key = APPLE_JWKS_CACHE.get(header.get("kid"))
        if not key:
            raise ValueError("Apple signing key not found")
        return jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer="https://appleid.apple.com",
        )
    except (ValueError, KeyError, JWTError, httpx.HTTPError) as error:
        logger.warning("Apple token validation failed: %s", error)
        raise HTTPException(status_code=401, detail="Invalid Apple token") from error


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    response: Response = None,
    request: Request = None,
):
    """Register a new user"""
    enforce_rate_limit(request=request, scope="auth:register", limit=5, window_seconds=10 * 60)

    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered"
        )

    if user_data.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created through public registration",
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    is_verified = user_data.role == UserRole.PATIENT
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        date_of_birth=user_data.date_of_birth,
        address=user_data.address,
        city=user_data.city,
        state=user_data.state,
        zip_code=user_data.zip_code,
        role=UserRole(user_data.role.value),
        license_number=user_data.license_number,
        specialty=user_data.specialty,
        license_state=user_data.license_state,
        is_verified=is_verified,
        email_verified=False,
        email_verified_at=None,
        is_active=True,
        session_version=0,
        notification_email=True,
        notification_sms=False,
        privacy_public_profile=False,
    )

    db.add(db_user)
    db.flush()

    if not db_user.email_verified:
        verification_token = _issue_email_verification_token(db_user)
        from app.utils.notification_utils import NotificationManager
        email_sent = await NotificationManager.send_verification_email(
            user=db_user,
            verification_link=_frontend_link("/verify-email", verification_token),
        )
        if not email_sent:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to deliver verification email right now. Please try again shortly.",
            )

    _commit_or_rollback(db)
    db.refresh(db_user)

    access_token, refresh_token = _build_token_pair(db_user)

    csrf_token = generate_csrf_token()
    if response is not None:
        # Set secure cookies
        set_auth_cookies(response, access_token, refresh_token)
        # Set CSRF token
        set_csrf_token(response, csrf_token)

    await log_action(
        db=db,
        user_id=db_user.id,
        action="auth.register",
        resource_type="user",
        resource_id=db_user.id,
        description=f"Registered account with role {db_user.role.value}",
        status="created",
    )

    return {
        "message": "Account created successfully",
        "user": _serialize_user(db_user),
        "csrf_token": csrf_token,
    }


@router.post("/login")
async def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db),
    response: Response = None,
    request: Request = None,
):
    """Authenticate user and return access token"""
    enforce_rate_limit(request=request, scope="auth:login", limit=10, window_seconds=60)

    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        await log_action(
            db=db,
            user_id=user.id if user else None,
            role=user.role.value if user and hasattr(user.role, "value") else (str(user.role) if user else None),
            action="auth.login.failed",
            resource="auth/session",
            resource_type="auth",
            status="failed",
            ip_address=client_ip_from_request(request),
            user_agent=request.headers.get("user-agent") if request else None,
            device_info=summarize_device_info(request.headers.get("user-agent")) if request else None,
            metadata={"email": credentials.email, "reason": "invalid_credentials"},
            error_message="Invalid email or password",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        await log_action(
            db=db,
            user_id=user.id,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            action="auth.login.failed",
            resource="auth/session",
            resource_type="auth",
            status="failed",
            ip_address=client_ip_from_request(request),
            user_agent=request.headers.get("user-agent") if request else None,
            device_info=summarize_device_info(request.headers.get("user-agent")) if request else None,
            metadata={"email": credentials.email, "reason": "inactive_account"},
            error_message="User account is disabled",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    user.last_login = utcnow()
    db.commit()
    db.refresh(user)

    # Create tokens
    access_token, refresh_token = _build_token_pair(user)

    csrf_token = generate_csrf_token()
    if response is not None:
        # Set secure cookies
        set_auth_cookies(response, access_token, refresh_token)
        # Set CSRF token
        set_csrf_token(response, csrf_token)

    await log_action(
        db=db,
        user_id=user.id,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        action="auth.login",
        resource="auth/session",
        resource_type="auth",
        resource_id=user.id,
        description="Successful login",
        status="success",
        ip_address=client_ip_from_request(request),
        user_agent=request.headers.get("user-agent") if request else None,
        device_info=summarize_device_info(request.headers.get("user-agent")) if request else None,
        metadata={"event": "login_success"},
    )
    
    return {
        "message": "Login successful",
        "user": _serialize_user(user),
        "csrf_token": csrf_token,
    }


@router.post("/oauth/google")
async def oauth_google(
    payload: OAuthRequest,
    db: Session = Depends(get_db),
    response: Response = None,
    request: Request = None,
):
    """Authenticate or register user via Google OAuth"""
    enforce_rate_limit(request=request, scope="auth:oauth", limit=10, window_seconds=60)
    
    if not HAS_GOOGLE_AUTH:
        raise HTTPException(status_code=500, detail="google-auth library is not installed")
        
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Auth is not configured on the server. Please set GOOGLE_CLIENT_ID in environment variables.",
        )
        
    try:
        # Verify the token
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="No email provided by Google")
            
        # Find user
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # User doesn't exist, return needs_registration
            first_name = idinfo.get("given_name", "")
            last_name = idinfo.get("family_name", "")
            
            return {
                "message": "User not found. Please complete registration.",
                "needs_registration": True,
                "google_data": {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "credential": payload.credential,
                }
            }
            
        elif not user.is_active:
            raise HTTPException(status_code=403, detail="User account is disabled")
            
        user.last_login = utcnow()
        _commit_or_rollback(db)
        
        # Create tokens
        access_token, refresh_token = _build_token_pair(user)
        csrf_token = generate_csrf_token()
        
        if response is not None:
            set_auth_cookies(response, access_token, refresh_token)
            set_csrf_token(response, csrf_token)
            
        await log_action(
            db=db,
            user_id=user.id,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            action="auth.oauth_login",
            resource="auth/session",
            resource_type="auth",
            resource_id=user.id,
            description="Successful Google OAuth login",
            status="success",
            ip_address=client_ip_from_request(request),
            user_agent=request.headers.get("user-agent") if request else None,
            device_info=summarize_device_info(request.headers.get("user-agent")) if request else None,
            metadata={"provider": "google"},
        )
        
        return {
            "message": "Login successful",
            "user": _serialize_user(user),
            "csrf_token": csrf_token,
        }
        
    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google token")


@router.post("/oauth/google/register")
async def oauth_google_register(
    payload: OAuthRegisterRequest,
    db: Session = Depends(get_db),
    response: Response = None,
    request: Request = None,
):
    """Register a new user via Google OAuth with additional details"""
    enforce_rate_limit(request=request, scope="auth:oauth_register", limit=5, window_seconds=60)
    
    if not HAS_GOOGLE_AUTH:
        raise HTTPException(status_code=500, detail="google-auth library is not installed")
        
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Auth is not configured on the server. Please set GOOGLE_CLIENT_ID in environment variables.",
        )
        
    try:
        # Verify the token
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="No email provided by Google")
            
        # Check if user already exists
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            raise HTTPException(status_code=400, detail="User already exists with this email")
            
        # Register new user
        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")
        
        # Generate a random strong password for the user since they are using OAuth
        hashed_password = hash_password(generate_secure_token() + "Aa1!")
        
        is_verified = payload.role == UserRole.PATIENT
        
        user = User(
            email=email,
            username=email.split("@")[0], # basic default username
            hashed_password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            phone=payload.phone,
            address=payload.address,
            city=payload.city,
            state=payload.state,
            zip_code=payload.zip_code,
            license_number=payload.license_number,
            license_state=payload.license_state,
            specialty=payload.specialty,
            role=payload.role,
            is_verified=is_verified,
            email_verified=True,
            email_verified_at=utcnow(),
            is_active=True,
            session_version=0,
            notification_email=True,
            notification_sms=False,
            privacy_public_profile=False,
        )
        db.add(user)
        _commit_or_rollback(db)
        db.refresh(user)
        
        await log_action(
            db=db,
            user_id=user.id,
            action="auth.oauth_register",
            resource_type="user",
            resource_id=user.id,
            description=f"Registered account via Google with role {user.role.value}",
            status="created",
        )
        
        user.last_login = utcnow()
        _commit_or_rollback(db)
        
        # Create tokens
        access_token, refresh_token = _build_token_pair(user)
        csrf_token = generate_csrf_token()
        
        if response is not None:
            set_auth_cookies(response, access_token, refresh_token)
            set_csrf_token(response, csrf_token)
            
        return {
            "message": "Registration and login successful",
            "user": _serialize_user(user),
            "csrf_token": csrf_token,
        }
        
    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google token")


@router.post("/oauth/apple")
async def oauth_apple(
    payload: OAuthRequest,
    db: Session = Depends(get_db),
    response: Response = None,
    request: Request = None,
):
    """Authenticate an existing user or begin Apple account registration."""
    enforce_rate_limit(request=request, scope="auth:oauth", limit=10, window_seconds=60)
    claims = await _verify_apple_token(payload.credential)
    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Apple did not provide an email address")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {
            "message": "User not found. Please complete registration.",
            "needs_registration": True,
            "apple_data": {
                "email": email,
                "first_name": payload.first_name or "",
                "last_name": payload.last_name or "",
                "credential": payload.credential,
            },
        }
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")

    user.last_login = utcnow()
    _commit_or_rollback(db)
    access_token, refresh_token = _build_token_pair(user)
    csrf_token = generate_csrf_token()
    if response is not None:
        set_auth_cookies(response, access_token, refresh_token)
        set_csrf_token(response, csrf_token)
    await log_action(
        db=db, user_id=user.id, role=user.role.value if hasattr(user.role, "value") else str(user.role),
        action="auth.oauth_login", resource="auth/session", resource_type="auth", resource_id=user.id,
        description="Successful Apple OAuth login", status="success", ip_address=client_ip_from_request(request),
        user_agent=request.headers.get("user-agent") if request else None,
        device_info=summarize_device_info(request.headers.get("user-agent")) if request else None,
        metadata={"provider": "apple"},
    )
    return {"message": "Login successful", "user": _serialize_user(user), "csrf_token": csrf_token}


@router.post("/oauth/apple/register")
async def oauth_apple_register(
    payload: OAuthRegisterRequest,
    db: Session = Depends(get_db),
    response: Response = None,
    request: Request = None,
):
    """Create an account from a verified Apple identity token."""
    enforce_rate_limit(request=request, scope="auth:oauth_register", limit=5, window_seconds=60)
    claims = await _verify_apple_token(payload.credential)
    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Apple did not provide an email address")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="User already exists with this email")

    user = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password(generate_secure_token() + "Aa1!"),
        first_name=payload.first_name or "",
        last_name=payload.last_name or "",
        phone=payload.phone,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        zip_code=payload.zip_code,
        license_number=payload.license_number,
        license_state=payload.license_state,
        specialty=payload.specialty,
        role=payload.role,
        is_verified=payload.role == UserRole.PATIENT,
        email_verified=True,
        email_verified_at=utcnow(),
        is_active=True,
        session_version=0,
        notification_email=True,
        notification_sms=False,
        privacy_public_profile=False,
    )
    db.add(user)
    _commit_or_rollback(db)
    db.refresh(user)
    user.last_login = utcnow()
    _commit_or_rollback(db)
    access_token, refresh_token = _build_token_pair(user)
    csrf_token = generate_csrf_token()
    if response is not None:
        set_auth_cookies(response, access_token, refresh_token)
        set_csrf_token(response, csrf_token)
    await log_action(
        db=db, user_id=user.id, action="auth.oauth_register", resource_type="user", resource_id=user.id,
        description=f"Registered account via Apple with role {user.role.value}", status="created", metadata={"provider": "apple"},
    )
    return {"message": "Registration and login successful", "user": _serialize_user(user), "csrf_token": csrf_token}


@router.post("/request-password-reset")
async def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Send a password reset email if the account exists."""
    enforce_rate_limit(request=request, scope="auth:password-reset-request", limit=5, window_seconds=60 * 60)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.is_active:
        return {"message": "If an account with that email exists, a reset link has been sent."}

    reset_token = _issue_password_reset_token(user)
    from app.utils.notification_utils import NotificationManager
    email_sent = await NotificationManager.send_password_reset_email(
        user=user,
        reset_link=_frontend_link("/reset-password", reset_token),
    )
    if not email_sent:
        db.rollback()
        logger.warning(
            "Password reset email could not be delivered for user_id=%s",
            user.id,
        )
        return {"message": "If an account with that email exists, a reset link has been sent."}

    _commit_or_rollback(db)
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Reset a password using a recovery token."""
    enforce_rate_limit(request=request, scope="auth:password-reset-confirm", limit=10, window_seconds=60 * 60)

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
        )

    token_hash = hash_token(payload.token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()
    if (
        not user
        or not user.is_active
        or not user.password_reset_expires_at
        or user.password_reset_expires_at < utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.session_version = int(user.session_version or 0) + 1
    _commit_or_rollback(db)

    # Invalidate Redis status cache
    from app.utils.redis import async_redis_delete
    await async_redis_delete(f"user:{user.id}:status")

    await log_action(
        db=db,
        user_id=user.id,
        action="auth.reset_password",
        resource_type="user",
        resource_id=user.id,
        description="Password reset completed and sessions revoked",
        status="success",
    )

    return {"message": "Password reset successfully"}


@router.post("/verify-email")
async def verify_email(
    payload: EmailVerificationConfirmRequest,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Verify a user's email address using a link token."""
    enforce_rate_limit(request=request, scope="auth:verify-email", limit=10, window_seconds=60 * 60)

    token_hash = hash_token(payload.token)
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()
    if (
        not user
        or not user.is_active
        or not user.email_verification_expires_at
        or user.email_verification_expires_at < utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user.email_verified = True
    user.email_verified_at = utcnow()
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    _commit_or_rollback(db)

    await log_action(
        db=db,
        user_id=user.id,
        action="auth.verify_email",
        resource_type="user",
        resource_id=user.id,
        description="Email address verified",
        status="success",
    )

    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_email_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Resend the current user's verification email."""
    enforce_rate_limit(request=request, scope="auth:resend-verification", limit=5, window_seconds=60 * 60)

    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN) or current_user.email_verified:
        return {"message": "Email is already verified"}

    verification_token = _issue_email_verification_token(current_user)
    from app.utils.notification_utils import NotificationManager
    email_sent = await NotificationManager.send_verification_email(
        user=current_user,
        verification_link=_frontend_link("/verify-email", verification_token),
    )
    if not email_sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to deliver verification email right now. Please try again shortly.",
        )

    _commit_or_rollback(db)

    await log_action(
        db=db,
        user_id=current_user.id,
        action="auth.resend_verification",
        resource_type="user",
        resource_id=current_user.id,
        description="Resent email verification link",
        status="success",
    )

    return {"message": "Verification email sent"}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Refresh access token using refresh token from cookie"""
    enforce_rate_limit(request=request, scope="auth:refresh", limit=30, window_seconds=60)

    from app.utils.auth import decode_token

    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )

    token_payload = decode_token(refresh_token)

    if token_payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = get_user_id_from_payload(token_payload)
    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    token_session_version = token_payload.get("sv")
    try:
        token_session_version_int = int(token_session_version)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if token_session_version_int != user.session_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    # Create new access token
    access_token = create_access_token(
        data={"sub": str(user.id), "sv": int(user.session_version or 0)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # Set new access token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    # Set new CSRF token
    csrf_token = generate_csrf_token()
    set_csrf_token(response, csrf_token)
    
    return {
        "message": "Token refreshed successfully",
        "csrf_token": csrf_token,
    }


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""

    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password"
        )
    
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match"
        )

    # Hash and update password
    current_user.hashed_password = hash_password(request.new_password)
    current_user.session_version = int(current_user.session_version or 0) + 1
    _commit_or_rollback(db)
    db.refresh(current_user)

    # Invalidate Redis status cache
    from app.utils.redis import async_redis_delete
    await async_redis_delete(f"user:{current_user.id}:status")

    await log_action(
        db=db,
        user_id=current_user.id,
        action="auth.change_password",
        resource_type="user",
        resource_id=current_user.id,
        description="Password changed and sessions revoked",
        status="success",
    )

    return {"message": "Password changed successfully"}


@router.post("/logout")
async def logout(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Logout user by revoking the current session version and clearing cookies."""

    current_user.session_version = int(current_user.session_version or 0) + 1
    _commit_or_rollback(db)

    # Invalidate Redis status cache
    from app.utils.redis import async_redis_delete
    await async_redis_delete(f"user:{current_user.id}:status")

    if response is not None:
        clear_auth_cookies(response)
        clear_csrf_token(response)

    await log_action(
        db=db,
        user_id=current_user.id,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        action="auth.logout",
        resource="auth/session",
        resource_type="auth",
        resource_id=current_user.id,
        description="Session revoked on logout",
        status="success",
        ip_address=client_ip_from_request(request),
        user_agent=request.headers.get("user-agent") if request else None,
        device_info=summarize_device_info(request.headers.get("user-agent")) if request else None,
        metadata={
            "session_duration_seconds": max(0, int((utcnow() - current_user.last_login).total_seconds())) if current_user.last_login else None,
        },
    )

    return {"message": "Logged out successfully"}


@router.post("/delete-account")
async def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft deactivate the current account and revoke sessions."""

    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    current_user.is_active = False
    current_user.session_version = int(current_user.session_version or 0) + 1
    _commit_or_rollback(db)

    # Invalidate Redis status cache
    from app.utils.redis import async_redis_delete
    await async_redis_delete(f"user:{current_user.id}:status")

    await log_action(
        db=db,
        user_id=current_user.id,
        action="auth.delete_account",
        resource_type="user",
        resource_id=current_user.id,
        description="Account soft-deactivated and sessions revoked",
        status="success",
    )

    return {"message": "Account deactivated successfully"}


sys.modules.setdefault("app.routes.auth", sys.modules[__name__])
sys.modules.setdefault("backend.app.routes.auth", sys.modules[__name__])
