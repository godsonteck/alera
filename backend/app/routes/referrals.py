from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from app.models import Referral, User, UserRole
from app.models.referral import (
    REFERRAL_TYPE_HOSPITAL,
    REFERRAL_TYPE_IMAGING,
    REFERRAL_TYPE_LABORATORY,
    REFERRAL_TYPE_PHARMACY,
)
from app.schemas import ReferralCreate, ReferralUpdate, ReferralResponse
from app.schemas import REFERRAL_TYPE_VALUES
from app.utils.dependencies import get_current_user
from app.utils.access import require_provider_panel_access, require_verified_workforce_member

router = APIRouter(prefix="/api/referrals", tags=["referrals"])

ALLOWED_TYPES = set(REFERRAL_TYPE_VALUES)
ALLOWED_STATUSES = {"pending", "accepted", "completed", "cancelled"}


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or None


def _expected_destination_role(referral_type: str) -> UserRole:
    if referral_type == REFERRAL_TYPE_LABORATORY:
        return UserRole.LABORATORY
    if referral_type == REFERRAL_TYPE_IMAGING:
        return UserRole.IMAGING
    if referral_type == REFERRAL_TYPE_PHARMACY:
        return UserRole.PHARMACIST
    return UserRole.HOSPITAL


def referral_to_response(ref: Referral, db: Session) -> ReferralResponse:
    patient = db.query(User).filter(User.id == ref.patient_id).first()
    doctor = db.query(User).filter(User.id == ref.from_doctor_id).first()
    destination_provider = (
        db.query(User).filter(User.id == ref.destination_provider_id).first()
        if ref.destination_provider_id is not None
        else None
    )
    rtype = getattr(ref, "referral_type", None) or REFERRAL_TYPE_HOSPITAL
    return ReferralResponse(
        id=ref.id,
        patient_id=ref.patient_id,
        from_doctor_id=ref.from_doctor_id,
        referral_type=rtype,
        destination_provider_id=ref.destination_provider_id,
        destination_provider_name=_display_name(destination_provider),
        destination_provider_role=destination_provider.role.value if destination_provider else None,
        to_department=ref.to_department,
        to_department_id=ref.to_department_id,
        reason=ref.reason,
        notes=ref.notes,
        status=ref.status,
        created_at=ref.created_at,
        updated_at=ref.updated_at,
        patient_name=_display_name(patient),
        from_doctor_name=_display_name(doctor),
    )


def _normalize_type(raw: str) -> str:
    t = (raw or "").strip().lower()
    if t not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"referral_type must be one of: {', '.join(sorted(ALLOWED_TYPES))}",
        )
    return t


def _normalize_status(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status must be one of: {', '.join(sorted(ALLOWED_STATUSES))}",
        )
    return value


def _validate_destination_status_change(current_status: str, next_status: str) -> None:
    if next_status == current_status:
        return
    if current_status == "pending" and next_status == "accepted":
        return
    if current_status == "accepted" and next_status == "completed":
        return
    if next_status == "cancelled" and current_status in {"pending", "accepted"}:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Cannot change referral status from {current_status} to {next_status}",
    )


def _apply_list_type_filter(query, current_user: User, referral_type: str | None):
    """Restrict rows by role so each stakeholder only sees their queue."""

    if current_user.role == UserRole.LABORATORY:
        return query.filter(
            Referral.referral_type == REFERRAL_TYPE_LABORATORY,
            Referral.destination_provider_id == current_user.id,
        )
    if current_user.role == UserRole.IMAGING:
        return query.filter(
            Referral.referral_type == REFERRAL_TYPE_IMAGING,
            Referral.destination_provider_id == current_user.id,
        )
    if current_user.role == UserRole.PHARMACIST:
        return query.filter(
            Referral.referral_type == REFERRAL_TYPE_PHARMACY,
            Referral.destination_provider_id == current_user.id,
        )
    if current_user.role == UserRole.ADMIN:
        if referral_type:
            return query.filter(Referral.referral_type == _normalize_type(referral_type))
        return query
    if current_user.role == UserRole.HOSPITAL:
        if referral_type:
            return query.filter(
                Referral.referral_type == _normalize_type(referral_type),
                Referral.destination_provider_id == current_user.id,
            )
        return query.filter(
            Referral.referral_type == REFERRAL_TYPE_HOSPITAL,
            Referral.destination_provider_id == current_user.id,
        )
    if current_user.role == UserRole.PROVIDER:
        if referral_type:
            return query.filter(Referral.referral_type == _normalize_type(referral_type))
        return query
    if current_user.role == UserRole.PATIENT:
        if referral_type:
            return query.filter(Referral.referral_type == _normalize_type(referral_type))
        return query
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


@router.post("/", response_model=ReferralResponse, status_code=status.HTTP_201_CREATED)
async def create_referral(
    body: ReferralCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.PROVIDER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only providers can create referrals",
        )
    if current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "create referrals")

    rtype = _normalize_type(body.referral_type)
    expected_destination_role = _expected_destination_role(rtype)

    patient = db.query(User).filter(User.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    destination_provider = db.query(User).filter(User.id == body.destination_provider_id).first()
    if not destination_provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination provider not found")
    if destination_provider.role != expected_destination_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Destination provider must be a {expected_destination_role.value}",
        )
    if not destination_provider.is_active or not destination_provider.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination provider must be active and verified",
        )

    if current_user.role == UserRole.PROVIDER:
        require_provider_panel_access(db, current_user.id, body.patient_id, "create referrals")

    ref = Referral(
        patient_id=body.patient_id,
        from_doctor_id=current_user.id,
        referral_type=rtype,
        destination_provider_id=body.destination_provider_id,
        to_department=body.to_department,
        to_department_id=body.to_department_id,
        reason=body.reason,
        notes=body.notes,
        status="pending",
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="referral.create",
        resource_type="referral",
        resource_id=ref.id,
        description=f"Created referral {ref.id} for patient {ref.patient_id}",
        status="created",
    )
    return referral_to_response(ref, db)


@router.get("/", response_model=list[ReferralResponse])
async def list_referrals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 200,
    referral_type: str | None = Query(
        None,
        description="Filter by type (hospital|laboratory|imaging|pharmacy). Scoped by role.",
    ),
):
    if current_user.role == UserRole.PATIENT:
        q = db.query(Referral).filter(Referral.patient_id == current_user.id)
    elif current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "view referrals")
        q = db.query(Referral).filter(Referral.from_doctor_id == current_user.id)
    elif current_user.role in (UserRole.HOSPITAL, UserRole.LABORATORY, UserRole.IMAGING, UserRole.PHARMACIST):
        require_verified_workforce_member(current_user, "view referrals")
        q = db.query(Referral)
    elif current_user.is_admin_or_super():
        q = db.query(Referral)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    q = _apply_list_type_filter(q, current_user, referral_type)
    rows = q.order_by(Referral.created_at.desc()).offset(skip).limit(limit).all()
    return [referral_to_response(r, db) for r in rows]


@router.get("/{referral_id}", response_model=ReferralResponse)
async def get_referral(
    referral_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ref = db.query(Referral).filter(Referral.id == referral_id).first()
    if not ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")

    if current_user.is_admin_or_super():
        return referral_to_response(ref, db)
    if current_user.role == UserRole.PATIENT and ref.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.PROVIDER and ref.from_doctor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.LABORATORY and (
        ref.referral_type != REFERRAL_TYPE_LABORATORY or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.IMAGING and (
        ref.referral_type != REFERRAL_TYPE_IMAGING or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.PHARMACIST and (
        ref.referral_type != REFERRAL_TYPE_PHARMACY or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.HOSPITAL and (
        ref.referral_type != REFERRAL_TYPE_HOSPITAL or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role in (
        UserRole.PROVIDER,
        UserRole.HOSPITAL,
        UserRole.LABORATORY,
        UserRole.IMAGING,
        UserRole.PHARMACIST,
    ):
        require_verified_workforce_member(current_user, "view referrals")
    if current_user.role not in (
        UserRole.PATIENT,
        UserRole.PROVIDER,
        UserRole.HOSPITAL,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.LABORATORY,
        UserRole.IMAGING,
        UserRole.PHARMACIST,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return referral_to_response(ref, db)


@router.put("/{referral_id}", response_model=ReferralResponse)
async def update_referral(
    referral_id: int,
    body: ReferralUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ref = db.query(Referral).filter(Referral.id == referral_id).first()
    if not ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")

    if current_user.is_admin_or_super():
        data = body.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(ref, field, value)
        db.commit()
        db.refresh(ref)
        return referral_to_response(ref, db)

    if current_user.role == UserRole.LABORATORY and (
        ref.referral_type != REFERRAL_TYPE_LABORATORY or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.IMAGING and (
        ref.referral_type != REFERRAL_TYPE_IMAGING or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.PHARMACIST and (
        ref.referral_type != REFERRAL_TYPE_PHARMACY or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.HOSPITAL and (
        ref.referral_type != REFERRAL_TYPE_HOSPITAL or ref.destination_provider_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role in (
        UserRole.PROVIDER,
        UserRole.HOSPITAL,
        UserRole.LABORATORY,
        UserRole.IMAGING,
        UserRole.PHARMACIST,
    ):
        require_verified_workforce_member(current_user, "update referrals")

    data = body.model_dump(exclude_unset=True)

    if current_user.role == UserRole.PROVIDER:
        if ref.from_doctor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        if data.get("status") is not None and data["status"] != "cancelled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Providers may only cancel referrals",
            )
        if data.get("status") == "cancelled" and ref.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending referrals can be cancelled",
            )
    elif current_user.role in (UserRole.HOSPITAL, UserRole.LABORATORY, UserRole.IMAGING, UserRole.PHARMACIST):
        if "status" in data and data["status"] is not None:
            next_status = _normalize_status(data["status"])
            _validate_destination_status_change(ref.status, next_status)
            data["status"] = next_status
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    for field, value in data.items():
        setattr(ref, field, value)

    db.commit()
    db.refresh(ref)

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="referral.update",
        resource_type="referral",
        resource_id=ref.id,
        description=f"Updated referral {ref.id}",
        status="updated",
    )
    return referral_to_response(ref, db)
