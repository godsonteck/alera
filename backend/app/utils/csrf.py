import secrets
from typing import Optional
from fastapi import Request, HTTPException, status


def generate_csrf_token() -> str:
    """Generate a secure CSRF token"""
    return secrets.token_urlsafe(32)


def validate_csrf_token(request: Request, token: Optional[str] = None) -> bool:
    """Validate CSRF token from request"""
    if not token:
        # Try to get from header first, then form data
        token = request.headers.get("X-CSRF-Token") or request.headers.get("X-XSRF-Token")

    if not token:
        # For form submissions, check form data
        if hasattr(request, 'form') and request.form:
            token = request.form.get("csrf_token")

    if not token:
        return False

    # Get token from cookie for validation
    cookie_token = request.cookies.get("csrf_token")
    if not cookie_token:
        return False

    return secrets.compare_digest(token, cookie_token)


def require_csrf(request: Request) -> None:
    """Require valid CSRF token for state-changing operations"""
    if not validate_csrf_token(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token validation failed"
        )
