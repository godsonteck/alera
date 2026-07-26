from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.routes.auth import login, logout
from app.schemas import LoginRequest
from app.utils.auth import create_access_token
from app.utils.time import utcnow
from main import app


def run(coro):
    return asyncio.run(coro)


def _request_for(path: str, *, method: str = "POST", ip: str = "203.0.113.10", user_agent: str = "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/124.0") -> Request:
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": [
                (b"user-agent", user_agent.encode("utf-8")),
                (b"x-forwarded-for", ip.encode("utf-8")),
            ],
            "client": (ip, 12345),
        }
    )


def _load_admin(db_session) -> User:
    user = db_session.query(User).filter(User.email == "admin@alera.health").first()
    assert user is not None
    return user


def _issue_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "sv": int(user.session_version or 0)})


def test_failed_login_attempt_is_audited(db_session):
    request = _request_for("/api/auth/login")

    with pytest.raises(HTTPException) as exc_info:
        run(login(LoginRequest(email="ghost@example.com", password="wrongpass1"), db_session, request=request))

    assert exc_info.value.status_code == 401

    log = db_session.query(AuditLog).filter(AuditLog.action == "auth.login.failed").order_by(AuditLog.created_at.desc()).first()
    assert log is not None
    assert log.ip_address == "203.0.113.10"
    assert "Chrome" in (log.device_info or "")
    assert log.status == "failed"


def test_logout_is_audited_with_session_metadata(db_session):
    admin = _load_admin(db_session)
    admin.last_login = utcnow()
    db_session.commit()

    request = _request_for("/api/auth/logout")
    run(logout(request=request, current_user=admin, db=db_session))

    log = db_session.query(AuditLog).filter(AuditLog.action == "auth.logout").order_by(AuditLog.created_at.desc()).first()
    assert log is not None
    assert log.user_id == admin.id
    assert log.status == "success"
    assert log.metadata_json is not None


def test_request_middleware_audits_authenticated_api_calls(db_session):
    admin = _load_admin(db_session)
    client = TestClient(app)

    response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {_issue_token(admin)}"},
    )

    assert response.status_code == 200

    log = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "api.get", AuditLog.request_path == "/api/users/me")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert log is not None
    assert log.user_id == admin.id
    assert log.status == "success"


def test_only_super_admin_can_view_audit_logs(db_session):
    admin = _load_admin(db_session)
    client = TestClient(app)

    admin_response = client.get("/api/audit", headers={"Authorization": f"Bearer {_issue_token(admin)}"})
    assert admin_response.status_code == 403

    admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(admin)

    super_response = client.get("/api/audit", headers={"Authorization": f"Bearer {_issue_token(admin)}"})
    assert super_response.status_code == 200
