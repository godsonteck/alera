from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
from app.models.prescription import Prescription
from app.models.user import User
from app.schemas import PrescriptionResponse, PrescriptionCreate, PrescriptionUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.services.medical_record_sync import create_db_notification, upsert_medical_record

router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])


def _display_name(u: User | None) -> str | None:
    if not u:
        return None
    return f"{u.first_name} {u.last_name}".strip() or u.email


def serialize_prescription(rx: Prescription) -> PrescriptionResponse:
    return PrescriptionResponse(
        id=rx.id,
        patient_id=rx.patient_id,
        provider_id=rx.provider_id,
        pharmacy_id=rx.pharmacy_id,
        medication_name=rx.medication_name,
        dosage=rx.dosage,
        dosage_unit=rx.dosage_unit,
        frequency=rx.frequency,
        route=rx.route,
        instructions=rx.instructions,
        quantity=rx.quantity,
        refills=rx.refills,
        start_date=rx.start_date,
        end_date=rx.end_date,
        status=rx.status,
        prescribed_date=rx.prescribed_date,
        created_at=rx.created_at,
        refills_remaining=rx.refills_remaining,
        patient_name=_display_name(rx.patient),
        provider_name=_display_name(rx.provider),
        pharmacy_name=_display_name(rx.pharmacy),
    )


def _load_prescription(db: Session, prescription_id: int) -> Prescription | None:
    return (
        db.query(Prescription)
        .options(joinedload(Prescription.patient), joinedload(Prescription.provider), joinedload(Prescription.pharmacy))
        .filter(Prescription.id == prescription_id)
        .first()
    )


@router.post("/", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    prescription: PrescriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new prescription (provider only)"""

    if current_user.role.value not in ["provider", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only providers can create prescriptions",
        )
    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "create prescriptions")

    patient = db.query(User).filter(User.id == prescription.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    pharmacy = db.query(User).filter(User.id == prescription.pharmacy_id).first()
    if not pharmacy or pharmacy.role.value != "pharmacist":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination provider must be a pharmacy",
        )
    if not pharmacy.is_active or not pharmacy.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination pharmacy must be active and verified",
        )

    db_prescription = Prescription(
        patient_id=prescription.patient_id,
        provider_id=current_user.id,
        pharmacy_id=prescription.pharmacy_id,
        medication_name=prescription.medication_name,
        dosage=prescription.dosage,
        dosage_unit=prescription.dosage_unit,
        frequency=prescription.frequency,
        route=prescription.route,
        instructions=prescription.instructions,
        quantity=prescription.quantity,
        refills=prescription.refills,
        refills_remaining=prescription.refills,
        start_date=prescription.start_date,
        end_date=prescription.end_date,
        status="active",
    )

    db.add(db_prescription)
    db.commit()

    loaded = _load_prescription(db, db_prescription.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load created prescription")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="prescription.create",
        resource_type="prescription",
        resource_id=loaded.id,
        description=f"Created prescription {loaded.id} for patient {loaded.patient_id}",
        status="created",
    )

    # Send prescription notification to patient
    from app.utils.notification_utils import NotificationManager
    await NotificationManager.send_prescription_notification(
        user=patient,
        medication_name=loaded.medication_name,
        provider_name=_display_name(loaded.provider),
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.provider,
        record_type="prescription",
        category="medication",
        title=loaded.medication_name,
        summary=loaded.instructions,
        status=loaded.status,
        event_time=loaded.prescribed_date,
        source_record_id=f"prescription:{loaded.id}",
        payload={
            "dosage": loaded.dosage,
            "dosage_unit": loaded.dosage_unit,
            "frequency": loaded.frequency,
            "route": loaded.route,
            "quantity": loaded.quantity,
            "pharmacy_id": loaded.pharmacy_id,
            "pharmacy_name": loaded.pharmacy_name,
            "refills": loaded.refills,
            "refills_remaining": loaded.refills_remaining,
        },
    )
    db.commit()

    return serialize_prescription(loaded)


@router.get("/", response_model=list[PrescriptionResponse])
async def list_prescriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List prescriptions for current user"""

    q = db.query(Prescription).options(joinedload(Prescription.patient), joinedload(Prescription.provider))

    if current_user.role.value == "patient":
        q = q.filter(Prescription.patient_id == current_user.id)
    elif current_user.role.value in ("pharmacist", "admin"):
        if current_user.role.value == "pharmacist":
            require_verified_workforce_member(current_user, "view prescriptions")
            q = q.filter(Prescription.pharmacy_id == current_user.id)
    elif current_user.role.value in ("provider",):
        require_verified_workforce_member(current_user, "view prescriptions")
        q = q.filter(Prescription.provider_id == current_user.id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    rows = q.order_by(Prescription.created_at.desc()).offset(skip).limit(limit).all()
    return [serialize_prescription(r) for r in rows]


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prescription details"""

    prescription = _load_prescription(db, prescription_id)

    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )

    if prescription.patient_id != current_user.id and prescription.provider_id != current_user.id:
        if current_user.role.value not in ("pharmacist", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized",
            )

    if current_user.role.value in ("provider", "pharmacist"):
        require_verified_workforce_member(current_user, "view prescriptions")

    return serialize_prescription(prescription)


@router.put("/{prescription_id}", response_model=PrescriptionResponse)
async def update_prescription(
    prescription_id: int,
    prescription_update: PrescriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update prescription (prescriber, admin, or pharmacist for dispensing fields)"""

    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()

    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )

    is_owner = prescription.provider_id == current_user.id
    is_admin = current_user.role.value == "admin"
    is_pharmacist = current_user.role.value == "pharmacist" and prescription.pharmacy_id == current_user.id

    if current_user.role.value in ("provider", "pharmacist"):
        require_verified_workforce_member(current_user, "update prescriptions")

    if not (is_owner or is_admin or is_pharmacist):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this prescription",
        )

    update_data = prescription_update.dict(exclude_unset=True)
    if is_pharmacist and not is_admin:
        allowed = {"status", "refills_remaining", "instructions"}
        update_data = {k: v for k, v in update_data.items() if k in allowed}

    for field, value in update_data.items():
        setattr(prescription, field, value)

    db.commit()

    loaded = _load_prescription(db, prescription_id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load prescription")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="prescription.update",
        resource_type="prescription",
        resource_id=loaded.id,
        description=f"Updated prescription {loaded.id}",
        status="updated",
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.provider,
        record_type="prescription",
        category="medication",
        title=loaded.medication_name,
        summary=loaded.instructions,
        status=loaded.status,
        event_time=loaded.prescribed_date,
        source_record_id=f"prescription:{loaded.id}",
        payload={
            "dosage": loaded.dosage,
            "dosage_unit": loaded.dosage_unit,
            "frequency": loaded.frequency,
            "route": loaded.route,
            "quantity": loaded.quantity,
            "pharmacy_id": loaded.pharmacy_id,
            "pharmacy_name": loaded.pharmacy_name,
            "refills": loaded.refills,
            "refills_remaining": loaded.refills_remaining,
        },
    )
    db.commit()
    return serialize_prescription(loaded)


@router.delete("/{prescription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prescription(
    prescription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a prescription (prescriber or admin)."""

    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()

    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "delete prescriptions")
        if prescription.provider_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this prescription",
            )
    elif current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete prescriptions",
        )

    db.delete(prescription)
    db.commit()
    return None
    if current_user.role.value == "pharmacist" and prescription.pharmacy_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
