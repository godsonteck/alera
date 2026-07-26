from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
from app.models.canonical_records import MedicalRecord, PatientPermission
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.schemas.canonical_records import (
    MedicalRecordCreate,
    MedicalRecordListResponse,
    MedicalRecordResponse,
    MedicalRecordUpdate,
    OrganizationResponse,
    PatientPermissionResponse,
    UnifiedPatientRecordResponse,
)
from app.services.medical_record_sync import (
    backfill_patient_canonical_records,
    create_db_notification,
    organization_for_user,
    serialize_medical_record,
    upsert_medical_record,
)
from app.utils.access import current_user_organization, require_medical_record_access
from app.utils.dependencies import get_current_user
from app.utils.websocket_manager import manager

router = APIRouter(prefix="/api/medical-records", tags=["medical-records"])


def _serialize(record: MedicalRecord) -> MedicalRecordResponse:
    return MedicalRecordResponse(**serialize_medical_record(record))


@router.get("", response_model=MedicalRecordListResponse)
async def list_medical_records(
    patient_id: int | None = Query(default=None),
    record_type: str | None = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(MedicalRecord).options(joinedload(MedicalRecord.documents))

    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        if patient_id is not None:
            query = query.filter(MedicalRecord.patient_id == patient_id)
        if record_type:
            query = query.filter(MedicalRecord.record_type == record_type)
        rows = query.order_by(MedicalRecord.event_time.desc()).offset(skip).limit(limit).all()
        metadata_rows = [
            MedicalRecordResponse(
                id=row.id,
                patient_id=row.patient_id,
                organization_id=row.organization_id,
                provider_id=row.provider_id,
                parent_record_id=row.parent_record_id,
                record_type=row.record_type,
                category=row.category,
                title=row.title,
                summary=None,
                status=row.status,
                event_time=row.event_time,
                source_system=row.source_system,
                source_record_id=row.source_record_id,
                source_version=row.source_version,
                is_external=row.is_external,
                is_deleted=row.is_deleted,
                sync_status=row.sync_status,
                payload={},
                created_at=row.created_at,
                updated_at=row.updated_at,
                documents=[],
            )
            for row in rows
        ]
        return MedicalRecordListResponse(total=len(metadata_rows), items=metadata_rows)

    if patient_id is None:
        if current_user.role == UserRole.PATIENT:
            patient_id = current_user.id
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="patient_id is required")

    require_medical_record_access(db, current_user, patient_id)
    backfill_patient_canonical_records(db, patient_id)

    query = query.filter(MedicalRecord.patient_id == patient_id, MedicalRecord.is_deleted.is_(False))
    if record_type:
        query = query.filter(MedicalRecord.record_type == record_type)
    total = query.count()
    rows = query.order_by(MedicalRecord.event_time.desc(), MedicalRecord.created_at.desc()).offset(skip).limit(limit).all()
    return MedicalRecordListResponse(total=total, items=[_serialize(row) for row in rows])


@router.get("/timeline", response_model=MedicalRecordListResponse)
async def get_medical_timeline(
    patient_id: int,
    limit: int = 250,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_medical_record_access(db, current_user, patient_id)
    backfill_patient_canonical_records(db, patient_id)
    rows = (
        db.query(MedicalRecord)
        .options(joinedload(MedicalRecord.documents))
        .filter(MedicalRecord.patient_id == patient_id, MedicalRecord.is_deleted.is_(False))
        .order_by(MedicalRecord.event_time.desc(), MedicalRecord.created_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return MedicalRecordListResponse(total=len(rows), items=[_serialize(row) for row in rows])


@router.get("/unified/{patient_id}", response_model=UnifiedPatientRecordResponse)
async def get_unified_patient_record(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_medical_record_access(db, current_user, patient_id)
    backfill_patient_canonical_records(db, patient_id)
    records = (
        db.query(MedicalRecord)
        .options(joinedload(MedicalRecord.documents))
        .filter(MedicalRecord.patient_id == patient_id, MedicalRecord.is_deleted.is_(False))
        .order_by(MedicalRecord.event_time.desc(), MedicalRecord.created_at.desc())
        .all()
    )
    permissions = (
        db.query(PatientPermission)
        .filter(PatientPermission.patient_id == patient_id)
        .order_by(PatientPermission.updated_at.desc())
        .all()
    )
    org_ids = {row.organization_id for row in permissions if row.organization_id is not None} | {row.organization_id for row in records if row.organization_id is not None}
    organizations = db.query(Organization).filter(Organization.id.in_(org_ids)).all() if org_ids else []
    document_count = sum(len(record.documents) for record in records)
    return UnifiedPatientRecordResponse(
        patient_id=patient_id,
        organization_access=[OrganizationResponse(**org.to_dict()) for org in organizations],
        permissions=[PatientPermissionResponse(**permission.to_dict()) for permission in permissions],
        records=[_serialize(record) for record in records],
        timeline=[_serialize(record) for record in records],
        document_count=document_count,
    )


@router.post("", response_model=MedicalRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_medical_record(
    body: MedicalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.PATIENT and body.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients can only create records for themselves")
    if current_user.role not in (UserRole.PATIENT, UserRole.PROVIDER, UserRole.PHARMACIST, UserRole.HOSPITAL, UserRole.LABORATORY, UserRole.IMAGING, UserRole.AMBULANCE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role != UserRole.PATIENT:
        require_medical_record_access(db, current_user, body.patient_id)

    record = upsert_medical_record(
        db,
        patient_id=body.patient_id,
        provider=current_user if current_user.role != UserRole.PATIENT else None,
        record_type=body.record_type,
        category=body.category,
        title=body.title,
        summary=body.summary,
        status=body.status,
        event_time=body.event_time,
        source_system=body.source_system,
        source_record_id=body.source_record_id or f"manual:{body.id or uuid.uuid4()}",
        source_version=body.source_version,
        is_external=body.is_external,
        parent_record_id=body.parent_record_id,
        payload=body.payload,
    )
    db.commit()
    db.refresh(record)
    await create_db_notification(
        db,
        user_id=body.patient_id,
        title="Medical record updated",
        message=f"A new {body.record_type.replace('_', ' ')} entry was added to your unified record.",
        notification_type="medical_record",
        action_url="/dashboard/medical-history",
    )
    await manager.send_to_user(body.patient_id, {"type": "medical_record.updated", "patient_id": body.patient_id, "record_id": record.id})
    return _serialize(record)


@router.put("/{record_id}", response_model=MedicalRecordResponse)
async def update_medical_record(
    record_id: str,
    body: MedicalRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(MedicalRecord).options(joinedload(MedicalRecord.documents)).filter(MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical record not found")
    if current_user.role == UserRole.PATIENT and record.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role != UserRole.PATIENT:
        require_medical_record_access(db, current_user, record.patient_id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return _serialize(record)
