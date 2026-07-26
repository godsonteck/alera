from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from app.models.canonical_records import MedicalDocument, MedicalRecord
from app.models.user import User, UserRole
from app.schemas.canonical_records import MedicalDocumentResponse
from app.services.medical_record_sync import attach_document_to_record, file_path_for_medical_document
from app.utils.access import require_medical_record_access
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/medical-documents", tags=["medical-documents"])


def _serialize(document: MedicalDocument) -> MedicalDocumentResponse:
    return MedicalDocumentResponse(**document.to_dict())


@router.post("/upload", response_model=MedicalDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_medical_document(
    medical_record_id: str = Form(...),
    description: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(MedicalRecord).filter(MedicalRecord.id == medical_record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical record not found")

    if current_user.role == UserRole.PATIENT and record.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role != UserRole.PATIENT:
        require_medical_record_access(db, current_user, record.patient_id)

    document = await attach_document_to_record(
        db,
        medical_record=record,
        uploaded_by=current_user,
        file=file,
        storage_subpath=f"medical-records/{record.patient_id}",
        description=description,
        document_type=document_type,
        is_external=False,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No document was created")
    db.commit()
    db.refresh(document)
    return _serialize(document)


@router.get("/{document_id}", response_model=MedicalDocumentResponse)
async def get_medical_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical document not found")
    require_medical_record_access(db, current_user, document.patient_id)
    return _serialize(document)


@router.get("/{document_id}/download")
async def download_medical_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical document not found")
    require_medical_record_access(db, current_user, document.patient_id)
    file_path = file_path_for_medical_document(document)
    if file_path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file not found")
    return FileResponse(
        file_path,
        filename=document.filename,
        media_type=document.mime_type,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
