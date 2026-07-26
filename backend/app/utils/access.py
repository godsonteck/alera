from fastapi import HTTPException, status
from sqlalchemy import String, cast, func
from sqlalchemy.orm import Session

from app.models.additional_features import PatientConsent
from app.models.appointment import Appointment
from app.models.canonical_records import PatientPermission
from app.models.lab_imaging import ImagingScan, LabTest
from app.models.organization import Organization
from app.models.prescription import Prescription
from app.models.structured_record import StructuredRecord
from app.models.user import User, UserRole
from app.services.medical_record_sync import organization_for_user, permission_allows_scope
from app.utils.time import utcnow


WORKFORCE_ROLES = {
    UserRole.PROVIDER,
    UserRole.PHARMACIST,
    UserRole.HOSPITAL,
    UserRole.LABORATORY,
    UserRole.IMAGING,
    UserRole.AMBULANCE,
}

SHARED_HISTORY_CONSENT_TYPES = {
    "data_sharing",
    "hipaa",
    "treatment",
    "shared_medical_history",
}


_WORKFORCE_ROLE_VALUES = {member.value for member in WORKFORCE_ROLES}


def is_workforce_role(role: UserRole | str | None) -> bool:
    if role is None:
        return False
    value = role.value if hasattr(role, "value") else str(role)
    return value in _WORKFORCE_ROLE_VALUES


def normalized_enum_text(column):
    """Return a lowercase text expression for Enum-backed columns.

    PostgreSQL enum labels can drift between legacy uppercase values and the
    lowercase values the application now uses. Casting to text and lowering
    the expression avoids binding failures and keeps queries tolerant of either
    representation.
    """

    return func.lower(cast(column, String))


def require_verified_workforce_member(user: User, action: str) -> None:
    """
    Block non-patient workforce accounts until an admin verifies them.

    Admin accounts are intentionally exempt because they are seeded and managed
    out-of-band from the public registration flow.
    """

    if user.role in WORKFORCE_ROLES and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account is pending verification and cannot {action}.",
        )


def provider_panel_patient_ids(db: Session, provider_id: int) -> set[int]:
    rows = (
        db.query(Appointment.patient_id)
        .filter(Appointment.provider_id == provider_id)
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def workforce_patient_ids(db: Session, workforce_user_id: int) -> set[int]:
    """Return only patients with a documented relationship to a workforce user."""
    patient_ids = provider_panel_patient_ids(db, workforce_user_id)

    relationship_queries = (
        db.query(StructuredRecord.patient_id).filter(StructuredRecord.provider_id == workforce_user_id),
        db.query(Prescription.patient_id).filter(
            (Prescription.provider_id == workforce_user_id) | (Prescription.pharmacy_id == workforce_user_id)
        ),
        db.query(LabTest.patient_id).filter(
            (LabTest.ordered_by == workforce_user_id)
            | (LabTest.destination_provider_id == workforce_user_id)
            | (LabTest.processed_by == workforce_user_id)
        ),
        db.query(ImagingScan.patient_id).filter(
            (ImagingScan.ordered_by == workforce_user_id)
            | (ImagingScan.destination_provider_id == workforce_user_id)
            | (ImagingScan.processed_by == workforce_user_id)
        ),
    )
    for query in relationship_queries:
        patient_ids.update(row[0] for row in query.distinct().all() if row[0] is not None)
    return patient_ids


def provider_can_access_patient(db: Session, provider_id: int, patient_id: int) -> bool:
    return patient_id in provider_panel_patient_ids(db, provider_id)


def require_provider_panel_access(db: Session, provider_id: int, patient_id: int, action: str) -> None:
    if not provider_can_access_patient(db, provider_id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are not authorized to {action} for this patient.",
        )


def patient_interaction_user_ids(db: Session, patient_id: int) -> set[int]:
    interaction_ids: set[int] = set()

    appointment_rows = db.query(Appointment.provider_id).filter(Appointment.patient_id == patient_id).all()
    interaction_ids.update(row[0] for row in appointment_rows if row[0] is not None)

    structured_rows = (
        db.query(StructuredRecord.provider_id)
        .filter(StructuredRecord.patient_id == patient_id, StructuredRecord.provider_id.isnot(None))
        .all()
    )
    interaction_ids.update(row[0] for row in structured_rows if row[0] is not None)

    prescription_rows = (
        db.query(Prescription.provider_id, Prescription.pharmacy_id)
        .filter(Prescription.patient_id == patient_id)
        .all()
    )
    for provider_id, pharmacy_id in prescription_rows:
        if provider_id is not None:
            interaction_ids.add(provider_id)
        if pharmacy_id is not None:
            interaction_ids.add(pharmacy_id)

    lab_rows = (
        db.query(LabTest.ordered_by, LabTest.destination_provider_id, LabTest.processed_by)
        .filter(LabTest.patient_id == patient_id)
        .all()
    )
    for ordered_by, destination_provider_id, processed_by in lab_rows:
        if ordered_by is not None:
            interaction_ids.add(ordered_by)
        if destination_provider_id is not None:
            interaction_ids.add(destination_provider_id)
        if processed_by is not None:
            interaction_ids.add(processed_by)

    imaging_rows = (
        db.query(ImagingScan.ordered_by, ImagingScan.destination_provider_id, ImagingScan.processed_by)
        .filter(ImagingScan.patient_id == patient_id)
        .all()
    )
    for ordered_by, destination_provider_id, processed_by in imaging_rows:
        if ordered_by is not None:
            interaction_ids.add(ordered_by)
        if destination_provider_id is not None:
            interaction_ids.add(destination_provider_id)
        if processed_by is not None:
            interaction_ids.add(processed_by)

    return interaction_ids


def patient_has_active_shared_history_consent(db: Session, patient_id: int) -> bool:
    now = utcnow()
    consent = (
        db.query(PatientConsent.id)
        .filter(
            PatientConsent.patient_id == patient_id,
            PatientConsent.is_accepted.is_(True),
            func.lower(PatientConsent.consent_type).in_(SHARED_HISTORY_CONSENT_TYPES),
            (PatientConsent.expires_at.is_(None) | (PatientConsent.expires_at >= now)),
        )
        .first()
    )
    return consent is not None


def authorize_shared_history_access(db: Session, current_user: User, patient_id: int) -> str:
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return "admin"

    if current_user.role == UserRole.PATIENT and current_user.id == patient_id:
        return "self"

    if current_user.role not in WORKFORCE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    require_verified_workforce_member(current_user, "view synchronized patient history")

    if current_user.id not in patient_interaction_user_ids(db, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This patient has no recorded interaction with your organization.",
        )

    if not patient_has_active_shared_history_consent(db, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The patient has not granted active consent for shared medical history access.",
        )

    return "shared_history"


def require_medical_record_access(db: Session, current_user: User, patient_id: int, scope: str = "full_record") -> str:
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins can only access medical-record metadata.",
        )

    if current_user.role == UserRole.PATIENT:
        if current_user.id != patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        return "self"

    if current_user.role not in WORKFORCE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    require_verified_workforce_member(current_user, "view patient medical records")
    organization = organization_for_user(db, current_user)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No organization is linked to this account.")

    permission = (
        db.query(PatientPermission)
        .filter(
            PatientPermission.patient_id == patient_id,
            PatientPermission.organization_id == organization.id,
        )
        .order_by(PatientPermission.updated_at.desc())
        .first()
    )
    if not permission or not permission_allows_scope(permission, scope):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This organization does not have active permission to access the requested patient record.",
        )
    return "organization"


def current_user_organization(db: Session, current_user: User) -> Organization | None:
    return organization_for_user(db, current_user)
