from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
from app.models.canonical_records import MedicalRecord
from app.models.user import User, UserRole
from app.schemas.canonical_records import ExternalMedicalIngestionResponse, MedicalRecordResponse
from app.services.medical_record_sync import attach_document_to_record, create_db_notification, serialize_medical_record, upsert_medical_record
from app.utils.access import require_medical_record_access
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/external-ingestion", tags=["external-ingestion"])


@router.post("", response_model=ExternalMedicalIngestionResponse, status_code=status.HTTP_201_CREATED)
async def ingest_external_medical_record(
    patient_id: int = Form(...),
    record_type: str = Form(...),
    title: str = Form(...),
    source_system: str = Form(...),
    source_record_id: str = Form(...),
    event_time: str | None = Form(default=None),
    summary: str | None = Form(default=None),
    provider_name: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    category: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.PATIENT:
        if current_user.id != patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients can only import records into their own chart")
    else:
        require_medical_record_access(db, current_user, patient_id)

    try:
        parsed_event_time = datetime.fromisoformat(event_time) if event_time else None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event_time format. Use ISO 8601 (e.g., YYYY-MM-DDTHH:MM:SSZ)"
        )
    payload = {
        "provider_name": provider_name,
        "notes": notes,
        "document_type": document_type,
    }
    record = upsert_medical_record(
        db,
        patient_id=patient_id,
        provider=current_user if current_user.role != UserRole.PATIENT else None,
        record_type=record_type,
        category=category or "external",
        title=title,
        summary=summary,
        event_time=parsed_event_time,
        source_system=source_system,
        source_record_id=source_record_id,
        is_external=True,
        payload=payload,
    )
    document = None
    if file is not None and file.filename:
        document = await attach_document_to_record(
            db,
            medical_record=record,
            uploaded_by=current_user,
            file=file,
            storage_subpath=f"medical-records/{patient_id}",
            description=notes,
            document_type=document_type,
            is_external=True,
            source_system=source_system,
            source_document_id=source_record_id,
        )
    db.commit()
    loaded = db.query(MedicalRecord).options(joinedload(MedicalRecord.documents)).filter(MedicalRecord.id == record.id).first()
    if not loaded:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load ingested record")
    await create_db_notification(
        db,
        user_id=patient_id,
        title="External medical record imported",
        message=f"A new external {record_type.replace('_', ' ')} record was imported into your chart.",
        notification_type="medical_record",
        action_url="/dashboard/medical-history",
    )
    return ExternalMedicalIngestionResponse(
        medical_record=MedicalRecordResponse(**serialize_medical_record(loaded)),
        document=document.to_dict() if document else None,
    )
