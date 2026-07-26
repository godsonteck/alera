from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from app.models.canonical_records import PatientPermission
from app.models.user import User, UserRole
from app.schemas.canonical_records import (
    PatientPermissionAction,
    PatientPermissionCreate,
    PatientPermissionListResponse,
    PatientPermissionResponse,
    PatientPermissionUpdate,
)
from app.services.medical_record_sync import create_db_notification
from app.utils.access import current_user_organization
from app.utils.dependencies import get_current_user
from app.utils.time import utcnow

router = APIRouter(prefix="/api/patient-permissions", tags=["patient-permissions"])


def _serialize(permission: PatientPermission) -> PatientPermissionResponse:
    return PatientPermissionResponse(**permission.to_dict())


@router.get("", response_model=PatientPermissionListResponse)
async def list_patient_permissions(
    patient_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PatientPermission)

    if current_user.role == UserRole.PATIENT:
        query = query.filter(PatientPermission.patient_id == current_user.id)
    elif current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        if patient_id is not None:
            query = query.filter(PatientPermission.patient_id == patient_id)
    else:
        organization = current_user_organization(db, current_user)
        if organization is None:
            return PatientPermissionListResponse(total=0, items=[])
        query = query.filter(PatientPermission.organization_id == organization.id)
        if patient_id is not None:
            query = query.filter(PatientPermission.patient_id == patient_id)

    items = query.order_by(PatientPermission.updated_at.desc()).all()
    return PatientPermissionListResponse(total=len(items), items=[_serialize(item) for item in items])


@router.post("/request", response_model=PatientPermissionResponse, status_code=status.HTTP_201_CREATED)
async def request_patient_permission(
    body: PatientPermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients cannot request organization access")

    organization = current_user_organization(db, current_user)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No organization is linked to this account")

    permission = PatientPermission(
        id=str(uuid.uuid4()),
        patient_id=body.patient_id,
        organization_id=organization.id,
        requested_by=current_user.id,
        scope=body.scope or ["full_record"],
        reason=body.reason,
        status="requested",
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)

    await create_db_notification(
        db,
        user_id=body.patient_id,
        title="Medical record access requested",
        message=f"{organization.name} requested access to your unified medical record.",
        notification_type="patient_permission",
        related_type="patient_permission",
        action_url="/dashboard/medical-history",
    )
    return _serialize(permission)


@router.post("/grant", response_model=PatientPermissionResponse)
async def grant_patient_permission(
    body: PatientPermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can grant access")
    if body.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only grant access to your own record")

    permission = (
        db.query(PatientPermission)
        .filter(
            PatientPermission.patient_id == current_user.id,
            PatientPermission.organization_id == body.organization_id,
        )
        .order_by(PatientPermission.updated_at.desc())
        .first()
    )
    if permission is None:
        permission = PatientPermission(
            id=str(uuid.uuid4()),
            patient_id=current_user.id,
            organization_id=body.organization_id,
            requested_by=None,
            scope=body.scope or ["full_record"],
        )
        db.add(permission)

    permission.scope = body.scope or ["full_record"]
    permission.reason = body.reason
    permission.status = "granted"
    permission.granted_by = current_user.id
    permission.granted_at = utcnow()
    permission.revoked_at = None
    permission.revoked_by = None
    db.commit()
    db.refresh(permission)

    workforce = db.query(User).filter(User.organization_id == body.organization_id).all()
    for member in workforce:
        await create_db_notification(
            db,
            user_id=member.id,
            title="Medical record access granted",
            message="Your organization can now access a patient's unified record.",
            notification_type="patient_permission",
            related_type="patient_permission",
            action_url=f"/dashboard/medical-history?patient={current_user.id}",
        )
    return _serialize(permission)


@router.post("/{permission_id}/revoke", response_model=PatientPermissionResponse)
async def revoke_patient_permission(
    permission_id: str,
    body: PatientPermissionAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permission = db.query(PatientPermission).filter(PatientPermission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    if current_user.role != UserRole.PATIENT or permission.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the patient can revoke this access")

    permission.status = "revoked"
    permission.reason = body.reason or permission.reason
    permission.revoked_by = current_user.id
    permission.revoked_at = utcnow()
    db.commit()
    db.refresh(permission)

    workforce = db.query(User).filter(User.organization_id == permission.organization_id).all()
    for member in workforce:
        await create_db_notification(
            db,
            user_id=member.id,
            title="Medical record access revoked",
            message="A patient's organization-level record access was revoked.",
            notification_type="patient_permission",
            related_type="patient_permission",
            action_url="/dashboard/medical-history",
        )
    return _serialize(permission)


@router.post("/{permission_id}/approve", response_model=PatientPermissionResponse)
async def approve_requested_permission(
    permission_id: str,
    body: PatientPermissionAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permission = db.query(PatientPermission).filter(PatientPermission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    if current_user.role != UserRole.PATIENT or permission.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the patient can approve this request")

    permission.status = "granted"
    permission.granted_by = current_user.id
    permission.granted_at = utcnow()
    permission.reason = body.reason or permission.reason
    permission.expires_at = body.expires_at
    db.commit()
    db.refresh(permission)

    workforce = db.query(User).filter(User.organization_id == permission.organization_id).all()
    for member in workforce:
        await create_db_notification(
            db,
            user_id=member.id,
            title="Medical record request approved",
            message="A patient approved your organization's access request.",
            notification_type="patient_permission",
            related_type="patient_permission",
            action_url=f"/dashboard/medical-history?patient={permission.patient_id}",
        )
    return _serialize(permission)


@router.post("/{permission_id}/deny", response_model=PatientPermissionResponse)
async def deny_requested_permission(
    permission_id: str,
    body: PatientPermissionAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permission = db.query(PatientPermission).filter(PatientPermission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    if current_user.role != UserRole.PATIENT or permission.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the patient can deny this request")

    permission.status = "denied"
    permission.reason = body.reason or permission.reason
    permission.revoked_by = current_user.id
    permission.revoked_at = utcnow()
    db.commit()
    db.refresh(permission)
    return _serialize(permission)


@router.put("/{permission_id}", response_model=PatientPermissionResponse)
async def update_patient_permission(
    permission_id: str,
    body: PatientPermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permission = db.query(PatientPermission).filter(PatientPermission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    if current_user.role != UserRole.PATIENT or permission.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the patient can update this permission")

    if body.scope is not None:
        permission.scope = body.scope
    if body.reason is not None:
        permission.reason = body.reason
    if body.expires_at is not None:
        permission.expires_at = body.expires_at
    db.commit()
    db.refresh(permission)
    return _serialize(permission)
