from __future__ import annotations

import uuid
from collections.abc import Iterable

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from app.models.additional_features import PatientConsent
from app.models.allergy import Allergy
from app.models.appointment import Appointment
from app.models.canonical_records import MedicalRecord, PatientPermission
from app.models.lab_imaging import ImagingScan, LabTest
from app.models.medical_history import MedicalHistory
from app.models.organization import Organization
from app.models.prescription import Prescription
from app.models.structured_record import StructuredRecord
from app.models.user import User, UserRole
from app.schemas.records import (
    SynchronizedHistoryCounts,
    SynchronizedHistoryParticipant,
    SynchronizedHistoryResponse,
    SynchronizedHistoryTimelineEntry,
    StructuredRecordCreate,
    StructuredRecordListResponse,
    StructuredRecordResponse,
    StructuredRecordUpdate,
)
from app.utils.access import (
    authorize_shared_history_access,
    current_user_organization,
    patient_has_active_shared_history_consent,
    patient_interaction_user_ids,
    provider_panel_patient_ids,
    require_medical_record_access,
    require_verified_workforce_member,
)
from app.utils.dependencies import get_current_user
from app.services.medical_record_sync import backfill_patient_canonical_records
from app.services.medical_record_sync import upsert_medical_record

router = APIRouter(prefix="/api/records", tags=["records"])

PATIENT_OWNED_TYPES = {
    "vital_sign",
    "health_metric",
    "medical_history",
    "patient_consent",
    "patient_problem",
    "medication_adherence",
}

PROVIDER_PANEL_TYPES = PATIENT_OWNED_TYPES | {
    "clinical_note",
    "appointment_reminder",
    "prescription_refill_request",
    "invoice",
    "billing_record",
    "service_charge",
}

PHARMACY_TYPES = {"inventory_item", "prescription_refill_request"}
AMBULANCE_TYPES = {"ambulance_vehicle"}

ALL_TYPES = PROVIDER_PANEL_TYPES | PHARMACY_TYPES | AMBULANCE_TYPES | {"provider_pricing"}


def _serialize(record: StructuredRecord) -> StructuredRecordResponse:
    return StructuredRecordResponse(**record.to_dict())


def _user_display_name(user: User | None) -> str | None:
    if user is None:
        return None
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.email


def _serialize_appointment(appointment: Appointment, users_by_id: dict[int, User]) -> dict:
    provider = users_by_id.get(appointment.provider_id)
    return {
        "id": appointment.id,
        "patient_id": appointment.patient_id,
        "provider_id": appointment.provider_id,
        "provider_name": _user_display_name(provider),
        "status": appointment.status.value if hasattr(appointment.status, "value") else str(appointment.status),
        "title": appointment.title,
        "appointment_type": appointment.appointment_type.value if hasattr(appointment.appointment_type, "value") else str(appointment.appointment_type),
        "scheduled_time": appointment.scheduled_time.isoformat() if appointment.scheduled_time else None,
        "location": appointment.location,
        "notes": appointment.notes,
        "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
    }


def _serialize_allergy(allergy: Allergy) -> dict:
    return {
        "id": allergy.id,
        "patient_id": allergy.patient_id,
        "allergen": allergy.allergen,
        "allergen_type": allergy.allergen_type,
        "reaction_description": allergy.reaction_description,
        "severity": allergy.severity,
        "confirmed": allergy.confirmed,
        "treatment": allergy.treatment,
        "created_at": allergy.created_at.isoformat() if allergy.created_at else None,
    }


def _serialize_medical_history(entry: MedicalHistory) -> dict:
    return {
        "id": entry.id,
        "patient_id": entry.patient_id,
        "condition_name": entry.condition_name,
        "icd_code": entry.icd_code,
        "description": entry.description,
        "status": entry.status,
        "severity": entry.severity,
        "treatment": entry.treatment,
        "notes": entry.notes,
        "onset_date": entry.onset_date.isoformat() if entry.onset_date else None,
        "resolution_date": entry.resolution_date.isoformat() if entry.resolution_date else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


def _serialize_prescription(prescription: Prescription, users_by_id: dict[int, User]) -> dict:
    return {
        "id": prescription.id,
        "patient_id": prescription.patient_id,
        "provider_id": prescription.provider_id,
        "provider_name": _user_display_name(users_by_id.get(prescription.provider_id)),
        "pharmacy_id": prescription.pharmacy_id,
        "pharmacy_name": _user_display_name(users_by_id.get(prescription.pharmacy_id)) if prescription.pharmacy_id else None,
        "medication_name": prescription.medication_name,
        "dosage": prescription.dosage,
        "dosage_unit": prescription.dosage_unit,
        "frequency": prescription.frequency,
        "route": prescription.route,
        "status": prescription.status,
        "prescribed_date": prescription.prescribed_date.isoformat() if prescription.prescribed_date else None,
        "start_date": prescription.start_date.isoformat() if prescription.start_date else None,
        "end_date": prescription.end_date.isoformat() if prescription.end_date else None,
    }


def _serialize_consent(consent: PatientConsent, users_by_id: dict[int, User]) -> dict:
    return {
        "id": consent.id,
        "patient_id": consent.patient_id,
        "consent_type": consent.consent_type,
        "title": consent.title,
        "description": consent.description,
        "is_accepted": consent.is_accepted,
        "accepted_at": consent.accepted_at.isoformat() if consent.accepted_at else None,
        "expires_at": consent.expires_at.isoformat() if consent.expires_at else None,
        "requested_by": consent.requested_by,
        "requested_by_name": _user_display_name(users_by_id.get(consent.requested_by)) if consent.requested_by else None,
        "created_at": consent.created_at.isoformat() if consent.created_at else None,
    }


def _load_users_by_id(db: Session, user_ids: Iterable[int | None]) -> dict[int, User]:
    ids = sorted({user_id for user_id in user_ids if user_id is not None})
    if not ids:
        return {}
    rows = db.query(User).filter(User.id.in_(ids)).all()
    return {user.id: user for user in rows}


def _build_timeline(
    *,
    appointments: list[dict],
    allergies: list[dict],
    medical_history: list[dict],
    prescriptions: list[dict],
    lab_tests: list[dict],
    imaging_scans: list[dict],
    structured_records: list[StructuredRecordResponse],
) -> list[SynchronizedHistoryTimelineEntry]:
    timeline: list[SynchronizedHistoryTimelineEntry] = []

    for appointment in appointments:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source="appointment",
                source_id=str(appointment["id"]),
                title=appointment.get("title") or "Appointment",
                status=appointment.get("status"),
                timestamp=appointment.get("scheduled_time"),
                provider_id=appointment.get("provider_id"),
                provider_name=appointment.get("provider_name"),
                payload=appointment,
            )
        )

    for allergy in allergies:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source="allergy",
                source_id=str(allergy["id"]),
                title=allergy.get("allergen") or "Allergy",
                status=allergy.get("severity"),
                timestamp=allergy.get("created_at"),
                payload=allergy,
            )
        )

    for entry in medical_history:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source="medical_history",
                source_id=str(entry["id"]),
                title=entry.get("condition_name") or "Medical history",
                status=entry.get("status"),
                timestamp=entry.get("created_at"),
                payload=entry,
            )
        )

    for prescription in prescriptions:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source="prescription",
                source_id=str(prescription["id"]),
                title=prescription.get("medication_name") or "Prescription",
                status=prescription.get("status"),
                timestamp=prescription.get("prescribed_date"),
                provider_id=prescription.get("provider_id"),
                provider_name=prescription.get("provider_name"),
                payload=prescription,
            )
        )

    for lab_test in lab_tests:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source="lab_test",
                source_id=str(lab_test["id"]),
                title=lab_test.get("test_name") or "Lab test",
                status=lab_test.get("status"),
                timestamp=lab_test.get("ordered_at"),
                provider_id=lab_test.get("ordered_by"),
                provider_name=lab_test.get("ordered_by_name"),
                payload=lab_test,
            )
        )

    for scan in imaging_scans:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source="imaging_scan",
                source_id=str(scan["id"]),
                title=scan.get("scan_type") or "Imaging scan",
                status=scan.get("status"),
                timestamp=scan.get("ordered_at"),
                provider_id=scan.get("ordered_by"),
                provider_name=scan.get("ordered_by_name"),
                payload=scan,
            )
        )

    for record in structured_records:
        timeline.append(
            SynchronizedHistoryTimelineEntry(
                source=record.record_type,
                source_id=record.id,
                title=str(record.payload.get("title") or record.payload.get("name") or record.record_type.replace("_", " ").title()),
                status=record.status,
                timestamp=record.created_at,
                provider_id=record.provider_id,
                provider_name=None,
                payload=record.payload,
            )
        )

    timeline.sort(key=lambda item: item.timestamp.isoformat() if item.timestamp else "", reverse=True)
    return timeline


def _require_allowed_type(record_type: str) -> None:
    if record_type not in ALL_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported record type")


def _panel_scope(db: Session, current_user: User) -> set[int]:
    if current_user.role == UserRole.PROVIDER:
        return provider_panel_patient_ids(db, current_user.id)
    return set()


def _apply_role_scope(query, db: Session, current_user: User, record_type: str):
    if current_user.is_admin_or_super():
        return query

    if current_user.role in (
        UserRole.PROVIDER,
        UserRole.PHARMACIST,
        UserRole.HOSPITAL,
        UserRole.LABORATORY,
        UserRole.IMAGING,
        UserRole.AMBULANCE,
    ):
        require_verified_workforce_member(current_user, f"view {record_type.replace('_', ' ')} records")

    if current_user.role == UserRole.PATIENT:
        if record_type in PATIENT_OWNED_TYPES | PROVIDER_PANEL_TYPES:
            return query.filter(StructuredRecord.patient_id == current_user.id)
        if record_type == "provider_pricing":
            return query.filter(StructuredRecord.provider_id == current_user.id)
        return query.filter(False)

    if current_user.role == UserRole.PROVIDER:
        panel_ids = _panel_scope(db, current_user)
        if record_type == "provider_pricing":
            return query.filter(StructuredRecord.provider_id == current_user.id)
        if panel_ids and record_type in PROVIDER_PANEL_TYPES:
            return query.filter(
                (StructuredRecord.patient_id.in_(panel_ids)) | (StructuredRecord.provider_id == current_user.id)
            )
        if record_type == "provider_pricing":
            return query.filter(StructuredRecord.provider_id == current_user.id)
        return query.filter(StructuredRecord.provider_id == current_user.id)

    if current_user.role == UserRole.PHARMACIST:
        if record_type in PHARMACY_TYPES:
            return query.filter(StructuredRecord.provider_id == current_user.id)
        return query.filter(False)

    if current_user.role in (UserRole.HOSPITAL, UserRole.AMBULANCE):
        if record_type in AMBULANCE_TYPES | {"invoice", "billing_record"}:
            return query.filter(StructuredRecord.provider_id == current_user.id)
        return query.filter(False)

    return query.filter(False)


def _authorizes_patient_scope(current_user: User, patient_id: int | None, db: Session, record_type: str) -> bool:
    if current_user.is_admin_or_super():
        return True
    if current_user.role == UserRole.PATIENT:
        return patient_id == current_user.id
    if current_user.role == UserRole.PROVIDER:
        if patient_id is None:
            return False
        return patient_id in provider_panel_patient_ids(db, current_user.id)
    return False


@router.get("/", response_model=StructuredRecordListResponse)
async def list_records(
    record_type: str = Query(..., min_length=1),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_allowed_type(record_type)
    skip = max(skip, 0)
    limit = max(1, min(limit, 500))

    query = db.query(StructuredRecord).filter(StructuredRecord.record_type == record_type)
    query = _apply_role_scope(query, db, current_user, record_type)
    total = query.count()
    items = query.order_by(StructuredRecord.created_at.desc()).offset(skip).limit(limit).all()
    return StructuredRecordListResponse(total=total, items=[_serialize(item) for item in items])


@router.get("/synchronized-history/{patient_id}", response_model=SynchronizedHistoryResponse)
async def get_synchronized_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient or patient.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if current_user.role == UserRole.PATIENT and current_user.id == patient_id:
        access_scope = "self"
    elif current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        access_scope = "metadata"
    else:
        try:
            access_scope = require_medical_record_access(db, current_user, patient_id)
        except HTTPException:
            access_scope = authorize_shared_history_access(db, current_user, patient_id)

    backfill_patient_canonical_records(db, patient_id)

    canonical_records = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == patient_id, MedicalRecord.is_deleted.is_(False))
        .order_by(MedicalRecord.event_time.desc(), MedicalRecord.created_at.desc())
        .all()
    )
    appointments = [record for record in canonical_records if record.record_type == "appointment"]
    allergies = [record for record in canonical_records if record.record_type == "allergy"]
    medical_history_entries = [record for record in canonical_records if record.record_type in {"medical_condition", "medical_history"}]
    prescriptions = [record for record in canonical_records if record.record_type == "prescription"]
    lab_tests = [record for record in canonical_records if record.record_type == "lab_result"]
    imaging_scans = [record for record in canonical_records if record.record_type == "imaging_result"]
    structured_records = [record for record in canonical_records if record.record_type not in {"appointment", "allergy", "medical_condition", "medical_history", "prescription", "lab_result", "imaging_result"}]

    org_ids = {record.organization_id for record in canonical_records if record.organization_id is not None}
    granted_permissions = (
        db.query(PatientPermission)
        .filter(PatientPermission.patient_id == patient_id, PatientPermission.status == "granted")
        .all()
    )
    org_ids |= {permission.organization_id for permission in granted_permissions if permission.organization_id is not None}
    organizations = db.query(Organization).filter(Organization.id.in_(org_ids)).all() if org_ids else []
    interaction_ids = patient_interaction_user_ids(db, patient_id) | {record.provider_id for record in canonical_records if record.provider_id is not None}
    users_by_id = _load_users_by_id(db, interaction_ids)

    appointment_items = [record.payload | {"id": record.id, "title": record.title, "status": record.status, "scheduled_time": record.event_time.isoformat() if record.event_time else None} for record in appointments]
    allergy_items = [record.payload | {"id": record.id, "allergen": record.title, "severity": record.status, "created_at": record.event_time.isoformat() if record.event_time else None} for record in allergies]
    medical_history_items = [record.payload | {"id": record.id, "condition_name": record.title, "status": record.status, "created_at": record.event_time.isoformat() if record.event_time else None, "description": record.summary} for record in medical_history_entries]
    prescription_items = [record.payload | {"id": record.id, "medication_name": record.title, "status": record.status, "prescribed_date": record.event_time.isoformat() if record.event_time else None, "provider_id": record.provider_id} for record in prescriptions]
    lab_test_items = [record.payload | {"id": record.id, "test_name": record.title, "status": record.status, "ordered_at": record.event_time.isoformat() if record.event_time else None, "ordered_by": record.provider_id} for record in lab_tests]
    imaging_scan_items = [record.payload | {"id": record.id, "scan_type": record.title, "status": record.status, "ordered_at": record.event_time.isoformat() if record.event_time else None, "ordered_by": record.provider_id} for record in imaging_scans]
    structured_record_items = [
        StructuredRecordResponse(
            id=record.id,
            record_type=record.record_type,
            patient_id=record.patient_id,
            provider_id=record.provider_id,
            created_by=record.provider_id,
            appointment_id=record.payload.get("appointment_id") if isinstance(record.payload, dict) else None,
            status=record.status,
            payload=record.payload if isinstance(record.payload, dict) else {},
            created_at=record.created_at,
            updated_at=record.updated_at,
        )
        for record in structured_records
    ]

    interacting_organizations = [
        SynchronizedHistoryParticipant(
            user_id=user.id,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            name=_user_display_name(user) or str(user.id),
        )
        for user_id in sorted(interaction_ids)
        if (user := users_by_id.get(user_id)) is not None
    ]

    timeline = [
        SynchronizedHistoryTimelineEntry(
            source=record.record_type,
            source_id=record.id,
            title=record.title,
            status=record.status,
            timestamp=record.event_time,
            provider_id=record.provider_id,
            provider_name=None,
            payload=record.payload if isinstance(record.payload, dict) else {},
        )
        for record in canonical_records
    ]

    return SynchronizedHistoryResponse(
        patient_id=patient_id,
        access_scope=access_scope,
        has_shared_history_consent=bool(granted_permissions) or patient_has_active_shared_history_consent(db, patient_id),
        interacting_organizations=interacting_organizations,
        counts=SynchronizedHistoryCounts(
            appointments=len(appointment_items),
            allergies=len(allergy_items),
            medical_history_entries=len(medical_history_items),
            prescriptions=len(prescription_items),
            lab_tests=len(lab_test_items),
            imaging_scans=len(imaging_scan_items),
            structured_records=len(structured_record_items),
        ),
        appointments=appointment_items,
        allergies=allergy_items,
        medical_history=medical_history_items,
        prescriptions=prescription_items,
        lab_tests=lab_test_items,
        imaging_scans=imaging_scan_items,
        structured_records=structured_record_items,
        timeline=timeline,
    )


@router.post("/", response_model=StructuredRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_record(
    body: StructuredRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_allowed_type(body.record_type)

    if current_user.role in (
        UserRole.PROVIDER,
        UserRole.PHARMACIST,
        UserRole.HOSPITAL,
        UserRole.LABORATORY,
        UserRole.IMAGING,
        UserRole.AMBULANCE,
    ):
        require_verified_workforce_member(current_user, f"create {body.record_type.replace('_', ' ')} records")

    if body.record_type in PATIENT_OWNED_TYPES | PROVIDER_PANEL_TYPES:
        if current_user.role == UserRole.PATIENT:
            body.patient_id = current_user.id
        elif current_user.role == UserRole.PROVIDER:
            if body.patient_id is None or body.patient_id not in provider_panel_patient_ids(db, current_user.id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this patient")
            body.provider_id = current_user.id
        elif not current_user.is_admin_or_super():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    elif body.record_type == "provider_pricing":
        if current_user.role == UserRole.PROVIDER:
            body.provider_id = current_user.id
        elif not current_user.is_admin_or_super():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    elif body.record_type in PHARMACY_TYPES:
        if current_user.role not in (UserRole.PHARMACIST, UserRole.ADMIN, UserRole.SUPER_ADMIN):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        if current_user.role == UserRole.PHARMACIST:
            body.provider_id = current_user.id
    elif body.record_type in AMBULANCE_TYPES:
        if current_user.role not in (UserRole.AMBULANCE, UserRole.HOSPITAL, UserRole.ADMIN, UserRole.SUPER_ADMIN):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        if current_user.role in (UserRole.AMBULANCE, UserRole.HOSPITAL):
            body.provider_id = current_user.id
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported record type")

    record = StructuredRecord(
        id=body.id or str(uuid.uuid4()),
        record_type=body.record_type,
        patient_id=body.patient_id,
        provider_id=body.provider_id,
        created_by=body.created_by or current_user.id,
        appointment_id=body.appointment_id,
        status=body.status,
        payload=body.payload,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    if body.record_type in {
        "medical_history",
        "clinical_note",
        "patient_problem",
        "patient_consent",
        "medication_adherence",
        "billing_record",
        "invoice",
        "service_charge",
    }:
        upsert_medical_record(
            db,
            patient_id=record.patient_id or current_user.id,
            provider=current_user if current_user.role != UserRole.PATIENT else None,
            record_type=body.record_type,
            category="structured",
            title=str(body.payload.get("title") or body.payload.get("name") or body.record_type.replace("_", " ").title()),
            summary=body.status,
            status=body.status,
            event_time=record.created_at,
            source_record_id=f"structured:{record.id}",
            payload=body.payload,
            is_external=False,
        )
        db.commit()
    return _serialize(record)


@router.get("/{record_id}", response_model=StructuredRecordResponse)
async def get_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(StructuredRecord).filter(StructuredRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    _require_allowed_type(record.record_type)
    query = db.query(StructuredRecord).filter(StructuredRecord.id == record_id)
    scoped = _apply_role_scope(query, db, current_user, record.record_type).first()
    if not scoped:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return _serialize(record)


@router.put("/{record_id}", response_model=StructuredRecordResponse)
async def update_record(
    record_id: str,
    body: StructuredRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(StructuredRecord).filter(StructuredRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    _require_allowed_type(record.record_type)
    if current_user.is_admin_or_super():
        pass
    elif current_user.role == UserRole.PATIENT:
        if record.patient_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    elif current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, f"update {record.record_type.replace('_', ' ')} records")
        panel_ids = provider_panel_patient_ids(db, current_user.id)
        if record.record_type == "provider_pricing":
            if record.provider_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        elif record.patient_id not in panel_ids and record.provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    elif current_user.role == UserRole.PHARMACIST:
        require_verified_workforce_member(current_user, f"update {record.record_type.replace('_', ' ')} records")
        if record.record_type not in PHARMACY_TYPES or record.provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    elif current_user.role in (UserRole.HOSPITAL, UserRole.AMBULANCE):
        require_verified_workforce_member(current_user, f"update {record.record_type.replace('_', ' ')} records")
        if record.record_type not in AMBULANCE_TYPES or record.provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(record, field, value)

    db.commit()
    db.refresh(record)
    if record.patient_id and record.record_type in {
        "medical_history",
        "clinical_note",
        "patient_problem",
        "patient_consent",
        "medication_adherence",
        "billing_record",
        "invoice",
        "service_charge",
    }:
        upsert_medical_record(
            db,
            patient_id=record.patient_id,
            provider=current_user if current_user.role != UserRole.PATIENT else None,
            record_type=record.record_type,
            category="structured",
            title=str((record.payload or {}).get("title") or (record.payload or {}).get("name") or record.record_type.replace("_", " ").title()),
            summary=record.status,
            status=record.status,
            event_time=record.created_at,
            source_record_id=f"structured:{record.id}",
            payload=record.payload if isinstance(record.payload, dict) else {},
        )
        db.commit()
    return _serialize(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(StructuredRecord).filter(StructuredRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    _require_allowed_type(record.record_type)
    if current_user.is_admin_or_super():
        pass
    elif current_user.role == UserRole.PATIENT:
        if record.patient_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    elif current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, f"delete {record.record_type.replace('_', ' ')} records")
        panel_ids = provider_panel_patient_ids(db, current_user.id)
        if record.record_type == "provider_pricing":
            if record.provider_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        elif record.patient_id not in panel_ids and record.provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    elif current_user.role == UserRole.PHARMACIST:
        require_verified_workforce_member(current_user, f"delete {record.record_type.replace('_', ' ')} records")
        if record.record_type not in PHARMACY_TYPES or record.provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    elif current_user.role in (UserRole.HOSPITAL, UserRole.AMBULANCE):
        require_verified_workforce_member(current_user, f"delete {record.record_type.replace('_', ' ')} records")
        if record.record_type not in AMBULANCE_TYPES or record.provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    db.delete(record)
    db.commit()
    return None


import sys

sys.modules.setdefault("app.routes.records", sys.modules[__name__])
sys.modules.setdefault("backend.app.routes.records", sys.modules[__name__])
