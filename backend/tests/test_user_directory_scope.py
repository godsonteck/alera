import asyncio

import pytest
from fastapi import HTTPException

from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.user import User, UserRole
from app.routes.users import list_accessible_users
from app.utils.time import utcnow


def run(coroutine):
    return asyncio.run(coroutine)


def create_user(db_session, email: str, role: UserRole, *, verified: bool = True) -> User:
    user = User(
        email=email,
        username=email.split("@", 1)[0],
        hashed_password="test-password-hash",
        first_name="Test",
        last_name="User",
        role=role,
        is_active=True,
        is_verified=verified,
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_workforce_directory_only_includes_patients_with_a_documented_relationship(db_session):
    pharmacy = create_user(db_session, "pharmacy@example.com", UserRole.PHARMACIST)
    connected_patient = create_user(db_session, "connected@example.com", UserRole.PATIENT)
    unrelated_patient = create_user(db_session, "unrelated@example.com", UserRole.PATIENT)
    provider = create_user(db_session, "provider@example.com", UserRole.PROVIDER)

    db_session.add(
        Appointment(
            patient_id=connected_patient.id,
            provider_id=pharmacy.id,
            title="Medication review",
            appointment_type=AppointmentType.TELEHEALTH,
            status=AppointmentStatus.SCHEDULED,
            scheduled_time=utcnow(),
            duration_minutes=30,
        )
    )
    db_session.commit()

    users = run(list_accessible_users(current_user=pharmacy, db=db_session))
    returned_ids = {user.id for user in users}

    assert connected_patient.id in returned_ids
    assert unrelated_patient.id not in returned_ids
    assert provider.id in returned_ids


def test_unverified_workforce_cannot_query_patient_directory(db_session):
    unverified_lab = create_user(db_session, "lab@example.com", UserRole.LABORATORY, verified=False)

    with pytest.raises(HTTPException) as error:
        run(list_accessible_users(current_user=unverified_lab, db=db_session))

    assert error.value.status_code == 403
