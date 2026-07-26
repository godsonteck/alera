from fastapi import Response
from datetime import timedelta
from config import settings


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """Set secure httpOnly cookies for authentication tokens"""

    # Access token cookie - short lived
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",  # Allow cross-site requests for API calls
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    # Refresh token cookie - long lived
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth/refresh",  # Only sent to refresh endpoint
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear authentication cookies"""

    response.delete_cookie(
        key="access_token",
        path="/",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )

    response.delete_cookie(
        key="refresh_token",
        path="/api/auth/refresh",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )


def set_csrf_token(response: Response, csrf_token: str) -> None:
    """Set CSRF token cookie for frontend protection"""

    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # Frontend needs to read this
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=60 * 60,  # 1 hour
        path="/",
    )


def clear_csrf_token(response: Response) -> None:
    """Clear CSRF token cookie"""

    response.delete_cookie(
        key="csrf_token",
        path="/",
        secure=settings.COOKIE_SECURE,
        httponly=False,
        samesite="lax",
    )