from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from app.models import User, UserRole
from app.routes.ambulance import create_ambulance_request, update_ambulance_request
from app.routes.live_locations import get_emergency_tracking
from app.schemas import AmbulanceRequestCreate, AmbulanceRequestUpdate
from app.utils.time import utcnow


def run(coro):
    return asyncio.run(coro)


def seed_user(db_session, *, email: str, username: str, role: UserRole, verified: bool = True) -> User:
    user = User(
      email=email,
      username=username,
      hashed_password="not-used",
      first_name=username.title(),
      last_name="User",
      role=role,
      is_active=True,
      is_verified=verified,
      email_verified=True,
      email_verified_at=utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_patient_request_can_be_assigned_to_ambulance_dispatcher(db_session):
    patient = seed_user(
        db_session,
        email="patient-tracking@example.com",
        username="tracking-patient",
        role=UserRole.PATIENT,
    )
    ambulance_user = seed_user(
        db_session,
        email="ambulance-tracking@example.com",
        username="tracking-ambulance",
        role=UserRole.AMBULANCE,
    )

    created = run(create_ambulance_request(
        AmbulanceRequestCreate(
            location_name="Accra Central",
            address="Accra Central Station",
            latitude=5.5601,
            longitude=-0.2057,
            description="Emergency pickup",
            priority="critical",
        ),
        patient,
        db_session,
    ))

    updated = run(update_ambulance_request(
        created.id,
        AmbulanceRequestUpdate(status="dispatched"),
        ambulance_user,
        db_session,
    ))

    assert updated.patient_id == patient.id
    assert updated.assigned_ambulance_id == ambulance_user.id
    assert updated.status.value == "dispatched"
    assert updated.dispatched_at is not None


def test_emergency_tracking_returns_patient_and_ambulance_locations(db_session):
    patient = seed_user(
        db_session,
        email="patient-location@example.com",
        username="patient-location",
        role=UserRole.PATIENT,
    )
    patient.live_location_sharing_enabled = True
    patient.live_latitude = 5.6037
    patient.live_longitude = -0.1870
    patient.live_location_updated_at = utcnow()
    db_session.add(patient)
    db_session.commit()

    ambulance_user = seed_user(
        db_session,
        email="ambulance-location@example.com",
        username="ambulance-location",
        role=UserRole.AMBULANCE,
    )
    ambulance_user.live_location_sharing_enabled = True
    ambulance_user.live_latitude = 5.6148
    ambulance_user.live_longitude = -0.1512
    ambulance_user.live_location_updated_at = utcnow()
    db_session.add(ambulance_user)
    db_session.commit()

    request_record = run(create_ambulance_request(
        AmbulanceRequestCreate(
            location_name="Osu",
            address="Osu, Accra",
            latitude=5.6037,
            longitude=-0.1870,
            description="Emergency pickup",
            priority="high",
        ),
        patient,
        db_session,
    ))

    run(update_ambulance_request(
        request_record.id,
        AmbulanceRequestUpdate(status="dispatched", assigned_ambulance_id=ambulance_user.id),
        ambulance_user,
        db_session,
    ))

    tracking = run(get_emergency_tracking(request_record.id, patient, db_session))

    assert tracking.patient_location is not None
    assert tracking.ambulance_location is not None
    assert tracking.patient_location.latitude == pytest.approx(5.6037)
    assert tracking.ambulance_location.longitude == pytest.approx(-0.1512)

    stranger = seed_user(
        db_session,
        email="stranger@example.com",
        username="stranger",
        role=UserRole.PATIENT,
    )

    with pytest.raises(HTTPException) as exc_info:
        run(get_emergency_tracking(request_record.id, stranger, db_session))

    assert exc_info.value.status_code == 403
