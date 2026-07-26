from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
from app.models import ImagingScan, User, UserRole, ImagingScanStatus
from app.schemas import ImagingFileAsset, ImagingScanResponse, ImagingScanCreate, ImagingScanUpdate
from app.services.file_service import FileStorageService
from app.services.postdicom_service import PostDICOMService
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.utils.time import utcnow
from app.services.medical_record_sync import attach_document_to_record, create_db_notification, upsert_medical_record

router = APIRouter(prefix="/api/imaging", tags=["imaging"])


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or None


def imaging_to_response(scan: ImagingScan) -> ImagingScanResponse:
    report_file = None
    if scan.report_file_id:
        report_file = ImagingFileAsset(
            file_id=scan.report_file_id,
            filename=scan.report_filename or "report",
            mime_type=scan.report_mime_type or "application/octet-stream",
            file_size=scan.report_file_size or 0,
            download_url=scan.report_url,
        )

    image_files = [
        ImagingFileAsset(**asset)
        for asset in (scan.image_files or [])
        if isinstance(asset, dict) and asset.get("file_id") and asset.get("filename")
    ]

    return ImagingScanResponse(
        id=scan.id,
        patient_id=scan.patient_id,
        ordered_by=scan.ordered_by,
        destination_provider_id=scan.destination_provider_id,
        destination_provider_name=_display_name(scan.destination_provider),
        processed_by=scan.processed_by,
        scan_type=scan.scan_type,
        body_part=scan.body_part,
        clinical_indication=scan.clinical_indication,
        status=scan.status.value if scan.status else ImagingScanStatus.ORDERED.value,
        findings=scan.findings,
        impression=scan.impression,
        report_url=scan.report_url,
        image_url=scan.image_url,
        report_file=report_file,
        image_files=image_files,
        postdicom_study_id=scan.postdicom_study_id,
        postdicom_study_url=scan.postdicom_study_url,
        scheduled_at=scan.scheduled_at,
        ordered_at=scan.ordered_at,
        completed_at=scan.completed_at,
        created_at=scan.created_at,
        patient_name=_display_name(scan.patient),
        ordered_by_name=_display_name(scan.doctor),
    )


def _can_access_scan(current_user: User, scan: ImagingScan) -> bool:
    if current_user.is_admin_or_super():
        return True
    if current_user.role == UserRole.PATIENT:
        return scan.patient_id == current_user.id
    if current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "access imaging scans")
        return scan.ordered_by == current_user.id
    if current_user.role == UserRole.IMAGING:
        require_verified_workforce_member(current_user, "access imaging scans")
        return scan.destination_provider_id == current_user.id
    return False


def _storage_subfolder(scan: ImagingScan) -> str:
    return f"imaging/{scan.id}"


def _report_download_url(scan_id: int) -> str:
    return f"/api/imaging/{scan_id}/report"


def _image_download_url(scan_id: int, file_id: str) -> str:
    return f"/api/imaging/{scan_id}/images/{file_id}"


def _load_scan_with_users(db: Session, scan_id: int) -> ImagingScan | None:
    return (
        db.query(ImagingScan)
        .options(joinedload(ImagingScan.patient), joinedload(ImagingScan.doctor), joinedload(ImagingScan.destination_provider))
        .filter(ImagingScan.id == scan_id)
        .first()
    )


@router.post("/", response_model=ImagingScanResponse, status_code=status.HTTP_201_CREATED)
async def order_imaging_scan(
    imaging_scan: ImagingScanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Order a new imaging scan (provider or admin)."""

    if current_user.role not in (UserRole.PROVIDER, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only providers can order imaging scans",
        )
    if current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "order imaging scans")

    patient = db.query(User).filter(User.id == imaging_scan.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    destination_provider = db.query(User).filter(User.id == imaging_scan.destination_provider_id).first()
    if not destination_provider or destination_provider.role != UserRole.IMAGING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination provider must be an imaging center")
    if not destination_provider.is_active or not destination_provider.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination imaging center must be active and verified")

    db_imaging_scan = ImagingScan(
        patient_id=imaging_scan.patient_id,
        ordered_by=current_user.id,
        destination_provider_id=imaging_scan.destination_provider_id,
        scan_type=imaging_scan.scan_type,
        body_part=imaging_scan.body_part,
        clinical_indication=imaging_scan.clinical_indication,
        status=ImagingScanStatus.ORDERED,
    )

    db.add(db_imaging_scan)
    db.commit()

    loaded = _load_scan_with_users(db, db_imaging_scan.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load created imaging scan")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="imaging_scan.create",
        resource_type="imaging_scan",
        resource_id=loaded.id,
        description=f"Ordered imaging scan {loaded.scan_type} for patient {loaded.patient_id}",
        status="created",
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.doctor,
        record_type="imaging_result",
        category="imaging",
        title=loaded.scan_type,
        summary=loaded.clinical_indication,
        status=loaded.status,
        event_time=loaded.ordered_at,
        source_record_id=f"imaging:{loaded.id}",
        payload=loaded.to_dict(),
    )
    db.commit()
    return imaging_to_response(loaded)


@router.get("/", response_model=list[ImagingScanResponse])
async def list_imaging_scans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List imaging scans visible to the current user."""

    if current_user.role == UserRole.PATIENT:
        query = db.query(ImagingScan).filter(ImagingScan.patient_id == current_user.id)
    elif current_user.role == UserRole.IMAGING:
        require_verified_workforce_member(current_user, "view imaging scans")
        query = db.query(ImagingScan).filter(ImagingScan.destination_provider_id == current_user.id)
    elif current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "view imaging scans")
        query = db.query(ImagingScan).filter(ImagingScan.ordered_by == current_user.id)
    elif current_user.is_admin_or_super():
        query = db.query(ImagingScan)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    rows = (
        query.options(joinedload(ImagingScan.patient), joinedload(ImagingScan.doctor), joinedload(ImagingScan.destination_provider))
        .order_by(ImagingScan.ordered_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [imaging_to_response(s) for s in rows]


@router.get("/{scan_id}", response_model=ImagingScanResponse)
async def get_imaging_scan(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get imaging scan details."""

    db_imaging_scan = _load_scan_with_users(db, scan_id)
    if not db_imaging_scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imaging scan not found",
        )

    if current_user.role == UserRole.PATIENT and db_imaging_scan.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    if not _can_access_scan(current_user, db_imaging_scan):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return imaging_to_response(db_imaging_scan)


@router.put("/{scan_id}", response_model=ImagingScanResponse)
async def update_imaging_scan(
    scan_id: int,
    imaging_scan_update: ImagingScanUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update imaging scan (imaging staff, ordering provider for own orders, or admin)."""

    db_imaging_scan = db.query(ImagingScan).filter(ImagingScan.id == scan_id).first()
    if not db_imaging_scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imaging scan not found",
        )

    if current_user.role not in (UserRole.IMAGING, UserRole.PROVIDER, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update imaging scans",
        )
    if current_user.role == UserRole.PROVIDER and db_imaging_scan.ordered_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this imaging scan",
        )
    if current_user.role == UserRole.IMAGING and db_imaging_scan.destination_provider_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this imaging scan",
        )
    if current_user.role in (UserRole.PROVIDER, UserRole.IMAGING):
        require_verified_workforce_member(current_user, "update imaging scans")

    update_data = imaging_scan_update.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        try:
            db_imaging_scan.status = ImagingScanStatus(str(update_data["status"]))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid imaging scan status",
            ) from None
        del update_data["status"]

    for field, value in update_data.items():
        setattr(db_imaging_scan, field, value)

    if current_user.role == UserRole.IMAGING:
        db_imaging_scan.processed_by = current_user.id

    db.commit()

    loaded = _load_scan_with_users(db, scan_id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load imaging scan")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="imaging_scan.update",
        resource_type="imaging_scan",
        resource_id=loaded.id,
        description=f"Updated imaging scan {loaded.id}",
        status="updated",
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.doctor,
        record_type="imaging_result",
        category="imaging",
        title=loaded.scan_type,
        summary=loaded.impression or loaded.findings or loaded.clinical_indication,
        status=loaded.status,
        event_time=loaded.completed_at or loaded.ordered_at,
        source_record_id=f"imaging:{loaded.id}",
        payload=loaded.to_dict(),
    )
    db.commit()
    return imaging_to_response(loaded)


@router.post("/{scan_id}/results", response_model=ImagingScanResponse)
async def upload_imaging_results(
    scan_id: int,
    findings: str | None = Form(default=None),
    impression: str | None = Form(default=None),
    status_value: str | None = Form(default="completed", alias="status"),
    report_file: UploadFile | None = File(default=None),
    image_files: list[UploadFile] | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload imaging artifacts and written results for an imaging study."""

    db_imaging_scan = _load_scan_with_users(db, scan_id)
    if not db_imaging_scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging scan not found")

    if current_user.role not in (UserRole.IMAGING, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only imaging centers can upload imaging results")
    if current_user.role == UserRole.IMAGING:
        require_verified_workforce_member(current_user, "upload imaging results")
        if db_imaging_scan.destination_provider_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to upload results for this imaging scan")
        if not current_user.postdicom_api_url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PostDICOM endpoint is required for imaging center uploads")

    normalized_images = [file for file in (image_files or []) if file and file.filename]
    if not report_file and not normalized_images and not findings and not impression:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one report field, report file, or imaging file",
        )

    subfolder = _storage_subfolder(db_imaging_scan)
    use_postdicom = current_user.role == UserRole.IMAGING

    if use_postdicom:
        postdicom_result = await PostDICOMService.upload_imaging_results(
            current_user.postdicom_api_url,
            current_user.postdicom_api_key,
            db_imaging_scan,
            report_file,
            normalized_images,
            findings,
            impression,
            status_value,
        )
        if isinstance(postdicom_result, dict):
            db_imaging_scan.postdicom_study_id = postdicom_result.get("study_id") or postdicom_result.get("id")
            db_imaging_scan.postdicom_study_url = postdicom_result.get("study_url") or postdicom_result.get("url")
        db_imaging_scan.report_file_id = None
        db_imaging_scan.report_filename = None
        db_imaging_scan.report_mime_type = None
        db_imaging_scan.report_file_size = None
        db_imaging_scan.report_url = None
        db_imaging_scan.image_files = []
        db_imaging_scan.image_url = None

    if not use_postdicom:
        if report_file and report_file.filename:
            report_info = await FileStorageService.save_file(report_file, subfolder=subfolder, prefix="report")
            db_imaging_scan.report_file_id = report_info["file_id"]
            db_imaging_scan.report_filename = report_info["filename"]
            db_imaging_scan.report_mime_type = report_info["mime_type"]
            db_imaging_scan.report_file_size = report_info["file_size"]
            db_imaging_scan.report_url = _report_download_url(scan_id)

        if normalized_images:
            import asyncio
            
            async def save_image_task(image_file):
                image_info = await FileStorageService.save_file(image_file, subfolder=subfolder, prefix="image")
                return {
                    "file_id": image_info["file_id"],
                    "filename": image_info["filename"],
                    "mime_type": image_info["mime_type"],
                    "file_size": image_info["file_size"],
                    "upload_time": image_info["upload_time"],
                    "download_url": _image_download_url(scan_id, image_info["file_id"]),
                }
            
            # Save all images in parallel
            saved_images = await asyncio.gather(*[save_image_task(img) for img in normalized_images])
            
            db_imaging_scan.image_files = list(saved_images)
            if saved_images:
                db_imaging_scan.image_url = saved_images[0]["download_url"]

    if findings is not None:
        db_imaging_scan.findings = findings
    if impression is not None:
        db_imaging_scan.impression = impression

    if status_value:
        try:
            db_imaging_scan.status = ImagingScanStatus(str(status_value))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid imaging scan status") from None

    if db_imaging_scan.status == ImagingScanStatus.COMPLETED and not db_imaging_scan.completed_at:
        db_imaging_scan.completed_at = utcnow()

    db_imaging_scan.processed_by = current_user.id
    db.commit()

    loaded = _load_scan_with_users(db, scan_id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load imaging scan")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="imaging_scan.upload_results",
        resource_type="imaging_scan",
        resource_id=loaded.id,
        description=f"Uploaded imaging results for scan {loaded.id}",
        status="updated",
    )
    record = upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.doctor,
        record_type="imaging_result",
        category="imaging",
        title=loaded.scan_type,
        summary=loaded.impression or loaded.findings or loaded.clinical_indication,
        status=loaded.status,
        event_time=loaded.completed_at or loaded.ordered_at,
        source_record_id=f"imaging:{loaded.id}",
        payload=loaded.to_dict(),
    )
    if loaded.report_file_id:
        await attach_document_to_record(
            db,
            medical_record=record,
            uploaded_by=current_user,
            existing_file_id=loaded.report_file_id,
            filename=loaded.report_filename,
            mime_type=loaded.report_mime_type,
            file_size=loaded.report_file_size,
            storage_subpath=subfolder,
            document_type="imaging",
            description="Imaging report",
            is_external=False,
            source_system="alera",
            source_document_id=f"imaging-report:{loaded.id}",
        )
    db.commit()
    await create_db_notification(
        db,
        user_id=loaded.patient_id,
        title="New imaging result available",
        message=f"{loaded.scan_type} results were added to your unified medical record.",
        notification_type="medical_record",
        action_url="/dashboard/medical-history",
    )
    return imaging_to_response(loaded)


@router.get("/{scan_id}/report")
async def download_imaging_report(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_imaging_scan = db.query(ImagingScan).filter(ImagingScan.id == scan_id).first()
    if not db_imaging_scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging scan not found")
    if not _can_access_scan(current_user, db_imaging_scan):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if not db_imaging_scan.report_file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging report file not found")

    file_path = FileStorageService.get_file_path(db_imaging_scan.report_file_id, _storage_subfolder(db_imaging_scan))
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging report file not found")

    return FileResponse(
        path=file_path,
        filename=db_imaging_scan.report_filename or file_path.name,
        media_type=db_imaging_scan.report_mime_type or "application/octet-stream",
    )


@router.get("/{scan_id}/images/{file_id}")
async def download_imaging_asset(
    scan_id: int,
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_imaging_scan = db.query(ImagingScan).filter(ImagingScan.id == scan_id).first()
    if not db_imaging_scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging scan not found")
    if not _can_access_scan(current_user, db_imaging_scan):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    image_assets = db_imaging_scan.image_files or []
    asset = next((item for item in image_assets if isinstance(item, dict) and item.get("file_id") == file_id), None)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging file not found")

    file_path = FileStorageService.get_file_path(file_id, _storage_subfolder(db_imaging_scan))
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging file not found")

    return FileResponse(
        path=file_path,
        filename=asset.get("filename") or file_path.name,
        media_type=asset.get("mime_type") or "application/octet-stream",
    )


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_imaging_scan(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an imaging scan order (ordering provider or admin)."""

    db_imaging_scan = db.query(ImagingScan).filter(ImagingScan.id == scan_id).first()
    if not db_imaging_scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imaging scan not found",
        )

    if current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "delete imaging scans")
        if db_imaging_scan.ordered_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this imaging scan",
            )
    elif current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete imaging scans",
        )

    db.delete(db_imaging_scan)
    db.commit()
    return None
