from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.additional_features import PatientDocument
from app.models.allergy import Allergy
from app.models.appointment import Appointment
from app.models.canonical_records import MedicalDocument, MedicalRecord, PatientPermission
from app.models.lab_imaging import ImagingScan, LabTest
from app.models.medical_history import MedicalHistory
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.prescription import Prescription
from app.models.structured_record import StructuredRecord
from app.models.user import User, UserRole
from app.services.file_service import DocumentService, FileStorageService
from app.utils.time import utcnow
from app.utils.websocket_manager import manager


ACTIVE_PERMISSION_STATUSES = {"granted"}
WORKFORCE_ORG_ROLES = {
    UserRole.PROVIDER,
    UserRole.PHARMACIST,
    UserRole.HOSPITAL,
    UserRole.LABORATORY,
    UserRole.IMAGING,
    UserRole.AMBULANCE,
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or f"org-{uuid.uuid4().hex[:8]}"


def organization_type_for_user(user: User) -> str:
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    return {
        "provider": "clinic",
        "pharmacist": "pharmacy",
        "hospital": "hospital",
        "laboratory": "laboratory",
        "imaging": "imaging",
        "ambulance": "ambulance",
    }.get(role, role)


def ensure_user_organization(db: Session, user: User | None) -> Organization | None:
    if user is None or user.role not in WORKFORCE_ORG_ROLES | {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        return None

    if user.organization_id:
        organization = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if organization:
            return organization

    display_name = f"{user.first_name} {user.last_name}".strip() or user.email
    organization_name = display_name if user.role != UserRole.PROVIDER else f"{display_name} Practice"
    base_slug = slugify(f"{organization_name}-{organization_type_for_user(user)}")
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    organization = Organization(
        name=organization_name,
        slug=slug,
        organization_type=organization_type_for_user(user),
        created_by=user.id,
    )
    db.add(organization)
    db.flush()
    user.organization_id = organization.id
    db.flush()
    return organization


def serialize_medical_document(document: MedicalDocument) -> dict[str, Any]:
    return document.to_dict()


def serialize_medical_record(record: MedicalRecord) -> dict[str, Any]:
    payload = record.to_dict()
    payload["documents"] = [serialize_medical_document(document) for document in record.documents]
    return payload


async def create_db_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    related_type: str | None = None,
    related_id: int | None = None,
    action_url: str | None = None,
    realtime_event: str = "medical_record.updated",
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        related_type=related_type,
        related_id=related_id,
        action_url=action_url,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    await manager.send_to_user(
        user_id,
        {
            "type": realtime_event,
            "notification": {
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "notification_type": notification.notification_type,
                "related_type": notification.related_type,
                "related_id": notification.related_id,
                "action_url": notification.action_url,
                "created_at": notification.created_at.isoformat() if notification.created_at else None,
            },
        },
    )
    return notification


def upsert_medical_record(
    db: Session,
    *,
    patient_id: int,
    provider: User | None,
    record_type: str,
    title: str,
    summary: str | None = None,
    status: str | None = None,
    event_time: datetime | None = None,
    payload: dict[str, Any] | None = None,
    category: str | None = None,
    source_system: str = "alera",
    source_record_id: str | None = None,
    source_version: str | None = None,
    is_external: bool = False,
    parent_record_id: str | None = None,
) -> MedicalRecord:
    organization = ensure_user_organization(db, provider) if provider else None
    query = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id)
    if source_record_id:
        query = query.filter(
            MedicalRecord.source_system == source_system,
            MedicalRecord.source_record_id == source_record_id,
        )
        record = query.first()
    else:
        record = None

    if record is None:
        record = MedicalRecord(
            id=str(uuid.uuid4()),
            patient_id=patient_id,
            organization_id=organization.id if organization else None,
            provider_id=provider.id if provider else None,
            parent_record_id=parent_record_id,
            record_type=record_type,
            category=category,
            title=title,
            summary=summary,
            status=status,
            event_time=event_time or utcnow(),
            source_system=source_system,
            source_record_id=source_record_id,
            source_version=source_version,
            is_external=is_external,
            payload=payload or {},
        )
        db.add(record)
    else:
        record.organization_id = organization.id if organization else record.organization_id
        record.provider_id = provider.id if provider else record.provider_id
        record.parent_record_id = parent_record_id or record.parent_record_id
        record.record_type = record_type
        record.category = category
        record.title = title
        record.summary = summary
        record.status = status
        record.event_time = event_time or record.event_time
        record.source_version = source_version or record.source_version
        record.is_external = is_external
        record.sync_status = "synced"
        record.payload = payload or {}
    db.flush()
    return record


async def attach_document_to_record(
    db: Session,
    *,
    medical_record: MedicalRecord,
    uploaded_by: User | None,
    file: UploadFile | None = None,
    existing_file_id: str | None = None,
    filename: str | None = None,
    mime_type: str | None = None,
    file_size: int | None = None,
    storage_subpath: str | None = None,
    document_type: str | None = None,
    description: str | None = None,
    is_external: bool = False,
    source_system: str = "alera",
    source_document_id: str | None = None,
) -> MedicalDocument | None:
    organization = ensure_user_organization(db, uploaded_by) if uploaded_by else None

    if file is not None:
        storage_subpath = storage_subpath or f"medical-records/{medical_record.patient_id}"
        file_info = await FileStorageService.save_file(file, subfolder=storage_subpath, prefix="medical")
        existing_file_id = file_info["file_id"]
        filename = file_info["filename"]
        mime_type = file_info["mime_type"]
        file_size = file_info["file_size"]
        document_type = document_type or DocumentService.categorize_document(filename or "document")
    elif not all([existing_file_id, filename, mime_type, file_size, storage_subpath, document_type]):
        return None

    document = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.file_id == existing_file_id)
        .first()
    )
    if document is None:
        document = MedicalDocument(
            id=str(uuid.uuid4()),
            medical_record_id=medical_record.id,
            patient_id=medical_record.patient_id,
            organization_id=organization.id if organization else medical_record.organization_id,
            uploaded_by=uploaded_by.id if uploaded_by else None,
            file_id=existing_file_id,
            filename=filename or "document",
            mime_type=mime_type or "application/octet-stream",
            file_size=int(file_size or 0),
            document_type=document_type or "other",
            storage_subpath=storage_subpath or f"medical-records/{medical_record.patient_id}",
            description=description,
            is_external=is_external,
            source_system=source_system,
            source_document_id=source_document_id,
        )
        db.add(document)
    else:
        document.medical_record_id = medical_record.id
        document.organization_id = organization.id if organization else document.organization_id
        document.uploaded_by = uploaded_by.id if uploaded_by else document.uploaded_by
        document.filename = filename or document.filename
        document.mime_type = mime_type or document.mime_type
        document.file_size = int(file_size or document.file_size)
        document.document_type = document_type or document.document_type
        document.storage_subpath = storage_subpath or document.storage_subpath
        document.description = description if description is not None else document.description
        document.is_external = is_external
        document.source_system = source_system
        document.source_document_id = source_document_id or document.source_document_id
    db.flush()
    return document


def permission_is_active(permission: PatientPermission | None) -> bool:
    if permission is None or permission.status not in ACTIVE_PERMISSION_STATUSES:
        return False
    if permission.expires_at and permission.expires_at < utcnow():
        return False
    return True


def active_permission_for_organization(db: Session, *, patient_id: int, organization_id: int) -> PatientPermission | None:
    rows = (
        db.query(PatientPermission)
        .filter(
            PatientPermission.patient_id == patient_id,
            PatientPermission.organization_id == organization_id,
        )
        .order_by(PatientPermission.updated_at.desc())
        .all()
    )
    for row in rows:
        if permission_is_active(row):
            return row
    return None


def permission_allows_scope(permission: PatientPermission | None, scope: str) -> bool:
    if not permission_is_active(permission):
        return False
    scopes = permission.scope or []
    return "full_record" in scopes or scope in scopes


def organization_for_user(db: Session, user: User | None) -> Organization | None:
    if user is None:
        return None
    return ensure_user_organization(db, user)


def provider_has_patient_record_access(
    db: Session,
    *,
    provider: User,
    patient_id: int,
    required_scope: str = "full_record",
) -> bool:
    organization = organization_for_user(db, provider)
    if organization is None:
        return False
    permission = active_permission_for_organization(db, patient_id=patient_id, organization_id=organization.id)
    return permission_allows_scope(permission, required_scope)


@dataclass
class BackfillResult:
    created_or_updated: int = 0


def backfill_patient_canonical_records(db: Session, patient_id: int) -> BackfillResult:
    result = BackfillResult()

    def apply(record: MedicalRecord | None):
        if record is not None:
            result.created_or_updated += 1

    def _users_by_id(ids: set[int]) -> dict[int, User]:
        if not ids:
            return {}
        return {
            user.id: user
            for user in db.query(User).filter(User.id.in_(ids)).all()
        }

    appointments = db.query(Appointment).filter(Appointment.patient_id == patient_id).all()
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).all()
    lab_tests = db.query(LabTest).filter(LabTest.patient_id == patient_id).all()
    imaging_scans = db.query(ImagingScan).filter(ImagingScan.patient_id == patient_id).all()
    structured_records = db.query(StructuredRecord).filter(StructuredRecord.patient_id == patient_id).all()
    patient_documents = db.query(PatientDocument).filter(PatientDocument.patient_id == patient_id).all()

    provider_ids = {
        appointment.provider_id for appointment in appointments if appointment.provider_id is not None
    }
    provider_ids |= {
        prescription.provider_id for prescription in prescriptions if prescription.provider_id is not None
    }
    provider_ids |= {
        test.ordered_by for test in lab_tests if test.ordered_by is not None
    }
    provider_ids |= {
        scan.ordered_by for scan in imaging_scans if scan.ordered_by is not None
    }
    provider_ids |= {
        structured.provider_id for structured in structured_records if structured.provider_id is not None
    }
    provider_ids |= {
        patient_document.uploaded_by for patient_document in patient_documents if patient_document.uploaded_by is not None
    }
    users_by_id = _users_by_id(provider_ids)

    for appointment in appointments:
        provider = users_by_id.get(appointment.provider_id)
        apply(
            upsert_medical_record(
                db,
                patient_id=patient_id,
                provider=provider,
                record_type="appointment",
                category="encounter",
                title=appointment.title,
                summary=appointment.description,
                status=appointment.status.value if hasattr(appointment.status, "value") else str(appointment.status),
                event_time=appointment.scheduled_time,
                source_record_id=f"appointment:{appointment.id}",
                payload={
                    "appointment_id": appointment.id,
                    "appointment_type": appointment.appointment_type.value if hasattr(appointment.appointment_type, "value") else str(appointment.appointment_type),
                    "location": appointment.location,
                    "notes": appointment.notes,
                },
            )
        )

    allergies = db.query(Allergy).filter(Allergy.patient_id == patient_id).all()
    for allergy in allergies:
        apply(
            upsert_medical_record(
                db,
                patient_id=patient_id,
                provider=None,
                record_type="allergy",
                category="allergy",
                title=allergy.allergen,
                summary=allergy.reaction_description,
                status=allergy.severity,
                event_time=allergy.created_at,
                source_record_id=f"allergy:{allergy.id}",
                payload={
                    "allergen_type": allergy.allergen_type,
                    "treatment": allergy.treatment,
                    "confirmed": allergy.confirmed,
                },
            )
        )

    histories = db.query(MedicalHistory).filter(MedicalHistory.patient_id == patient_id).all()
    for history in histories:
        apply(
            upsert_medical_record(
                db,
                patient_id=patient_id,
                provider=None,
                record_type="medical_condition",
                category="condition",
                title=history.condition_name,
                summary=history.description,
                status=history.status,
                event_time=history.onset_date or history.created_at,
                source_record_id=f"medical-history:{history.id}",
                payload={
                    "icd_code": history.icd_code,
                    "severity": history.severity,
                    "treatment": history.treatment,
                    "notes": history.notes,
                },
            )
        )

    for prescription in prescriptions:
        provider = users_by_id.get(prescription.provider_id)
        apply(
            upsert_medical_record(
                db,
                patient_id=patient_id,
                provider=provider,
                record_type="prescription",
                category="medication",
                title=prescription.medication_name,
                summary=prescription.instructions,
                status=prescription.status,
                event_time=prescription.prescribed_date,
                source_record_id=f"prescription:{prescription.id}",
                payload={
                    "dosage": prescription.dosage,
                    "dosage_unit": prescription.dosage_unit,
                    "frequency": prescription.frequency,
                    "route": prescription.route,
                    "pharmacy_id": prescription.pharmacy_id,
                    "refills": prescription.refills,
                    "refills_remaining": prescription.refills_remaining,
                },
            )
        )

    for test in lab_tests:
        provider = users_by_id.get(test.ordered_by)
        apply(
            upsert_medical_record(
                db,
                patient_id=patient_id,
                provider=provider,
                record_type="lab_result",
                category="laboratory",
                title=test.test_name,
                summary=test.result_notes or test.description,
                status=test.status.value if hasattr(test.status, "value") else str(test.status),
                event_time=test.completed_at or test.ordered_at,
                source_record_id=f"lab-test:{test.id}",
                payload=test.to_dict(),
            )
        )

    for scan in imaging_scans:
        provider = users_by_id.get(scan.ordered_by)
        record = upsert_medical_record(
            db,
            patient_id=patient_id,
            provider=provider,
            record_type="imaging_result",
            category="imaging",
            title=scan.scan_type,
            summary=scan.impression or scan.findings,
            status=scan.status.value if hasattr(scan.status, "value") else str(scan.status),
            event_time=scan.completed_at or scan.ordered_at,
            source_record_id=f"imaging:{scan.id}",
            payload=scan.to_dict(),
        )
        apply(record)

        if scan.report_file_id and record:
            attach_document = (
                db.query(MedicalDocument)
                .filter(MedicalDocument.file_id == scan.report_file_id)
                .first()
            )
            if attach_document is None:
                document = MedicalDocument(
                    id=str(uuid.uuid4()),
                    medical_record_id=record.id,
                    patient_id=patient_id,
                    organization_id=record.organization_id,
                    uploaded_by=scan.processed_by,
                    file_id=scan.report_file_id,
                    filename=scan.report_filename or "report",
                    mime_type=scan.report_mime_type or "application/octet-stream",
                    file_size=scan.report_file_size or 0,
                    document_type="imaging",
                    storage_subpath=f"imaging/{scan.id}",
                    description="Imaging report",
                    is_external=False,
                    source_system="alera",
                    source_document_id=f"imaging-report:{scan.id}",
                )
                db.add(document)

    for structured in structured_records:
        provider = users_by_id.get(structured.provider_id) if structured.provider_id else None
        apply(
            upsert_medical_record(
                db,
                patient_id=patient_id,
                provider=provider,
                record_type=structured.record_type,
                category="structured",
                title=str(structured.payload.get("title") or structured.payload.get("name") or structured.record_type.replace("_", " ").title()) if isinstance(structured.payload, dict) else structured.record_type,
                summary=structured.status,
                status=structured.status,
                event_time=structured.created_at,
                source_record_id=f"structured:{structured.id}",
                payload=structured.payload if isinstance(structured.payload, dict) else {},
            )
        )

    for patient_document in patient_documents:
        record = upsert_medical_record(
            db,
            patient_id=patient_id,
            provider=users_by_id.get(patient_document.uploaded_by) if patient_document.uploaded_by else None,
            record_type="external_document" if patient_document.file_type.value == "other" else patient_document.file_type.value,
            category="document",
            title=patient_document.filename,
            summary=patient_document.description,
            status="available",
            event_time=patient_document.upload_time,
            source_record_id=f"patient-document:{patient_document.id}",
            payload={"legacy_document_id": patient_document.id, "is_private": patient_document.is_private},
            is_external=patient_document.uploaded_by != patient_id,
        )
        existing_doc = db.query(MedicalDocument).filter(MedicalDocument.file_id == patient_document.file_id).first()
        if existing_doc is None:
            db.add(
                MedicalDocument(
                    id=str(uuid.uuid4()),
                    medical_record_id=record.id,
                    patient_id=patient_id,
                    organization_id=record.organization_id,
                    uploaded_by=patient_document.uploaded_by,
                    file_id=patient_document.file_id,
                    filename=patient_document.filename,
                    mime_type=patient_document.mime_type or "application/octet-stream",
                    file_size=patient_document.file_size or 0,
                    document_type=patient_document.file_type.value if hasattr(patient_document.file_type, "value") else str(patient_document.file_type),
                    storage_subpath=f"documents/{patient_id}",
                    description=patient_document.description,
                    is_external=patient_document.uploaded_by != patient_id,
                    source_system="alera",
                    source_document_id=f"legacy-document:{patient_document.id}",
                )
            )

    db.commit()
    return result


def file_path_for_medical_document(document: MedicalDocument) -> Path | None:
    return FileStorageService.get_file_path(document.file_id, document.storage_subpath)
