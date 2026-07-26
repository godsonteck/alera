from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.utils.auth import create_access_token, hash_password
from app.utils.time import utcnow
from main import app


def _issue_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "sv": int(user.session_version or 0)})


def _create_user(db_session, *, email: str, username: str, password: str, role: UserRole, verified: bool = True) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        first_name=username.capitalize(),
        last_name="User",
        role=role,
        is_active=True,
        is_verified=verified,
        email_verified=True,
        email_verified_at=utcnow(),
        session_version=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_provider_and_patient_accounts_can_exist_separately(db_session):
    provider = _create_user(
        db_session,
        email="doctor@alera.health",
        username="doctor",
        password="DoctorPass123",
        role=UserRole.PROVIDER,
    )
    patient = _create_user(
        db_session,
        email="doctor.personal@alera.health",
        username="doctor.patient",
        password="PatientPass123",
        role=UserRole.PATIENT,
    )

    assert provider.id != patient.id
    assert provider.role == UserRole.PROVIDER
    assert patient.role == UserRole.PATIENT


def test_link_provider_account_to_patient_account(db_session):
    client = TestClient(app)
    provider = _create_user(
        db_session,
        email="doctor@alera.health",
        username="doctor",
        password="DoctorPass123",
        role=UserRole.PROVIDER,
    )
    patient = _create_user(
        db_session,
        email="doctor.personal@alera.health",
        username="doctor.patient",
        password="PatientPass123",
        role=UserRole.PATIENT,
    )

    response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
        json={
            "current_password": "DoctorPass123",
            "linked_email": patient.email,
            "linked_password": "PatientPass123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["has_linked_account"] is True
    assert len(body["linked_accounts"]) == 1
    assert body["linked_accounts"][0]["id"] == patient.id
    assert body["linked_accounts"][0]["role"] == "patient"

    me_response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
    )
    assert me_response.status_code == 200
    me_body = me_response.json()
    assert me_body["has_linked_account"] is True
    assert me_body["linked_accounts"][0]["id"] == patient.id

    audit_actions = {
        row.action
        for row in db_session.query(AuditLog)
        .filter(AuditLog.user_id == provider.id)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    }
    assert "account_link.requested" in audit_actions
    assert "account_link.completed" in audit_actions


def test_link_account_to_itself_fails(db_session):
    client = TestClient(app)
    provider = _create_user(
        db_session,
        email="doctor@alera.health",
        username="doctor",
        password="DoctorPass123",
        role=UserRole.PROVIDER,
    )

    response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
        json={
            "current_password": "DoctorPass123",
            "linked_email": provider.email,
            "linked_password": "DoctorPass123",
        },
    )

    assert response.status_code == 400
    assert "cannot link an account to itself" in response.json()["detail"].lower()


def test_link_two_accounts_with_same_role_fails(db_session):
    client = TestClient(app)
    first_provider = _create_user(
        db_session,
        email="doctor.one@alera.health",
        username="doctor.one",
        password="DoctorPass123",
        role=UserRole.PROVIDER,
    )
    second_provider = _create_user(
        db_session,
        email="doctor.two@alera.health",
        username="doctor.two",
        password="DoctorPass456",
        role=UserRole.PROVIDER,
    )

    response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(first_provider)}"},
        json={
            "current_password": "DoctorPass123",
            "linked_email": second_provider.email,
            "linked_password": "DoctorPass456",
        },
    )

    assert response.status_code == 400
    assert "different roles" in response.json()["detail"].lower()


def test_duplicate_or_reused_link_fails(db_session):
    client = TestClient(app)
    provider = _create_user(
        db_session,
        email="doctor@alera.health",
        username="doctor",
        password="DoctorPass123",
        role=UserRole.PROVIDER,
    )
    patient = _create_user(
        db_session,
        email="doctor.personal@alera.health",
        username="doctor.patient",
        password="PatientPass123",
        role=UserRole.PATIENT,
    )
    extra_patient = _create_user(
        db_session,
        email="doctor.other@alera.health",
        username="doctor.other",
        password="PatientPass456",
        role=UserRole.PATIENT,
    )

    first_response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
        json={
            "current_password": "DoctorPass123",
            "linked_email": patient.email,
            "linked_password": "PatientPass123",
        },
    )
    assert first_response.status_code == 201

    duplicate_response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
        json={
            "current_password": "DoctorPass123",
            "linked_email": patient.email,
            "linked_password": "PatientPass123",
        },
    )
    assert duplicate_response.status_code == 400

    reused_response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(extra_patient)}"},
        json={
            "current_password": "PatientPass456",
            "linked_email": provider.email,
            "linked_password": "DoctorPass123",
        },
    )
    assert reused_response.status_code == 400
    assert "already linked" in reused_response.json()["detail"].lower()


def test_provider_still_cannot_access_patient_only_routes(db_session):
    client = TestClient(app)
    provider = _create_user(
        db_session,
        email="doctor@alera.health",
        username="doctor",
        password="DoctorPass123",
        role=UserRole.PROVIDER,
    )
    patient = _create_user(
        db_session,
        email="doctor.personal@alera.health",
        username="doctor.patient",
        password="PatientPass123",
        role=UserRole.PATIENT,
    )
    other_provider = _create_user(
        db_session,
        email="doctor.peer@alera.health",
        username="doctor.peer",
        password="DoctorPass456",
        role=UserRole.PROVIDER,
    )

    link_response = client.post(
        "/api/account-links",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
        json={
            "current_password": "DoctorPass123",
            "linked_email": patient.email,
            "linked_password": "PatientPass123",
        },
    )
    assert link_response.status_code == 201

    provider_patient_route = client.post(
        "/api/telemedicine/video-calls/",
        headers={"Authorization": f"Bearer {_issue_token(provider)}"},
        json={"provider_id": other_provider.id, "reason_for_call": "Need care"},
    )
    patient_patient_route = client.post(
        "/api/telemedicine/video-calls/",
        headers={"Authorization": f"Bearer {_issue_token(patient)}"},
        json={"provider_id": other_provider.id, "reason_for_call": "Need care"},
    )

    assert provider_patient_route.status_code == 403
    assert patient_patient_route.status_code == 201
