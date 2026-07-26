"""
File upload and document management endpoints
"""

import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.utils.time import utcnow

from database import get_db
from app.models.additional_features import PatientDocument
from app.models.user import User
from app.schemas.additional_features import (
    PatientDocumentResponse,
    PatientDocumentUpdate,
    DocumentListResponse,
)
from app.utils.dependencies import get_current_user
from app.utils.access import (
    provider_panel_patient_ids,
    require_provider_panel_access,
    require_verified_workforce_member,
)
from app.services.file_service import FileStorageService, DocumentService
from app.services.medical_record_sync import attach_document_to_record, create_db_notification, upsert_medical_record

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=PatientDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    description: str = None,
    is_private: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a medical document
    
    Allowed file types: PDF, DOC, DOCX, JPG, JPEG, PNG, TXT, XLS, XLSX
    Max size: 25 MB
    """
    # Only patients can upload documents
    if current_user.role.value != "patient":
        raise HTTPException(status_code=403, detail="Only patients can upload documents")

    try:
        # Save file
        file_info = await FileStorageService.save_file(
            file,
            subfolder=f"documents/{current_user.id}",
            prefix="doc"
        )

        # Categorize document
        file_type = DocumentService.categorize_document(file.filename)

        # Create document record
        document = PatientDocument(
            id=str(uuid.uuid4()),
            patient_id=current_user.id,
            file_id=file_info["file_id"],
            filename=file_info["filename"],
            file_type=file_type,
            file_size=file_info["file_size"],
            mime_type=file_info["mime_type"],
            description=description,
            uploaded_by=current_user.id,
            is_private=is_private,
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        from app.routes.audit import log_action

        await log_action(
            db=db,
            user_id=current_user.id,
            action="document.upload",
            resource_type="document",
            resource_id=document.patient_id,
            description=f"Uploaded document {document.filename}",
            status="created",
        )

        medical_record = upsert_medical_record(
            db,
            patient_id=current_user.id,
            provider=None,
            record_type="external_document",
            category="document",
            title=document.filename,
            summary=document.description,
            status="available",
            event_time=document.upload_time,
            source_record_id=f"patient-document:{document.id}",
            payload={
                "legacy_document_id": document.id,
                "document_type": document.file_type.value if hasattr(document.file_type, "value") else str(document.file_type),
                "is_private": document.is_private,
            },
            is_external=False,
        )
        await attach_document_to_record(
            db,
            medical_record=medical_record,
            uploaded_by=current_user,
            existing_file_id=document.file_id,
            filename=document.filename,
            mime_type=document.mime_type or "application/octet-stream",
            file_size=document.file_size or 0,
            storage_subpath=f"documents/{current_user.id}",
            document_type=document.file_type.value if hasattr(document.file_type, "value") else str(document.file_type),
            description=document.description,
            is_external=False,
            source_system="alera",
            source_document_id=document.id,
        )
        db.commit()

        return PatientDocumentResponse(**document.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to upload document"
        )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents for the current user"""
    
    # Patients see only their documents
    if current_user.role.value == "patient":
        query = db.query(PatientDocument).filter(
            PatientDocument.patient_id == current_user.id
        )
    # Providers see only shared documents for patients on their panel.
    elif current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view patient documents")
        panel_ids = provider_panel_patient_ids(db, current_user.id)
        if not panel_ids:
            return DocumentListResponse(total=0, items=[])
        query = db.query(PatientDocument).filter(
            PatientDocument.patient_id.in_(panel_ids),
            PatientDocument.is_private == False
        )
    # Admins see all documents
    elif current_user.is_admin_or_super():
        query = db.query(PatientDocument)
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return DocumentListResponse(
        total=total,
        items=[PatientDocumentResponse(**doc.to_dict()) for doc in items]
    )


@router.get("/{document_id}", response_model=PatientDocumentResponse)
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific document"""
    
    document = db.query(PatientDocument).filter(
        PatientDocument.id == document_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check permissions
    if current_user.role.value == "patient" and document.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role.value == "provider" and document.is_private:
        require_verified_workforce_member(current_user, "access patient documents")
        require_provider_panel_access(db, current_user.id, document.patient_id, "access this document")
        raise HTTPException(status_code=403, detail="Document is private")

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "access patient documents")
        require_provider_panel_access(db, current_user.id, document.patient_id, "access this document")

    # Update access tracking
    document.accessed_count = (document.accessed_count or 0) + 1
    document.last_accessed = utcnow()
    db.commit()

    return PatientDocumentResponse(**document.to_dict())


@router.put("/{document_id}", response_model=PatientDocumentResponse)
async def update_document(
    document_id: str,
    update_data: PatientDocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update document metadata"""
    
    document = db.query(PatientDocument).filter(
        PatientDocument.id == document_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Only document owner can update
    if document.patient_id != current_user.id and not current_user.is_admin_or_super():
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    if update_data.description is not None:
        document.description = update_data.description
    if update_data.is_private is not None:
        document.is_private = update_data.is_private

    db.commit()
    db.refresh(document)

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="document.update",
        resource_type="document",
        resource_id=document.patient_id,
        description=f"Updated document {document.filename}",
        status="updated",
    )

    return PatientDocumentResponse(**document.to_dict())


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document"""
    
    document = db.query(PatientDocument).filter(
        PatientDocument.id == document_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Only document owner can delete
    if document.patient_id != current_user.id and not current_user.is_admin_or_super():
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete file from storage
    FileStorageService.delete_file(document.file_id, f"documents/{document.patient_id}")

    # Delete database record
    db.delete(document)
    db.commit()

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="document.delete",
        resource_type="document",
        resource_id=document.patient_id,
        description=f"Deleted document {document.filename}",
        status="warning",
    )

    return None


@router.post("/{document_id}/download")
async def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a document"""
    from fastapi.responses import FileResponse
    
    document = db.query(PatientDocument).filter(
        PatientDocument.id == document_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check permissions
    if current_user.role.value == "patient" and document.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role.value == "provider" and document.is_private:
        require_verified_workforce_member(current_user, "download patient documents")
        require_provider_panel_access(db, current_user.id, document.patient_id, "download this document")
        raise HTTPException(status_code=403, detail="Document is private")

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "download patient documents")
        require_provider_panel_access(db, current_user.id, document.patient_id, "download this document")

    # Get file
    file_path = FileStorageService.get_file_path(
        document.file_id,
        f"documents/{document.patient_id}"
    )

    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="document.download",
        resource_type="document",
        resource_id=document.patient_id,
        description=f"Downloaded document {document.filename}",
        status="info",
    )

    return FileResponse(
        path=file_path,
        filename=document.filename,
        media_type=document.mime_type,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/patient/{patient_id}/documents", response_model=DocumentListResponse)
async def get_patient_documents(
    patient_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all documents for a patient (provider/admin only)"""
    
    if current_user.role.value not in ["provider", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view patient documents")
        require_provider_panel_access(db, current_user.id, patient_id, "view this patient document set")

    query = db.query(PatientDocument).filter(
        PatientDocument.patient_id == patient_id
    )

    if current_user.role.value == "provider":
        query = query.filter(PatientDocument.is_private == False)

    if current_user.is_admin_or_super():
        # Admins can see all documents
        query = db.query(PatientDocument).filter(
            PatientDocument.patient_id == patient_id
        )

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return DocumentListResponse(
        total=total,
        items=[PatientDocumentResponse(**doc.to_dict()) for doc in items]
    )
