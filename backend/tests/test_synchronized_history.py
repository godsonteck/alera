import asyncio
from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.models.additional_features import PatientConsent
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.lab_imaging import LabTest, LabTestStatus
from app.models.medical_history import MedicalHistory
from app.models.prescription import Prescription
from app.models.structured_record import StructuredRecord
from app.models.user import User, UserRole
from app.routes.records import get_synchronized_history
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


def test_patient_can_fetch_synchronized_history_across_multiple_interactions(db_session):
    patient = seed_user(
        db_session,
        email="patient@example.com",
        username="patient",
        first_name="Pat",
        last_name="Ient",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor@example.com",
        username="doctor",
        first_name="Doc",
        last_name="Tor",
        role=UserRole.PROVIDER,
    )
    hospital = seed_user(
        db_session,
        email="hospital@example.com",
        username="hospital",
        first_name="City",
        last_name="Hospital",
        role=UserRole.HOSPITAL,
    )
    lab = seed_user(
        db_session,
        email="lab@example.com",
        username="lab",
        first_name="Prime",
        last_name="Lab",
        role=UserRole.LABORATORY,
    )

    now = utcnow()
    db_session.add_all([
        Appointment(
            patient_id=patient.id,
            provider_id=doctor.id,
            title="Cardiology Review",
            appointment_type=AppointmentType.IN_PERSON,
            status=AppointmentStatus.COMPLETED,
            scheduled_time=now,
            duration_minutes=30,
            location="Ward A",
        ),
        MedicalHistory(
            patient_id=patient.id,
            condition_name="Hypertension",
            description="Long-term blood pressure management",
            status="active",
        ),
        Prescription(
            patient_id=patient.id,
            provider_id=doctor.id,
            medication_name="Lisinopril",
            dosage="10",
            dosage_unit="mg",
            frequency="daily",
            route="oral",
            refills=1,
            refills_remaining=1,
            start_date=now,
            status="active",
        ),
        LabTest(
            patient_id=patient.id,
            ordered_by=doctor.id,
            destination_provider_id=lab.id,
            test_name="Full Blood Count",
            status=LabTestStatus.COMPLETED,
            ordered_at=now,
        ),
        StructuredRecord(
            id="billing-1",
            record_type="billing_record",
            patient_id=patient.id,
            provider_id=hospital.id,
            created_by=hospital.id,
            status="paid",
            payload={"title": "Emergency admission invoice", "amount": 2500},
        ),
    ])
    db_session.commit()

    result = run(get_synchronized_history(patient.id, db=db_session, current_user=patient))

    assert result.access_scope == "self"
    assert result.counts.appointments == 1
    assert result.counts.medical_history_entries == 1
    assert result.counts.prescriptions == 1
    assert result.counts.lab_tests == 1
    assert result.counts.structured_records == 1
    assert {party.user_id for party in result.interacting_organizations} == {doctor.id, hospital.id, lab.id}


def test_interacted_provider_with_active_consent_can_fetch_synchronized_history(db_session):
    patient = seed_user(
        db_session,
        email="patient2@example.com",
        username="patient2",
        first_name="Pat",
        last_name="Two",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor2@example.com",
        username="doctor2",
        first_name="Jane",
        last_name="Doctor",
        role=UserRole.PROVIDER,
    )

    now = utcnow()
    db_session.add_all([
        Appointment(
            patient_id=patient.id,
            provider_id=doctor.id,
            title="Follow-up",
            appointment_type=AppointmentType.TELEHEALTH,
            status=AppointmentStatus.COMPLETED,
            scheduled_time=now,
            duration_minutes=20,
        ),
        PatientConsent(
            id="consent-1",
            patient_id=patient.id,
            consent_type="data_sharing",
            title="Share my history",
            is_accepted=True,
            accepted_at=now,
            expires_at=now + timedelta(days=30),
            requested_by=doctor.id,
        ),
    ])
    db_session.commit()

    result = run(get_synchronized_history(patient.id, db=db_session, current_user=doctor))

    assert result.access_scope == "shared_history"
    assert result.has_shared_history_consent is True


def test_interacted_provider_without_active_consent_is_denied_synchronized_history(db_session):
    patient = seed_user(
        db_session,
        email="patient3@example.com",
        username="patient3",
        first_name="Pat",
        last_name="Three",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor3@example.com",
        username="doctor3",
        first_name="John",
        last_name="Doctor",
        role=UserRole.PROVIDER,
    )

    db_session.add(
        Appointment(
            patient_id=patient.id,
            provider_id=doctor.id,
            title="Consultation",
            appointment_type=AppointmentType.IN_PERSON,
            status=AppointmentStatus.COMPLETED,
            scheduled_time=utcnow(),
            duration_minutes=15,
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        run(get_synchronized_history(patient.id, db=db_session, current_user=doctor))

    assert exc_info.value.status_code == 403
    assert "active consent" in exc_info.value.detail


def test_unrelated_provider_is_denied_even_with_patient_sharing_consent(db_session):
    patient = seed_user(
        db_session,
        email="patient4@example.com",
        username="patient4",
        first_name="Pat",
        last_name="Four",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor4@example.com",
        username="doctor4",
        first_name="Anna",
        last_name="Doctor",
        role=UserRole.PROVIDER,
    )

    now = utcnow()
    db_session.add(
        PatientConsent(
            id="consent-2",
            patient_id=patient.id,
            consent_type="data_sharing",
            title="Share my history",
            is_accepted=True,
            accepted_at=now,
            expires_at=now + timedelta(days=30),
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        run(get_synchronized_history(patient.id, db=db_session, current_user=doctor))

    assert exc_info.value.status_code == 403
    assert "no recorded interaction" in exc_info.value.detail
