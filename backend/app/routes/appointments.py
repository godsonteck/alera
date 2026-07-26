from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.user import User
from app.schemas import AppointmentResponse, AppointmentCreate, AppointmentUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.services.medical_record_sync import create_db_notification, upsert_medical_record

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

BLOCKING_APPOINTMENT_STATUSES = (
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.RESCHEDULED,
)


def _as_naive_datetime(value: datetime) -> datetime:
    """Keep comparisons compatible with the database's UTC-naive timestamps."""
    return value.replace(tzinfo=None) if value.tzinfo else value


def _ensure_provider_slot_is_available(
    db: Session,
    *,
    provider_id: int,
    scheduled_time: datetime,
    duration_minutes: int,
    exclude_appointment_id: int | None = None,
) -> None:
    if not 5 <= duration_minutes <= 480:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Appointment length must be between 5 minutes and 8 hours.",
        )

    requested_start = _as_naive_datetime(scheduled_time)
    requested_end = requested_start + timedelta(minutes=duration_minutes)
    query = db.query(Appointment).filter(
        Appointment.provider_id == provider_id,
        Appointment.status.in_(BLOCKING_APPOINTMENT_STATUSES),
        Appointment.scheduled_time < requested_end,
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)

    for existing in query.all():
        existing_start = _as_naive_datetime(existing.scheduled_time)
        existing_end = existing_start + timedelta(minutes=existing.duration_minutes)
        if existing_end > requested_start:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That provider is no longer available at this time. Please choose another time.",
            )


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    return f"{user.first_name} {user.last_name}".strip() or user.email


def serialize_appointment(apt: Appointment) -> AppointmentResponse:
    atype = apt.appointment_type.value if hasattr(apt.appointment_type, "value") else str(apt.appointment_type)
    st = apt.status.value if hasattr(apt.status, "value") else str(apt.status)
    return AppointmentResponse(
        id=apt.id,
        patient_id=apt.patient_id,
        provider_id=apt.provider_id,
        title=apt.title,
        description=apt.description,
        appointment_type=atype,
        scheduled_time=apt.scheduled_time,
        duration_minutes=apt.duration_minutes,
        location=apt.location,
        notes=apt.notes,
        status=st,
        created_at=apt.created_at,
        updated_at=apt.updated_at,
        patient_name=_display_name(apt.patient),
        provider_name=_display_name(apt.provider),
    )


def _load_appointment(db: Session, appointment_id: int) -> Appointment | None:
    return (
        db.query(Appointment)
        .options(joinedload(Appointment.patient), joinedload(Appointment.provider))
        .filter(Appointment.id == appointment_id)
        .first()
    )


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new appointment"""

    if current_user.role.value != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can book appointments",
        )

    provider = db.query(User).filter(User.id == appointment.provider_id).first()
    if not provider or provider.role.value != "provider" or not provider.is_active or not provider.is_verified:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )

    try:
        atype = AppointmentType(appointment.appointment_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid appointment_type: {appointment.appointment_type}",
        )

    _ensure_provider_slot_is_available(
        db,
        provider_id=provider.id,
        scheduled_time=appointment.scheduled_time,
        duration_minutes=appointment.duration_minutes,
    )

    db_appointment = Appointment(
        patient_id=current_user.id,
        provider_id=appointment.provider_id,
        title=appointment.title,
        description=appointment.description,
        appointment_type=atype,
        scheduled_time=appointment.scheduled_time,
        duration_minutes=appointment.duration_minutes,
        location=appointment.location,
        notes=appointment.notes,
    )

    db.add(db_appointment)
    db.commit()

    apt = _load_appointment(db, db_appointment.id)
    if not apt:
        raise HTTPException(status_code=500, detail="Failed to load created appointment")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="appointment.create",
        resource_type="appointment",
        resource_id=apt.id,
        description=f"Booked appointment with provider {provider.id}",
        status="created",
    )

    # Send appointment confirmation notification
    from app.utils.notification_utils import NotificationManager
    await NotificationManager.send_appointment_reminder(
        user=current_user,
        appointment_title=apt.title,
        appointment_time=apt.scheduled_time.isoformat(),
        provider_name=_display_name(provider),
    )

    upsert_medical_record(
        db,
        patient_id=apt.patient_id,
        provider=provider,
        record_type="appointment",
        category="encounter",
        title=apt.title,
        summary=apt.description,
        status=apt.status,
        event_time=apt.scheduled_time,
        source_record_id=f"appointment:{apt.id}",
        payload={
            "appointment_id": apt.id,
            "provider_name": _display_name(provider),
            "appointment_type": apt.appointment_type,
            "location": apt.location,
            "notes": apt.notes,
        },
    )
    db.commit()

    return serialize_appointment(apt)


@router.get("/", response_model=list[AppointmentResponse])
async def list_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List user's appointments"""

    q = db.query(Appointment).options(joinedload(Appointment.patient), joinedload(Appointment.provider))

    if current_user.role.value == "patient":
        q = q.filter(Appointment.patient_id == current_user.id)
    elif current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view appointments")
        q = q.filter(Appointment.provider_id == current_user.id)
    elif current_user.is_admin_or_super():
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    appointments = q.order_by(Appointment.scheduled_time.desc()).offset(skip).limit(limit).all()
    return [serialize_appointment(a) for a in appointments]


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get appointment details"""

    appointment = _load_appointment(db, appointment_id)

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.patient_id != current_user.id and appointment.provider_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this appointment",
            )
    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view appointments")

    return serialize_appointment(appointment)


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: int,
    appointment_update: AppointmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update appointment"""

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.patient_id != current_user.id and appointment.provider_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this appointment",
            )

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "update appointments")

    update_data = appointment_update.dict(exclude_unset=True)
    requested_time = update_data.get("scheduled_time", appointment.scheduled_time)
    requested_duration = update_data.get("duration_minutes", appointment.duration_minutes)
    if "scheduled_time" in update_data or "duration_minutes" in update_data:
        _ensure_provider_slot_is_available(
            db,
            provider_id=appointment.provider_id,
            scheduled_time=requested_time,
            duration_minutes=requested_duration,
            exclude_appointment_id=appointment.id,
        )

    for field, value in update_data.items():
        if field == "status" and value is not None:
            try:
                value = AppointmentStatus(value)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {value}",
                )
        setattr(appointment, field, value)

    db.commit()

    apt = _load_appointment(db, appointment_id)
    if not apt:
        raise HTTPException(status_code=500, detail="Failed to load appointment")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="appointment.update",
        resource_type="appointment",
        resource_id=apt.id,
        description=f"Updated appointment {apt.id}",
        status="updated",
    )
    upsert_medical_record(
        db,
        patient_id=apt.patient_id,
        provider=apt.provider,
        record_type="appointment",
        category="encounter",
        title=apt.title,
        summary=apt.description,
        status=apt.status,
        event_time=apt.scheduled_time,
        source_record_id=f"appointment:{apt.id}",
        payload={
            "appointment_id": apt.id,
            "provider_name": _display_name(apt.provider),
            "appointment_type": apt.appointment_type,
            "location": apt.location,
            "notes": apt.notes,
        },
    )
    db.commit()
    return serialize_appointment(apt)


@router.delete("/{appointment_id}")
async def delete_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel appointment (soft — status set to cancelled)"""

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.patient_id != current_user.id and appointment.provider_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this appointment",
            )

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "cancel appointments")

    appointment.status = AppointmentStatus.CANCELLED
    db.commit()

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="appointment.cancel",
        resource_type="appointment",
        resource_id=appointment.id,
        description=f"Cancelled appointment {appointment.id}",
        status="warning",
    )
    loaded = _load_appointment(db, appointment.id)
    if loaded:
        upsert_medical_record(
            db,
            patient_id=loaded.patient_id,
            provider=loaded.provider,
            record_type="appointment",
            category="encounter",
            title=loaded.title,
            summary=loaded.description,
            status=loaded.status,
            event_time=loaded.scheduled_time,
            source_record_id=f"appointment:{loaded.id}",
            payload={
                "appointment_id": loaded.id,
                "provider_name": _display_name(loaded.provider),
                "appointment_type": loaded.appointment_type,
                "location": loaded.location,
                "notes": loaded.notes,
            },
        )
        db.commit()

    return {"message": "Appointment cancelled"}
