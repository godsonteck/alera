from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
from app.models.allergy import Allergy
from app.models.appointment import Appointment
from app.models.user import User, UserRole
from app.schemas import AllergyResponse, AllergyCreate, AllergyUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.services.medical_record_sync import upsert_medical_record

router = APIRouter(prefix="/api/allergies", tags=["allergies"])


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or None


def _provider_panel_patient_ids(db: Session, provider_id: int) -> set[int]:
    rows = (
        db.query(Appointment.patient_id)
        .filter(Appointment.provider_id == provider_id)
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def allergy_to_response(a: Allergy) -> AllergyResponse:
    return AllergyResponse(
        id=a.id,
        patient_id=a.patient_id,
        allergen=a.allergen,
        allergen_type=a.allergen_type,
        reaction_description=a.reaction_description,
        severity=a.severity,
        onset_date=a.onset_date,
        treatment=a.treatment,
        confirmed=a.confirmed,
        created_at=a.created_at,
        patient_name=_display_name(a.patient),
    )


def _can_provider_manage_patient(db: Session, provider_id: int, patient_id: int) -> bool:
    return patient_id in _provider_panel_patient_ids(db, provider_id)


@router.get("/patient/{patient_id}", response_model=list[AllergyResponse])
async def list_allergies_for_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Explicit path: allergies for one patient (authorized roles)."""

    if current_user.role != UserRole.PATIENT:
        require_verified_workforce_member(current_user, "view patient allergies")

    if current_user.role == UserRole.PATIENT and patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if current_user.role == UserRole.PROVIDER and not _can_provider_manage_patient(db, current_user.id, patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this patient")

    if current_user.role not in (
        UserRole.PATIENT,
        UserRole.PROVIDER,
        UserRole.PHARMACIST,
        UserRole.ADMIN,
        UserRole.HOSPITAL,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    rows = (
        db.query(Allergy)
        .options(joinedload(Allergy.patient))
        .filter(Allergy.patient_id == patient_id)
        .order_by(Allergy.created_at.desc())
        .all()
    )
    return [allergy_to_response(a) for a in rows]


@router.get("/", response_model=list[AllergyResponse])
async def list_allergies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    patient_id: int | None = Query(None, description="Filter to one patient (required for some roles)"),
):
    """List allergies: patients see their own; providers see panel (or one patient); admin/hospital see all or filtered."""

    q = db.query(Allergy).options(joinedload(Allergy.patient))

    if current_user.role != UserRole.PATIENT:
        require_verified_workforce_member(current_user, "view patient allergies")

    if current_user.role == UserRole.PATIENT:
        rows = q.filter(Allergy.patient_id == current_user.id).order_by(Allergy.created_at.desc()).all()
        return [allergy_to_response(a) for a in rows]

    if current_user.role == UserRole.PROVIDER:
        panel = _provider_panel_patient_ids(db, current_user.id)
        if patient_id is not None:
            if patient_id not in panel:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this patient")
            rows = q.filter(Allergy.patient_id == patient_id).order_by(Allergy.created_at.desc()).all()
        else:
            if not panel:
                return []
            rows = q.filter(Allergy.patient_id.in_(panel)).order_by(Allergy.created_at.desc()).all()
        return [allergy_to_response(a) for a in rows]

    if current_user.role == UserRole.PHARMACIST:
        if patient_id is None:
            return []
        rows = q.filter(Allergy.patient_id == patient_id).order_by(Allergy.created_at.desc()).all()
        return [allergy_to_response(a) for a in rows]

    if current_user.role in (UserRole.ADMIN, UserRole.HOSPITAL):
        if patient_id is not None:
            q = q.filter(Allergy.patient_id == patient_id)
        rows = q.order_by(Allergy.created_at.desc()).all()
        return [allergy_to_response(a) for a in rows]

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


@router.post("/", response_model=AllergyResponse, status_code=status.HTTP_201_CREATED)
async def create_allergy(
    allergy: AllergyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an allergy (patient for self; provider for patients on their panel; admin for any patient id)."""

    target_patient_id: int

    if current_user.role != UserRole.PATIENT:
        require_verified_workforce_member(current_user, "create allergies")

    if current_user.role == UserRole.PATIENT:
        target_patient_id = current_user.id
    elif current_user.role == UserRole.PROVIDER:
        if allergy.patient_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id is required when creating allergies as a provider",
            )
        if not _can_provider_manage_patient(db, current_user.id, allergy.patient_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this patient")
        target_patient_id = allergy.patient_id
    elif current_user.role == UserRole.ADMIN:
        if allergy.patient_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id is required when creating allergies as admin",
            )
        target_patient_id = allergy.patient_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create allergies")

    patient = db.query(User).filter(User.id == target_patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    db_allergy = Allergy(
        patient_id=target_patient_id,
        allergen=allergy.allergen,
        allergen_type=allergy.allergen_type,
        reaction_description=allergy.reaction_description,
        severity=allergy.severity,
        onset_date=allergy.onset_date,
        treatment=allergy.treatment,
        confirmed="Y",
    )

    db.add(db_allergy)
    db.commit()

    loaded = db.query(Allergy).options(joinedload(Allergy.patient)).filter(Allergy.id == db_allergy.id).first()
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load created allergy")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="allergy.create",
        resource_type="allergy",
        resource_id=loaded.id,
        description=f"Created allergy for patient {loaded.patient_id}",
        status="created",
    )

    # Send allergy alert notification to patient
    from app.utils.notification_utils import NotificationManager
    await NotificationManager.send_allergy_alert(
        user=patient,
        allergen=loaded.allergen,
        severity=loaded.severity,
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=current_user if current_user.role != UserRole.PATIENT else None,
        record_type="allergy",
        category="allergy",
        title=loaded.allergen,
        summary=loaded.reaction_description,
        status=loaded.severity,
        event_time=loaded.created_at,
        source_record_id=f"allergy:{loaded.id}",
        payload={
            "allergen_type": loaded.allergen_type,
            "treatment": loaded.treatment,
            "confirmed": loaded.confirmed,
        },
    )
    db.commit()

    return allergy_to_response(loaded)


def _can_mutate_allergy(db: Session, current_user: User, allergy: Allergy) -> bool:
    if current_user.role == UserRole.ADMIN:
        return True
    if current_user.role == UserRole.PATIENT and allergy.patient_id == current_user.id:
        return True
    if current_user.role == UserRole.PROVIDER and _can_provider_manage_patient(db, current_user.id, allergy.patient_id):
        return True
    return False


@router.put("/{allergy_id}", response_model=AllergyResponse)
async def update_allergy(
    allergy_id: int,
    allergy_update: AllergyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergy = db.query(Allergy).filter(Allergy.id == allergy_id).first()
    if not allergy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allergy not found")

    if current_user.role != UserRole.PATIENT:
        require_verified_workforce_member(current_user, "update allergies")

    if not _can_mutate_allergy(db, current_user, allergy):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = allergy_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(allergy, field, value)

    db.commit()
    loaded = db.query(Allergy).options(joinedload(Allergy.patient)).filter(Allergy.id == allergy_id).first()
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load allergy")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="allergy.update",
        resource_type="allergy",
        resource_id=loaded.id,
        description=f"Updated allergy {loaded.id}",
        status="updated",
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=current_user if current_user.role != UserRole.PATIENT else None,
        record_type="allergy",
        category="allergy",
        title=loaded.allergen,
        summary=loaded.reaction_description,
        status=loaded.severity,
        event_time=loaded.created_at,
        source_record_id=f"allergy:{loaded.id}",
        payload={
            "allergen_type": loaded.allergen_type,
            "treatment": loaded.treatment,
            "confirmed": loaded.confirmed,
        },
    )
    db.commit()
    return allergy_to_response(loaded)


@router.delete("/{allergy_id}")
async def delete_allergy(
    allergy_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergy = db.query(Allergy).filter(Allergy.id == allergy_id).first()
    if not allergy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allergy not found")

    if current_user.role != UserRole.PATIENT:
        require_verified_workforce_member(current_user, "delete allergies")

    if not _can_mutate_allergy(db, current_user, allergy):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    db.delete(allergy)
    db.commit()

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="allergy.delete",
        resource_type="allergy",
        resource_id=allergy.id,
        description=f"Deleted allergy {allergy.id}",
        status="warning",
    )
    return {"message": "Allergy deleted"}


@router.get("/{allergy_id}", response_model=AllergyResponse)
async def get_allergy(
    allergy_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allergy = db.query(Allergy).options(joinedload(Allergy.patient)).filter(Allergy.id == allergy_id).first()
    if not allergy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allergy not found")

    if current_user.role != UserRole.PATIENT:
        require_verified_workforce_member(current_user, "view patient allergies")

    if current_user.role == UserRole.PATIENT and allergy.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == UserRole.PROVIDER and not _can_provider_manage_patient(db, current_user.id, allergy.patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role not in (
        UserRole.PATIENT,
        UserRole.PROVIDER,
        UserRole.PHARMACIST,
        UserRole.ADMIN,
        UserRole.HOSPITAL,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return allergy_to_response(allergy)
