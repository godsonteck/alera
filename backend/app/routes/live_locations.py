from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models import AmbulanceRequest, User, UserRole
from app.schemas import EmergencyTrackingResponse, LiveLocationResponse, LiveLocationUpdate
from app.utils.access import require_verified_workforce_member
from app.utils.dependencies import get_current_user
from app.utils.time import utcnow
from database import get_db


router = APIRouter(prefix="/api/live-locations", tags=["live-locations"])


def _to_location_response(user: User | None) -> LiveLocationResponse | None:
    if not user or not user.live_location_sharing_enabled:
        return None

    return LiveLocationResponse(
        user_id=user.id,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        latitude=user.live_latitude,
        longitude=user.live_longitude,
        last_updated=user.live_location_updated_at,
        sharing_enabled=user.live_location_sharing_enabled,
    )


def _require_request_access(current_user: User, request_record: AmbulanceRequest) -> None:
    if current_user.role == UserRole.PATIENT and request_record.patient_id == current_user.id:
        return
    if current_user.role == UserRole.AMBULANCE:
        require_verified_workforce_member(current_user, "view emergency tracking")
        if request_record.assigned_ambulance_id not in (None, current_user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        return
    if current_user.role in [UserRole.HOSPITAL, UserRole.PROVIDER]:
        require_verified_workforce_member(current_user, "view emergency tracking")
        return
    if current_user.is_admin_or_super():
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


@router.post("/me", response_model=LiveLocationResponse)
async def update_my_live_location(
    payload: LiveLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.live_location_sharing_enabled = payload.sharing_enabled
    current_user.live_latitude = payload.latitude
    current_user.live_longitude = payload.longitude
    current_user.live_location_updated_at = utcnow()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _to_location_response(current_user)


@router.get("/me", response_model=LiveLocationResponse)
async def get_my_live_location(
    current_user: User = Depends(get_current_user),
):
    response = _to_location_response(current_user)
    if response is None:
        return LiveLocationResponse(
            user_id=current_user.id,
            role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            sharing_enabled=False,
        )
    return response


@router.post("/me/disable", response_model=LiveLocationResponse)
async def disable_my_live_location(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.live_location_sharing_enabled = False
    current_user.live_location_updated_at = utcnow()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return LiveLocationResponse(
        user_id=current_user.id,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        last_updated=current_user.live_location_updated_at,
        sharing_enabled=False,
    )


@router.get("/request/{request_id}", response_model=EmergencyTrackingResponse)
async def get_emergency_tracking(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request_record = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == request_id).first()
    if not request_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ambulance request not found")

    _require_request_access(current_user, request_record)

    patient = db.query(User).filter(User.id == request_record.patient_id).first() if request_record.patient_id else None
    ambulance = (
        db.query(User).filter(User.id == request_record.assigned_ambulance_id).first()
        if request_record.assigned_ambulance_id
        else None
    )

    return EmergencyTrackingResponse(
        request_id=request_record.id,
        status=request_record.status.value if hasattr(request_record.status, "value") else str(request_record.status),
        priority=request_record.priority.value if hasattr(request_record.priority, "value") else str(request_record.priority),
        patient_id=request_record.patient_id,
        assigned_ambulance_id=request_record.assigned_ambulance_id,
        patient_location=_to_location_response(patient),
        ambulance_location=_to_location_response(ambulance),
    )
