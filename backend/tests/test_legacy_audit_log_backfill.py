from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import text

from database import Base, engine, init_db
from app.models.user import User, UserRole
from app.utils.auth import create_access_token
from main import app


def _issue_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "sv": int(user.session_version or 0)})


def _load_seeded_admin(db_session) -> User:
    admin = db_session.query(User).filter(User.email == "admin@alera.health").first()
    assert admin is not None
    admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(admin)
    return admin


def test_init_db_backfills_legacy_audit_rows_for_log_listing(db_session):
    admin = _load_seeded_admin(db_session)

    with engine.begin() as conn:
        conn.execute(text("DROP TABLE audit_logs"))
        conn.execute(
            text(
                """
                CREATE TABLE audit_logs (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER,
                    role VARCHAR(50),
                    action VARCHAR(255) NOT NULL,
                    resource VARCHAR(255),
                    resource_type VARCHAR(100),
                    resource_id VARCHAR(100),
                    old_value TEXT,
                    new_value TEXT,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    device_info TEXT,
                    metadata_json TEXT,
                    request_id VARCHAR(64),
                    request_method VARCHAR(16),
                    request_path VARCHAR(255),
                    duration_ms INTEGER,
                    reason VARCHAR(500),
                    severity VARCHAR(50),
                    status VARCHAR(50),
                    created_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO audit_logs (user_id, role, action, resource_type, severity, status, created_at)
                VALUES (:user_id, :role, :action, NULL, NULL, NULL, NULL)
                """
            ),
            {
                "user_id": admin.id,
                "role": "superadmin",
                "action": "legacy.event",
            },
        )

    init_db()

    client = TestClient(app)
    response = client.get("/api/audit", headers={"Authorization": f"Bearer {_issue_token(admin)}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
    row = next(item for item in payload["items"] if item["action"] == "legacy.event")
    assert row["role"] == "super_admin"
    assert row["resource_type"] == "system"
    assert row["status"] == "success"
    assert row["severity"] == "info"
    assert row["timestamp"]


def test_legacy_audit_rows_still_allow_summary_queries(db_session):
    admin = _load_seeded_admin(db_session)

    with engine.begin() as conn:
        conn.execute(text("DROP TABLE audit_logs"))
        conn.execute(
            text(
                """
                CREATE TABLE audit_logs (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER,
                    role VARCHAR(50),
                    action VARCHAR(255) NOT NULL,
                    resource VARCHAR(255),
                    resource_type VARCHAR(100),
                    resource_id VARCHAR(100),
                    old_value TEXT,
                    new_value TEXT,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    device_info TEXT,
                    metadata_json TEXT,
                    request_id VARCHAR(64),
                    request_method VARCHAR(16),
                    request_path VARCHAR(255),
                    duration_ms INTEGER,
                    reason VARCHAR(500),
                    severity VARCHAR(50),
                    status VARCHAR(50),
                    created_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO audit_logs (user_id, role, action, resource_type, severity, status, created_at)
                VALUES (:user_id, :role, :action, NULL, NULL, 'failed', NULL)
                """
            ),
            {
                "user_id": admin.id,
                "role": "superadmin",
                "action": "legacy.failed",
            },
        )

    init_db()

    client = TestClient(app)
    response = client.get("/api/audit/summary/overview", headers={"Authorization": f"Bearer {_issue_token(admin)}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_logs"] >= 1
    assert isinstance(payload["critical_events"], int)
