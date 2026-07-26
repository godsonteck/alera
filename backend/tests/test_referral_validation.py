import asyncio

import pytest
from pydantic import ValidationError
from fastapi import HTTPException

from app.models.referral import Referral
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.user import User, UserRole
from app.routes.referrals import create_referral, list_referrals, update_referral
from app.schemas import ReferralCreate, ReferralUpdate
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


def test_referral_destination_must_differ_from_service_rendered():
    with pytest.raises(ValidationError) as exc_info:
        ReferralCreate(
            patient_id=1,
            referral_type="laboratory",
            destination_provider_id=2,
            to_department="Lab",
            reason="Routine blood work",
        )

    assert "The destination must be different from service rendered" in str(exc_info.value)


def test_referral_destination_allows_specific_target_within_service():
    referral = ReferralCreate(
        patient_id=1,
        referral_type="pharmacy",
        destination_provider_id=2,
        to_department="Clinical pharmacy",
        reason="Medication reconciliation",
    )

    assert referral.to_department == "Clinical pharmacy"


def test_hospital_queue_only_returns_referrals_for_that_hospital(db_session):
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
    target_hospital = seed_user(
        db_session,
        email="hospital-a@example.com",
        username="hospital-a",
        first_name="Hospital",
        last_name="A",
        role=UserRole.HOSPITAL,
    )
    other_hospital = seed_user(
        db_session,
        email="hospital-b@example.com",
        username="hospital-b",
        first_name="Hospital",
        last_name="B",
        role=UserRole.HOSPITAL,
    )

    db_session.add_all([
        Referral(
            patient_id=patient.id,
            from_doctor_id=doctor.id,
            referral_type="hospital",
            destination_provider_id=target_hospital.id,
            to_department="Hospital A",
            to_department_id=str(target_hospital.id),
            reason="Cardiology review",
            status="pending",
        ),
        Referral(
            patient_id=patient.id,
            from_doctor_id=doctor.id,
            referral_type="hospital",
            destination_provider_id=other_hospital.id,
            to_department="Hospital B",
            to_department_id=str(other_hospital.id),
            reason="Neurology review",
            status="pending",
        ),
    ])
    db_session.commit()

    rows = run(list_referrals(current_user=target_hospital, db=db_session, referral_type=None))

    assert len(rows) == 1
    assert rows[0].destination_provider_id == target_hospital.id
    assert rows[0].to_department == "Hospital A"


def test_provider_must_have_patient_on_panel_to_create_referral(db_session):
    patient = seed_user(
        db_session,
        email="patient-panel@example.com",
        username="patient-panel",
        first_name="Pat",
        last_name="Panel",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor-panel@example.com",
        username="doctor-panel",
        first_name="Doc",
        last_name="Panel",
        role=UserRole.PROVIDER,
    )
    hospital = seed_user(
        db_session,
        email="hospital-panel@example.com",
        username="hospital-panel",
        first_name="Hospital",
        last_name="Panel",
        role=UserRole.HOSPITAL,
    )

    with pytest.raises(HTTPException) as exc_info:
        run(create_referral(
            ReferralCreate(
                patient_id=patient.id,
                referral_type="hospital",
                destination_provider_id=hospital.id,
                to_department="Cardiology",
                reason="Specialist review",
            ),
            current_user=doctor,
            db=db_session,
        ))

    assert exc_info.value.status_code == 403
    assert "create referrals" in exc_info.value.detail

    db_session.add(Appointment(
        patient_id=patient.id,
        provider_id=doctor.id,
        title="Consultation",
        appointment_type=AppointmentType.IN_PERSON,
        scheduled_time=utcnow(),
        status=AppointmentStatus.SCHEDULED,
    ))
    db_session.commit()

    created = run(create_referral(
        ReferralCreate(
            patient_id=patient.id,
            referral_type="hospital",
            destination_provider_id=hospital.id,
            to_department="Cardiology",
            reason="Specialist review",
        ),
        current_user=doctor,
        db=db_session,
    ))

    assert created.destination_provider_id == hospital.id
    assert created.status == "pending"


def test_destination_provider_status_updates_follow_queue_transitions(db_session):
    patient = seed_user(
        db_session,
        email="patient-transitions@example.com",
        username="patient-transitions",
        first_name="Pat",
        last_name="Transitions",
        role=UserRole.PATIENT,
        is_verified=False,
    )
    doctor = seed_user(
        db_session,
        email="doctor-transitions@example.com",
        username="doctor-transitions",
        first_name="Doc",
        last_name="Transitions",
        role=UserRole.PROVIDER,
    )
    imaging = seed_user(
        db_session,
        email="imaging-transitions@example.com",
        username="imaging-transitions",
        first_name="Imaging",
        last_name="Center",
        role=UserRole.IMAGING,
    )

    referral = Referral(
        patient_id=patient.id,
        from_doctor_id=doctor.id,
        referral_type="imaging",
        destination_provider_id=imaging.id,
        to_department="Precision MRI",
        reason="Persistent headache",
        status="pending",
    )
    db_session.add(referral)
    db_session.commit()
    db_session.refresh(referral)

    accepted = run(update_referral(
        referral.id,
        ReferralUpdate(status="accepted"),
        current_user=imaging,
        db=db_session,
    ))
    assert accepted.status == "accepted"

    with pytest.raises(HTTPException) as exc_info:
        run(update_referral(
            referral.id,
            ReferralUpdate(status="pending"),
            current_user=imaging,
            db=db_session,
        ))

    assert exc_info.value.status_code == 400
    assert "Cannot change referral status" in exc_info.value.detail

    completed = run(update_referral(
        referral.id,
        ReferralUpdate(status="completed"),
        current_user=imaging,
        db=db_session,
    ))
    assert completed.status == "completed"
