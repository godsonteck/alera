import asyncio
from io import BytesIO

from fastapi import HTTPException, UploadFile

from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.user import User, UserRole
from app.routes.external_ingestion import ingest_external_medical_record
from app.routes.medical_records import create_medical_record, get_unified_patient_record
from app.routes.patient_permissions import grant_patient_permission, request_patient_permission
from app.schemas.canonical_records import MedicalRecordCreate, PatientPermissionCreate
from app.services.medical_record_sync import backfill_patient_canonical_records, ensure_user_organization
from app.utils.time import utcnow


PASSWORD_HASH = "test-password-hash"


def run(coro):
    return asyncio.run(coro)


def seed_user(
    db_session,
    *,
    email: str,
    username: str,
    first_name: str,
    last_name: str,
    role: UserRole,
    is_verified: bool = True,
):
    user = User(
        email=email,
        username=username,
        hashed_password=PASSWORD_HASH,
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=True,
        is_verified=is_verified,
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_patient_can_grant_org_access_and_provider_can_read_unified_record(db_session):
    patient = seed_user(
        db_session,
        email="patient-unified@example.com",
        username="patient-unified",
        first_name="Pat",
        last_name="Unified",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor-unified@example.com",
        username="doctor-unified",
        first_name="Doc",
        last_name="Unified",
        role=UserRole.PROVIDER,
    )
    organization = ensure_user_organization(db_session, doctor)
    db_session.commit()

    granted = run(
        grant_patient_permission(
            PatientPermissionCreate(
                patient_id=patient.id,
                organization_id=organization.id,
                scope=["full_record"],
                reason="Primary care access",
            ),
            db=db_session,
            current_user=patient,
        )
    )
    assert granted.status == "granted"

    created = run(
        create_medical_record(
            MedicalRecordCreate(
                patient_id=patient.id,
                record_type="diagnosis",
                category="condition",
                title="Type 2 Diabetes",
                summary="Controlled with oral medication",
                status="active",
                payload={"diagnosis_code": "E11"},
            ),
            db=db_session,
            current_user=patient,
        )
    )
    assert created.record_type == "diagnosis"

    unified = run(get_unified_patient_record(patient.id, db=db_session, current_user=doctor))

    assert unified.patient_id == patient.id
    assert len(unified.records) == 1
    assert unified.records[0].title == "Type 2 Diabetes"


def test_external_ingestion_creates_canonical_record_and_document(db_session):
    patient = seed_user(
        db_session,
        email="patient-import@example.com",
        username="patient-import",
        first_name="Pat",
        last_name="Import",
        role=UserRole.PATIENT,
        is_verified=False,
    )

    response = run(
        ingest_external_medical_record(
            patient_id=patient.id,
            record_type="lab_result",
            title="External CBC",
            source_system="external_lab",
            source_record_id="cbc-001",
            event_time=utcnow().isoformat(),
            summary="Imported external lab",
            provider_name="Outside Lab",
            notes="Uploaded manually",
            category="laboratory",
            document_type="lab_result",
            file=UploadFile(filename="cbc.pdf", file=BytesIO(b"%PDF-1.4 external"), headers={"content-type": "application/pdf"}),
            db=db_session,
            current_user=patient,
        )
    )

    assert response.medical_record.record_type == "lab_result"
    assert response.document is not None
    assert response.document.filename == "cbc.pdf"


def test_backfill_is_idempotent_for_legacy_appointments(db_session):
    patient = seed_user(
        db_session,
        email="patient-backfill@example.com",
        username="patient-backfill",
        first_name="Pat",
        last_name="Backfill",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor-backfill@example.com",
        username="doctor-backfill",
        first_name="Doc",
        last_name="Backfill",
        role=UserRole.PROVIDER,
    )

    db_session.add(
        Appointment(
            patient_id=patient.id,
            provider_id=doctor.id,
            title="Backfill Check",
            appointment_type=AppointmentType.TELEHEALTH,
            status=AppointmentStatus.COMPLETED,
            scheduled_time=utcnow(),
            duration_minutes=25,
        )
    )
    db_session.commit()

    first = backfill_patient_canonical_records(db_session, patient.id)
    second = backfill_patient_canonical_records(db_session, patient.id)
    unified = run(get_unified_patient_record(patient.id, db=db_session, current_user=patient))

    assert first.created_or_updated >= 1
    assert second.created_or_updated >= 1
    assert len([record for record in unified.records if record.source_record_id == "appointment:1"]) == 1


def test_provider_can_request_access_for_organization(db_session):
    patient = seed_user(
        db_session,
        email="patient-request@example.com",
        username="patient-request",
        first_name="Pat",
        last_name="Request",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor-request@example.com",
        username="doctor-request",
        first_name="Doc",
        last_name="Request",
        role=UserRole.PROVIDER,
    )
    organization = ensure_user_organization(db_session, doctor)
    db_session.commit()

    requested = run(
        request_patient_permission(
            PatientPermissionCreate(
                patient_id=patient.id,
                organization_id=organization.id,
                scope=["full_record"],
                reason="Pre-visit chart review",
            ),
            db=db_session,
            current_user=doctor,
        )
    )

    assert requested.organization_id == organization.id
    assert requested.status == "requested"
