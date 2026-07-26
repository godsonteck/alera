import asyncio

from app.models.prescription import Prescription
from app.models.structured_record import StructuredRecord
from app.models.user import User, UserRole
from app.routes.records import list_records
from app.routes.prescriptions import list_prescriptions


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


def test_pharmacy_inventory_is_scoped_to_current_provider(db_session):
    pharmacy_a = seed_user(
        db_session,
        email="pharmacy-a@example.com",
        username="pharmacy-a",
        first_name="Pharmacy",
        last_name="A",
        role=UserRole.PHARMACIST,
    )
    pharmacy_b = seed_user(
        db_session,
        email="pharmacy-b@example.com",
        username="pharmacy-b",
        first_name="Pharmacy",
        last_name="B",
        role=UserRole.PHARMACIST,
    )

    db_session.add_all([
        StructuredRecord(
            id="inv-a",
            record_type="inventory_item",
            provider_id=pharmacy_a.id,
            created_by=pharmacy_a.id,
            status="in-stock",
            payload={"id": "inv-a", "name": "Amoxicillin"},
        ),
        StructuredRecord(
            id="inv-b",
            record_type="inventory_item",
            provider_id=pharmacy_b.id,
            created_by=pharmacy_b.id,
            status="in-stock",
            payload={"id": "inv-b", "name": "Ibuprofen"},
        ),
    ])
    db_session.commit()

    result = run(list_records(record_type="inventory_item", db=db_session, current_user=pharmacy_a))

    assert result.total == 1
    assert result.items[0].id == "inv-a"


def test_pharmacy_prescription_queue_is_scoped_to_destination_pharmacy(db_session):
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
    pharmacy_a = seed_user(
        db_session,
        email="pharmacy-a@example.com",
        username="pharmacy-a",
        first_name="Pharmacy",
        last_name="A",
        role=UserRole.PHARMACIST,
    )
    pharmacy_b = seed_user(
        db_session,
        email="pharmacy-b@example.com",
        username="pharmacy-b",
        first_name="Pharmacy",
        last_name="B",
        role=UserRole.PHARMACIST,
    )

    db_session.add_all([
        Prescription(
            patient_id=patient.id,
            provider_id=doctor.id,
            pharmacy_id=pharmacy_a.id,
            medication_name="Amoxicillin",
            dosage="500",
            dosage_unit="mg",
            frequency="daily",
            route="oral",
            refills=0,
            refills_remaining=0,
            start_date=doctor.created_at,
            status="active",
        ),
        Prescription(
            patient_id=patient.id,
            provider_id=doctor.id,
            pharmacy_id=pharmacy_b.id,
            medication_name="Ibuprofen",
            dosage="200",
            dosage_unit="mg",
            frequency="daily",
            route="oral",
            refills=0,
            refills_remaining=0,
            start_date=doctor.created_at,
            status="active",
        ),
    ])
    db_session.commit()

    rows = run(list_prescriptions(db=db_session, current_user=pharmacy_a))

    assert len(rows) == 1
    assert rows[0].pharmacy_id == pharmacy_a.id
