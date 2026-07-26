from __future__ import annotations

import asyncio
from io import BytesIO
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.models import PatientDocument
from app.models.additional_features import DocumentType
from app.models.ambulance import AmbulanceRequest, AmbulanceRequestStatus, EmergencyPriority
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.lab_imaging import ImagingScan, ImagingScanStatus, LabTest, LabTestStatus
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.routes.imaging import download_imaging_asset, download_imaging_report, upload_imaging_results
from app.routes.admin import approve_provider, deactivate_user, list_verifications
from app.routes.admin import change_user_role
from app.routes.appointments import create_appointment, get_appointment, list_appointments
from app.routes.audit import get_data_retention_policy
from app.routes.auth import (
    change_password,
    login,
    logout,
    register,
    request_password_reset,
    resend_email_verification,
    reset_password,
    verify_email,
)
from app.services.email_service import EmailService
from app.routes.consents import create_consent, list_consents
from app.routes.documents import get_document, get_patient_documents, list_documents
from app.routes.notifications import get_notification
from app.routes.reminders_templates import create_reminder, list_reminders
from app.routes.users import get_user, list_accessible_users, list_doctors, list_users
from app.schemas import (
    AppointmentCreate,
    EmailVerificationConfirmRequest,
    LoginRequest,
    PasswordChangeRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    UserCreate,
)
from app.schemas.additional_features import AppointmentReminderCreate, PatientConsentCreate
from app.utils.access import WORKFORCE_ROLES, normalized_enum_text
from app.utils.dependencies import get_current_user
from app.utils.db_types import enum_value_renames
from app.utils.auth import create_access_token
from app.utils.time import utcnow
from database import SessionLocal
import database
from main import app


ADMIN_EMAIL = "admin@alera.health"
ADMIN_PASSWORD = "admin_alera_2026!"
ADMIN_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MgbgnJPyvteaE+L8v5cS4g$VBM/CZaZX34GJGv5NjCI4oQQYqFf/BSbAoqGW4nVjRc"


def auth_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def issue_access_token_for_user(user: User) -> str:
    return create_access_token({"sub": str(user.id), "sv": int(user.session_version or 0)})


def run(coro):
    return asyncio.run(coro)


def extract_token(link: str) -> str:
    query = parse_qs(urlparse(link).query)
    token = query.get("token", [None])[0]
    assert token
    return token


def load_user(db_session, email: str) -> User:
    user = db_session.query(User).filter(User.email == email).first()
    assert user is not None
    return user


def load_user_by_id(db_session, user_id: int) -> User:
    user = db_session.query(User).filter(User.id == user_id).first()
    assert user is not None
    return user


def seed_document(db_session, *, patient_id: int, uploaded_by: int, is_private: bool = False) -> PatientDocument:
    document = PatientDocument(
        id=f"doc-{patient_id}-{uploaded_by}",
        patient_id=patient_id,
        file_id=f"file-{patient_id}-{uploaded_by}",
        filename="summary.pdf",
        file_type=DocumentType.CLINICAL_NOTE,
        file_size=1024,
        mime_type="application/pdf",
        description="Clinical summary",
        uploaded_by=uploaded_by,
        is_private=is_private,
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    return document


def seed_user(
    db_session,
    *,
    email: str,
    role: UserRole,
    first_name: str,
    last_name: str,
    is_verified: bool = True,
) -> User:
    user = User(
        email=email,
        username=email.split("@", 1)[0],
        hashed_password=ADMIN_PASSWORD_HASH,
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=True,
        is_verified=is_verified,
        email_verified=True,
        email_verified_at=utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def seed_imaging_scan(db_session, *, patient_id: int, ordered_by: int, center_id: int) -> ImagingScan:
    scan = ImagingScan(
        patient_id=patient_id,
        ordered_by=ordered_by,
        destination_provider_id=center_id,
        scan_type="MRI",
        body_part="Head",
        clinical_indication="Headache",
        status=ImagingScanStatus.ORDERED,
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)
    return scan


def _make_email_capture():
    captured: dict[str, list[str]] = {"verification": [], "reset": []}

    async def send_verification_email(recipient_email: str, recipient_name: str, verification_link: str):
        captured["verification"].append(verification_link)

    async def send_password_reset(recipient_email: str, recipient_name: str, reset_link: str):
        captured["reset"].append(reset_link)

    return captured, send_verification_email, send_password_reset


def test_public_registration_rejects_admin_and_verifies_patients_by_default(db_session):
    admin_request = UserCreate.model_construct(
        email="selfadmin@example.com",
        username="selfadmin",
        first_name="Self",
        last_name="Admin",
        password="password123",
        role="admin",
    )

    with pytest.raises(HTTPException) as exc_info:
        run(register(admin_request, db_session))

    assert exc_info.value.status_code == 403

    result = run(register(
        UserCreate(
            email="patient@example.com",
            username="patient",
            first_name="Pat",
            last_name="Ient",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    user = result["user"]
    assert user.role == "patient"
    assert user.is_verified is True
    assert user.is_active is True


def test_admin_accounts_are_backfilled_as_verified(db_session):
    admin = load_user(db_session, ADMIN_EMAIL)
    admin.email_verified = False
    admin.email_verified_at = None
    admin.is_verified = False
    admin.email_verification_token_hash = "stale-token"
    admin.email_verification_expires_at = utcnow() + timedelta(hours=1)
    db_session.commit()

    database._patch_admin_accounts_email_verified()
    db_session.refresh(admin)

    assert admin.email_verified is True
    assert admin.email_verified_at is not None
    assert admin.is_verified is True
    assert admin.email_verification_token_hash is None
    assert admin.email_verification_expires_at is None


def test_enum_value_renames_detect_legacy_uppercase_labels():
    renames = enum_value_renames(
        ["PATIENT", "PROVIDER", "ADMIN"],
        ["patient", "provider", "admin"],
    )

    assert renames == [
        ("PATIENT", "patient"),
        ("PROVIDER", "provider"),
        ("ADMIN", "admin"),
    ]


def test_missing_postgres_enum_labels_detects_new_roles():
    missing = database._missing_postgres_enum_labels(
        ["patient", "provider", "pharmacist", "admin", "super_admin"],
        ["patient", "provider", "pharmacist", "admin", "super_admin", "hospital", "laboratory", "imaging", "ambulance"],
    )

    assert missing == ["hospital", "laboratory", "imaging", "ambulance"]


def test_production_skips_default_admin_seeding_without_explicit_credentials(monkeypatch):
    monkeypatch.setattr("database.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("database.settings.DATABASE_URL", "postgresql://localhost/db")
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("SUPER_ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("SUPER_ADMIN_PASSWORD", raising=False)

    assert database._should_seed_default_admin_accounts() is False


def test_super_admin_can_list_and_view_users(db_session):
    super_admin = load_user(db_session, ADMIN_EMAIL)
    super_admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(super_admin)

    patient = seed_user(
        db_session,
        email="audited-patient@example.com",
        role=UserRole.PATIENT,
        first_name="Audited",
        last_name="Patient",
    )

    users = run(list_users(current_user=super_admin, db=db_session, skip=0, limit=500))
    fetched = run(get_user(user_id=patient.id, current_user=super_admin, db=db_session))
    accessible = run(list_accessible_users(current_user=super_admin, db=db_session))

    assert any(user.id == patient.id for user in users)
    assert fetched.id == patient.id
    assert any(user.id == patient.id for user in accessible)


def test_patient_accessible_directory_and_doctors_include_verified_physiotherapists(db_session):
    patient = seed_user(
        db_session,
        email="directory-patient@example.com",
        role=UserRole.PATIENT,
        first_name="Directory",
        last_name="Patient",
    )
    physiotherapist = seed_user(
        db_session,
        email="physio@example.com",
        role=UserRole.PHYSIOTHERAPIST,
        first_name="Physio",
        last_name="Therapist",
    )

    accessible = run(list_accessible_users(current_user=patient, db=db_session))
    doctors = run(list_doctors(current_user=patient, db=db_session))

    assert any(user.id == physiotherapist.id for user in accessible)
    assert any(user.id == physiotherapist.id for user in doctors)


def test_super_admin_can_view_patient_document_collections(db_session):
    super_admin = load_user(db_session, ADMIN_EMAIL)
    super_admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(super_admin)

    patient = seed_user(
        db_session,
        email="document-owner@example.com",
        role=UserRole.PATIENT,
        first_name="Document",
        last_name="Owner",
    )
    seed_document(db_session, patient_id=patient.id, uploaded_by=patient.id, is_private=True)

    collection = run(get_patient_documents(patient_id=patient.id, skip=0, limit=20, db=db_session, current_user=super_admin))

    assert collection.total == 1
    assert collection.items[0].patient_id == patient.id


def test_super_admin_can_view_admin_only_audit_and_appointment_resources(db_session):
    super_admin = load_user(db_session, ADMIN_EMAIL)
    super_admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(super_admin)

    patient = seed_user(
        db_session,
        email="appt-patient@example.com",
        role=UserRole.PATIENT,
        first_name="Appt",
        last_name="Patient",
    )
    provider = seed_user(
        db_session,
        email="appt-provider@example.com",
        role=UserRole.PROVIDER,
        first_name="Appt",
        last_name="Provider",
    )
    appointment = Appointment(
        patient_id=patient.id,
        provider_id=provider.id,
        title="Follow-up",
        description="Routine follow-up",
        appointment_type=AppointmentType.TELEHEALTH,
        status=AppointmentStatus.SCHEDULED,
        scheduled_time=utcnow() + timedelta(days=1),
        duration_minutes=30,
    )
    db_session.add(appointment)
    db_session.commit()
    db_session.refresh(appointment)

    retention = run(get_data_retention_policy(db=db_session, current_user=super_admin))
    appointments = run(list_appointments(current_user=super_admin, db=db_session, skip=0, limit=20))
    fetched = run(get_appointment(appointment_id=appointment.id, current_user=super_admin, db=db_session))

    assert retention["retention_days"] == 2555
    assert any(item.id == appointment.id for item in appointments)
    assert fetched.id == appointment.id


def test_super_admin_can_access_admin_level_consent_and_notification_views(db_session):
    super_admin = load_user(db_session, ADMIN_EMAIL)
    super_admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(super_admin)

    patient = seed_user(
        db_session,
        email="consent-patient@example.com",
        role=UserRole.PATIENT,
        first_name="Consent",
        last_name="Patient",
    )
    consent = run(
        create_consent(
            PatientConsentCreate(
                consent_type="treatment",
                title="Treatment Consent",
                description="Allow treatment",
            ),
            patient_id=patient.id,
            db=db_session,
            current_user=super_admin,
        )
    )

    notification = Notification(
        user_id=patient.id,
        title="Private notice",
        message="Visible to elevated admins",
        notification_type="system",
    )
    db_session.add(notification)
    db_session.commit()
    db_session.refresh(notification)

    consents = run(list_consents(skip=0, limit=20, patient_id=patient.id, db=db_session, current_user=super_admin))
    fetched_notification = run(get_notification(notification_id=notification.id, db=db_session, current_user=super_admin))

    assert consents.total == 1
    assert consents.items[0].id == consent.id
    assert fetched_notification.id == notification.id


def test_verification_email_hits_sendgrid_api_when_configured(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

    async def fake_post(self, url, headers=None, json=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return FakeResponse()

    monkeypatch.setattr("app.services.email_service.settings.EMAIL_PROVIDER", "sendgrid")
    monkeypatch.setattr("app.services.email_service.settings.SENDGRID_API_KEY", "sg-test-key")
    monkeypatch.setattr("app.services.email_service.settings.SENDGRID_FROM_EMAIL", "noreply@alera.health")
    monkeypatch.setattr("app.services.email_service.httpx.AsyncClient.post", fake_post)

    run(
        EmailService.send_verification_email(
            recipient_email="provider@example.com",
            recipient_name="Dr Example",
            verification_link="https://alera.example/verify-email?token=test-token",
        )
    )

    assert captured["url"] == "https://api.sendgrid.com/v3/mail/send"
    assert captured["headers"]["Authorization"] == "Bearer sg-test-key"
    assert captured["json"]["personalizations"][0]["to"][0]["email"] == "provider@example.com"
    assert captured["json"]["subject"] == "ALERA - Verify Your Email"


def test_sqlalchemy_enums_persist_lowercase_values():
    cases = [
        (User.__table__.c.role.type, [member.value for member in UserRole]),
        (Appointment.__table__.c.appointment_type.type, [member.value for member in AppointmentType]),
        (Appointment.__table__.c.status.type, [member.value for member in AppointmentStatus]),
        (LabTest.__table__.c.status.type, [member.value for member in LabTestStatus]),
        (ImagingScan.__table__.c.status.type, [member.value for member in ImagingScanStatus]),
        (AmbulanceRequest.__table__.c.status.type, [member.value for member in AmbulanceRequestStatus]),
        (AmbulanceRequest.__table__.c.priority.type, [member.value for member in EmergencyPriority]),
        (PatientDocument.__table__.c.file_type.type, [member.value for member in DocumentType]),
    ]

    for column_type, expected in cases:
        assert list(column_type.enums) == expected


def test_workforce_role_queries_normalize_enum_labels(db_session):
    compiled = str(
        db_session.query(User)
        .filter(
            normalized_enum_text(User.role).in_(
                [role.value for role in WORKFORCE_ROLES]
            )
        )
        .statement.compile(compile_kwargs={"literal_binds": True})
    ).lower()

    assert "lower(cast(users.role as" in compiled
    assert "'hospital'" in compiled


def test_professional_registration_requires_license_and_starts_pending(db_session):
    with pytest.raises(ValidationError):
        UserCreate(
            email="doctor-no-license@example.com",
            username="doctor-no-license",
            first_name="No",
            last_name="License",
            password="password123",
            role="provider",
        )

    result = run(register(
        UserCreate(
            email="doctor@example.com",
            username="doctor",
            first_name="Dr",
            last_name="Who",
            password="password123",
            role="provider",
            license_number="MD-12345",
            license_state="GA",
            specialty="Family Medicine",
        ),
        db_session,
    ))

    user = result["user"]
    assert user.role == "provider"
    assert user.is_verified is False
    assert user.license_number == "MD-12345"
    assert user.license_state == "GA"


def test_logout_revokes_previous_token(db_session):
    run(register(
        UserCreate(
            email="logout@example.com",
            username="logout-user",
            first_name="Log",
            last_name="Out",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    run(login(LoginRequest(email="logout@example.com", password="password123"), db_session))
    token = issue_access_token_for_user(load_user(db_session, "logout@example.com"))

    current_user = run(get_current_user(request=None, credentials=auth_credentials(token), db=db_session))
    assert current_user.email == "logout@example.com"

    run(logout(current_user=current_user, db=db_session))

    with pytest.raises(HTTPException) as exc_info:
        run(get_current_user(request=None, credentials=auth_credentials(token), db=db_session))

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Session expired"


def test_login_sets_http_only_cookies_without_returning_raw_tokens():
    client = TestClient(app)

    response = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == ADMIN_EMAIL
    assert "access_token" not in payload
    assert "refresh_token" not in payload
    assert response.cookies.get("access_token")
    assert response.cookies.get("refresh_token")


def test_password_change_revokes_previous_token(db_session):
    run(register(
        UserCreate(
            email="change@example.com",
            username="change-user",
            first_name="Change",
            last_name="Me",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    run(login(LoginRequest(email="change@example.com", password="password123"), db_session))
    token = issue_access_token_for_user(load_user(db_session, "change@example.com"))
    current_user = run(get_current_user(request=None, credentials=auth_credentials(token), db=db_session))

    run(change_password(
        PasswordChangeRequest(
            old_password="password123",
            new_password="newpassword123",
            confirm_password="newpassword123",
        ),
        current_user=current_user,
        db=db_session,
    ))

    with pytest.raises(HTTPException) as exc_info:
        run(get_current_user(request=None, credentials=auth_credentials(token), db=db_session))

    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException):
        run(login(LoginRequest(email="change@example.com", password="password123"), db_session))

    new_login = run(login(LoginRequest(email="change@example.com", password="newpassword123"), db_session))
    assert new_login["user"].email == "change@example.com"


def test_admin_deactivation_revokes_current_tokens(db_session):
    run(register(
        UserCreate(
            email="deactivate@example.com",
            username="deactivate-user",
            first_name="De",
            last_name="Activate",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    run(login(LoginRequest(email="deactivate@example.com", password="password123"), db_session))
    patient_token = issue_access_token_for_user(load_user(db_session, "deactivate@example.com"))
    patient_user = run(get_current_user(request=None, credentials=auth_credentials(patient_token), db=db_session))

    run(login(LoginRequest(email=ADMIN_EMAIL, password=ADMIN_PASSWORD), db_session))
    admin_user = run(get_current_user(request=None, credentials=auth_credentials(issue_access_token_for_user(load_user(db_session, ADMIN_EMAIL))), db=db_session))

    run(deactivate_user(user_id=patient_user.id, current_user=admin_user, db=db_session))

    with pytest.raises(HTTPException) as exc_info:
        run(get_current_user(request=None, credentials=auth_credentials(patient_token), db=db_session))

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "User account is inactive"


def test_verified_provider_filtering_and_scoped_patient_data(db_session):
    patient_result = run(register(
        UserCreate(
            email="panel-patient@example.com",
            username="panel-patient",
            first_name="Panel",
            last_name="Patient",
            password="password123",
            role="patient",
        ),
        db_session,
    ))
    provider_result = run(register(
        UserCreate(
            email="panel-doctor@example.com",
            username="panel-doctor",
            first_name="Panel",
            last_name="Doctor",
            password="password123",
            role="provider",
            license_number="MD-67890",
            license_state="GA",
            specialty="Internal Medicine",
        ),
        db_session,
    ))

    patient_user = load_user_by_id(db_session, patient_result["user"].id)
    provider_user = load_user_by_id(db_session, provider_result["user"].id)
    admin_user = load_user(db_session, ADMIN_EMAIL)

    pending_doctors = run(list_doctors(current_user=patient_user, db=db_session))
    assert pending_doctors == []

    verifications_before = run(list_verifications(current_user=admin_user, db=db_session))
    assert any(item.id == provider_user.id and item.is_verified is False for item in verifications_before)

    with pytest.raises(HTTPException) as exc_info:
        run(create_reminder(
            AppointmentReminderCreate(
                appointment_id=999,
                reminder_type="email",
                scheduled_time=datetime.now(timezone.utc),
                recipient="panel-patient@example.com",
                recipient_id=patient_user.id,
            ),
            db=db_session,
            current_user=provider_user,
        ))

    assert exc_info.value.status_code == 403
    assert "pending verification" in exc_info.value.detail

    run(approve_provider(user_id=provider_user.id, current_user=admin_user, db=db_session))
    db_session.refresh(provider_user)

    verifications_after = run(list_verifications(current_user=admin_user, db=db_session))
    assert any(item.id == provider_user.id and item.is_verified is True for item in verifications_after)

    document = seed_document(db_session, patient_id=patient_user.id, uploaded_by=patient_user.id, is_private=False)

    documents_before = run(list_documents(skip=0, limit=20, db=db_session, current_user=provider_user))
    assert documents_before.total == 0

    with pytest.raises(HTTPException) as exc_info:
        run(get_document(document_id=document.id, db=db_session, current_user=provider_user))

    assert exc_info.value.status_code == 403

    with pytest.raises(HTTPException) as exc_info:
        run(create_consent(
            PatientConsentCreate(
                consent_type="data_sharing",
                title="Share records",
                description="Allow access to records",
            ),
            patient_id=patient_user.id,
            db=db_session,
            current_user=provider_user,
        ))

    assert exc_info.value.status_code == 403

    appointment = run(create_appointment(
        AppointmentCreate(
            provider_id=provider_user.id,
            title="Consultation",
            description="Initial review",
            appointment_type="telehealth",
            scheduled_time=utcnow() + timedelta(days=1),
            duration_minutes=30,
        ),
        current_user=patient_user,
        db=db_session,
    ))

    verified_doctors = run(list_doctors(current_user=patient_user, db=db_session))
    assert any(doctor.id == provider_user.id for doctor in verified_doctors)

    verified_reminder = run(create_reminder(
        AppointmentReminderCreate(
            appointment_id=appointment.id,
            reminder_type="email",
            scheduled_time=datetime.now(timezone.utc),
            recipient="panel-patient@example.com",
            recipient_id=patient_user.id,
        ),
        db=db_session,
        current_user=provider_user,
    ))
    assert verified_reminder.appointment_id == appointment.id

    with pytest.raises(HTTPException) as exc_info:
        run(list_reminders(current_user=provider_user, db=db_session))

    assert exc_info.value.status_code == 403

    documents_after = run(list_documents(skip=0, limit=20, db=db_session, current_user=provider_user))
    assert documents_after.total == 1

    accessible_document = run(get_document(document_id=document.id, db=db_session, current_user=provider_user))
    assert accessible_document.id == document.id

    consent = run(create_consent(
        PatientConsentCreate(
            consent_type="data_sharing",
            title="Share records",
            description="Allow access to records",
        ),
        patient_id=patient_user.id,
        db=db_session,
        current_user=provider_user,
    ))
    assert consent.patient_id == patient_user.id


@pytest.mark.parametrize(
    ("requested_role", "expected_role"),
    [
        ("patient", UserRole.PATIENT),
        ("doctor", UserRole.PROVIDER),
        ("provider", UserRole.PROVIDER),
        ("pharmacy", UserRole.PHARMACIST),
        ("pharmacist", UserRole.PHARMACIST),
        ("hospital", UserRole.HOSPITAL),
        ("laboratory", UserRole.LABORATORY),
        ("imaging", UserRole.IMAGING),
        ("ambulance", UserRole.AMBULANCE),
        ("admin", UserRole.ADMIN),
        ("super_admin", UserRole.SUPER_ADMIN),
    ],
)
def test_super_admin_can_change_user_roles(db_session, requested_role, expected_role):
    user_result = run(register(
        UserCreate(
            email="rolechange@example.com",
            username="rolechange-user",
            first_name="Role",
            last_name="Change",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    target_user = load_user_by_id(db_session, user_result["user"].id)
    super_admin = load_user(db_session, ADMIN_EMAIL)
    super_admin.role = UserRole.SUPER_ADMIN
    db_session.commit()
    db_session.refresh(super_admin)

    result = run(change_user_role(
        user_id=target_user.id,
        new_role=requested_role,
        current_user=super_admin,
        db=db_session,
    ))

    db_session.refresh(target_user)
    assert result["new_role"] == expected_role.value
    assert target_user.role == expected_role


def test_email_verification_flow_and_resend(db_session, monkeypatch):
    captured, send_verification_email, _ = _make_email_capture()
    monkeypatch.setattr("app.routes.auth.EmailService.send_verification_email", send_verification_email)

    registration = run(register(
        UserCreate(
            email="verifyme@example.com",
            username="verifyme",
            first_name="Verify",
            last_name="Me",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    user = load_user_by_id(db_session, registration["user"].id)
    assert user.email_verified is False
    assert user.email_verification_token_hash is not None
    assert captured["verification"]

    first_token = extract_token(captured["verification"][-1])

    run(resend_email_verification(current_user=user, db=db_session))
    assert len(captured["verification"]) == 2
    second_token = extract_token(captured["verification"][-1])
    assert second_token != first_token

    with pytest.raises(HTTPException):
        run(verify_email(EmailVerificationConfirmRequest(token=first_token), db_session))

    verification_result = run(verify_email(EmailVerificationConfirmRequest(token=second_token), db_session))
    assert verification_result["message"] == "Email verified successfully"

    db_session.refresh(user)
    assert user.email_verified is True
    assert user.email_verified_at is not None
    assert user.email_verification_token_hash is None
    assert user.email_verification_expires_at is None


def test_registration_rolls_back_when_verification_email_delivery_fails(db_session, monkeypatch):
    async def failing_send_verification_email(*args, **kwargs):
        raise RuntimeError("mail provider unavailable")

    monkeypatch.setattr("app.routes.auth.EmailService.send_verification_email", failing_send_verification_email)

    with pytest.raises(HTTPException) as exc_info:
        run(register(
            UserCreate(
                email="cannotverify@example.com",
                username="cannotverify",
                first_name="Cannot",
                last_name="Verify",
                password="password123",
                role="patient",
            ),
            db_session,
        ))

    assert exc_info.value.status_code == 503
    assert db_session.query(User).filter(User.email == "cannotverify@example.com").first() is None


def test_admin_resend_verification_is_a_noop(db_session):
    admin = load_user(db_session, ADMIN_EMAIL)
    admin.email_verified = False
    db_session.commit()

    result = run(resend_email_verification(current_user=admin, db=db_session))

    assert result["message"] == "Email is already verified"


def test_password_reset_flow_revokes_sessions_and_allows_new_login(db_session, monkeypatch):
    captured, _, send_password_reset = _make_email_capture()
    monkeypatch.setattr("app.routes.auth.EmailService.send_password_reset", send_password_reset)

    async def noop_send_verification_email(*args, **kwargs):
        return None

    monkeypatch.setattr("app.routes.auth.EmailService.send_verification_email", noop_send_verification_email)

    run(register(
        UserCreate(
            email="resetme@example.com",
            username="resetme",
            first_name="Reset",
            last_name="Me",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    run(login(LoginRequest(email="resetme@example.com", password="password123"), db_session))
    token = issue_access_token_for_user(load_user(db_session, "resetme@example.com"))

    request_result = run(request_password_reset(PasswordResetRequest(email="resetme@example.com"), db_session))
    assert "reset link has been sent" in request_result["message"].lower()
    assert captured["reset"]
    reset_token = extract_token(captured["reset"][-1])

    reset_result = run(
        reset_password(
            PasswordResetConfirmRequest(
                token=reset_token,
                new_password="newpassword123",
                confirm_password="newpassword123",
            ),
            db_session,
        )
    )
    assert reset_result["message"] == "Password reset successfully"

    with pytest.raises(HTTPException) as exc_info:
        run(get_current_user(request=None, credentials=auth_credentials(token), db=db_session))

    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException):
        run(login(LoginRequest(email="resetme@example.com", password="password123"), db_session))

    new_login = run(login(LoginRequest(email="resetme@example.com", password="newpassword123"), db_session))
    assert new_login["user"].email == "resetme@example.com"


def test_password_reset_request_rolls_back_token_when_email_delivery_fails(db_session, monkeypatch):
    async def noop_send_verification_email(*args, **kwargs):
        return None

    async def failing_send_password_reset(*args, **kwargs):
        raise RuntimeError("mail provider unavailable")

    monkeypatch.setattr("app.routes.auth.EmailService.send_verification_email", noop_send_verification_email)
    monkeypatch.setattr("app.routes.auth.EmailService.send_password_reset", failing_send_password_reset)

    run(register(
        UserCreate(
            email="resetfail@example.com",
            username="resetfail",
            first_name="Reset",
            last_name="Fail",
            password="password123",
            role="patient",
        ),
        db_session,
    ))

    result = run(request_password_reset(PasswordResetRequest(email="resetfail@example.com"), db_session))
    assert "reset link has been sent" in result["message"].lower()

    user = load_user(db_session, "resetfail@example.com")
    assert user.password_reset_token_hash is None
    assert user.password_reset_expires_at is None


def test_imaging_center_can_upload_report_and_multiple_scan_files(db_session, monkeypatch):
    patient = seed_user(
        db_session,
        email="patient-imaging@example.com",
        role=UserRole.PATIENT,
        first_name="Pat",
        last_name="Ient",
    )
    provider = seed_user(
        db_session,
        email="doctor-imaging@example.com",
        role=UserRole.PROVIDER,
        first_name="Doc",
        last_name="Tor",
    )
    center = seed_user(
        db_session,
        email="center-imaging@example.com",
        role=UserRole.IMAGING,
        first_name="Scan",
        last_name="Center",
    )
    center.postdicom_api_url = "https://postdicom.test/api/upload"
    db_session.commit()

    async def fake_upload_imaging_results(api_url, api_key, scan, report_file, image_files, findings, impression, status):
        return {
            "study_id": f"study-{scan.id}",
            "study_url": f"https://postdicom.test/study/{scan.id}",
        }

    monkeypatch.setattr(
        "app.services.postdicom_service.PostDICOMService.upload_imaging_results",
        fake_upload_imaging_results,
    )

    scan = seed_imaging_scan(db_session, patient_id=patient.id, ordered_by=provider.id, center_id=center.id)

    response = run(
        upload_imaging_results(
            scan.id,
            findings="No acute intracranial abnormality.",
            impression="Normal MRI brain.",
            status_value="completed",
            report_file=UploadFile(filename="report.pdf", file=BytesIO(b"%PDF-1.4 test"), headers={"content-type": "application/pdf"}),
            image_files=[
                UploadFile(filename="study-1.dcm", file=BytesIO(b"DICM study 1"), headers={"content-type": "application/dicom"}),
                UploadFile(filename="study-2.dcm", file=BytesIO(b"DICM study 2"), headers={"content-type": "application/dicom"}),
            ],
            current_user=center,
            db=db_session,
        )
    )

    db_session.refresh(scan)
    assert response.status == "completed"
    assert response.report_file is None
    assert len(response.image_files) == 0
    assert scan.report_url is None
    assert scan.image_url is None
    assert scan.postdicom_study_id == f"study-{scan.id}"
    assert scan.postdicom_study_url == f"https://postdicom.test/study/{scan.id}"
    assert scan.completed_at is not None


def test_other_imaging_center_cannot_upload_results_for_foreign_scan(db_session):
    patient = seed_user(
        db_session,
        email="patient-foreign@example.com",
        role=UserRole.PATIENT,
        first_name="Pat",
        last_name="Foreign",
    )
    provider = seed_user(
        db_session,
        email="doctor-foreign@example.com",
        role=UserRole.PROVIDER,
        first_name="Doc",
        last_name="Foreign",
    )
    center = seed_user(
        db_session,
        email="center-owned@example.com",
        role=UserRole.IMAGING,
        first_name="Owned",
        last_name="Center",
    )
    other_center = seed_user(
        db_session,
        email="center-other@example.com",
        role=UserRole.IMAGING,
        first_name="Other",
        last_name="Center",
    )
    scan = seed_imaging_scan(db_session, patient_id=patient.id, ordered_by=provider.id, center_id=center.id)

    with pytest.raises(HTTPException) as exc_info:
        run(
            upload_imaging_results(
                scan.id,
                findings="Attempted upload",
                impression=None,
                status_value="completed",
                report_file=None,
                image_files=[],
                current_user=other_center,
                db=db_session,
            )
        )

    assert exc_info.value.status_code == 403


def test_imaging_center_cannot_upload_without_postdicom_endpoint(db_session):
    patient = seed_user(
        db_session,
        email="patient-no-endpoint@example.com",
        role=UserRole.PATIENT,
        first_name="Pat",
        last_name="NoEndpoint",
    )
    provider = seed_user(
        db_session,
        email="doctor-no-endpoint@example.com",
        role=UserRole.PROVIDER,
        first_name="Doc",
        last_name="NoEndpoint",
    )
    center = seed_user(
        db_session,
        email="center-no-endpoint@example.com",
        role=UserRole.IMAGING,
        first_name="Scan",
        last_name="NoEndpoint",
    )
    scan = seed_imaging_scan(db_session, patient_id=patient.id, ordered_by=provider.id, center_id=center.id)

    with pytest.raises(HTTPException) as exc_info:
        run(
            upload_imaging_results(
                scan.id,
                findings="No endpoint provided",
                impression="No endpoint provided",
                status_value="completed",
                report_file=None,
                image_files=[],
                current_user=center,
                db=db_session,
            )
        )

    assert exc_info.value.status_code == 400
    assert "PostDICOM endpoint is required" in str(exc_info.value.detail)


def test_imaging_download_endpoints_require_authorized_user(db_session):
    patient = seed_user(
        db_session,
        email="patient-download@example.com",
        role=UserRole.PATIENT,
        first_name="Pat",
        last_name="Download",
    )
    provider = seed_user(
        db_session,
        email="doctor-download@example.com",
        role=UserRole.PROVIDER,
        first_name="Doc",
        last_name="Download",
    )
    center = seed_user(
        db_session,
        email="center-download@example.com",
        role=UserRole.IMAGING,
        first_name="Scan",
        last_name="Download",
    )
    admin = seed_user(
        db_session,
        email="admin-download@example.com",
        role=UserRole.ADMIN,
        first_name="Admin",
        last_name="Download",
    )
    outsider = seed_user(
        db_session,
        email="patient-outsider@example.com",
        role=UserRole.PATIENT,
        first_name="Out",
        last_name="Sider",
    )
    scan = seed_imaging_scan(db_session, patient_id=patient.id, ordered_by=provider.id, center_id=center.id)
    result = run(
        upload_imaging_results(
            scan.id,
            findings="Stable study",
            impression="Stable study",
            status_value="completed",
            report_file=UploadFile(filename="report.pdf", file=BytesIO(b"%PDF-1.4 ok"), headers={"content-type": "application/pdf"}),
            image_files=[UploadFile(filename="study.dcm", file=BytesIO(b"DICM"), headers={"content-type": "application/dicom"})],
            current_user=admin,
            db=db_session,
        )
    )

    report_response = run(download_imaging_report(scan.id, current_user=patient, db=db_session))
    image_response = run(download_imaging_asset(scan.id, result.image_files[0].file_id, current_user=provider, db=db_session))

    assert report_response.filename == "report.pdf"
    assert image_response.filename == "study.dcm"

    with pytest.raises(HTTPException) as exc_info:
        run(download_imaging_report(scan.id, current_user=outsider, db=db_session))

    assert exc_info.value.status_code == 403
