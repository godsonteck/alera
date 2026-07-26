from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import text

from database import engine, init_db
from app.models.user import User
from app.utils.auth import create_access_token
from app.utils.time import utcnow
from main import app


def _issue_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "sv": int(user.session_version or 0)})


def _load_seeded_admin(db_session) -> User:
    admin = db_session.query(User).filter(User.email == "admin@alera.health").first()
    assert admin is not None
    return admin


def _insert_legacy_user(*, email: str, username: str, role: str) -> int:
    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                INSERT INTO users (
                    email,
                    username,
                    hashed_password,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    is_verified,
                    email_verified,
                    session_version,
                    notification_email,
                    notification_sms,
                    privacy_public_profile,
                    live_location_sharing_enabled,
                    created_at,
                    updated_at
                ) VALUES (
                    :email,
                    :username,
                    :hashed_password,
                    :first_name,
                    :last_name,
                    :role,
                    :is_active,
                    :is_verified,
                    :email_verified,
                    :session_version,
                    :notification_email,
                    :notification_sms,
                    :privacy_public_profile,
                    :live_location_sharing_enabled,
                    :created_at,
                    :updated_at
                )
                """
            ),
            {
                "email": email,
                "username": username,
                "hashed_password": "legacy-hash",
                "first_name": "Legacy",
                "last_name": "User",
                "role": role,
                "is_active": True,
                "is_verified": True,
                "email_verified": True,
                "session_version": 0,
                "notification_email": True,
                "notification_sms": False,
                "privacy_public_profile": False,
                "live_location_sharing_enabled": False,
                "created_at": utcnow(),
                "updated_at": utcnow(),
            },
        )
        return int(result.lastrowid)


def test_init_db_normalizes_legacy_role_aliases_for_admin_user_listing(db_session):
    admin = _load_seeded_admin(db_session)
    _insert_legacy_user(email="legacy.doctor@alera.health", username="legacydoctor", role="Doctor")
    _insert_legacy_user(email="legacy.pharmacy@alera.health", username="legacypharmacy", role="PHARMACY")

    init_db()

    client = TestClient(app)
    response = client.get("/api/admin/users/", headers={"Authorization": f"Bearer {_issue_token(admin)}"})

    assert response.status_code == 200
    roles_by_email = {row["email"]: row["role"] for row in response.json()}
    assert roles_by_email["legacy.doctor@alera.health"] == "provider"
    assert roles_by_email["legacy.pharmacy@alera.health"] == "pharmacist"


def test_init_db_normalizes_legacy_roles_before_serializing_linked_accounts(db_session):
    admin = _load_seeded_admin(db_session)
    legacy_linked_user_id = _insert_legacy_user(
        email="legacy.linked@alera.health",
        username="legacylinked",
        role="pharmacy",
    )

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO linked_accounts (
                    primary_user_id,
                    linked_user_id,
                    link_type,
                    created_at
                ) VALUES (
                    :primary_user_id,
                    :linked_user_id,
                    :link_type,
                    :created_at
                )
                """
            ),
            {
                "primary_user_id": admin.id,
                "linked_user_id": legacy_linked_user_id,
                "link_type": "same_person",
                "created_at": utcnow(),
            },
        )

    init_db()

    client = TestClient(app)
    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {_issue_token(admin)}"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["has_linked_account"] is True
    assert payload["linked_accounts"][0]["role"] == "pharmacist"


def test_init_db_normalizes_legacy_roles_before_profile_updates(db_session):
    admin = _load_seeded_admin(db_session)
    legacy_linked_user_id = _insert_legacy_user(
        email="legacy.profile@alera.health",
        username="legacyprofile",
        role="doctor",
    )

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO linked_accounts (
                    primary_user_id,
                    linked_user_id,
                    link_type,
                    created_at
                ) VALUES (
                    :primary_user_id,
                    :linked_user_id,
                    :link_type,
                    :created_at
                )
                """
            ),
            {
                "primary_user_id": admin.id,
                "linked_user_id": legacy_linked_user_id,
                "link_type": "same_person",
                "created_at": utcnow(),
            },
        )

    init_db()

    client = TestClient(app)
    response = client.put(
        "/api/users/me",
        headers={"Authorization": f"Bearer {_issue_token(admin)}"},
        json={"first_name": "Manuel", "last_name": "Super Admin"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["first_name"] == "Manuel"
    assert payload["linked_accounts"][0]["role"] == "provider"
