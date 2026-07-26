from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
from app.models import LabTest, User, UserRole, LabTestStatus
from app.schemas import LabTestResponse, LabTestCreate, LabTestUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.services.medical_record_sync import create_db_notification, upsert_medical_record

router = APIRouter(prefix="/api/lab-tests", tags=["lab-tests"])


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or None


def lab_test_to_response(lt: LabTest) -> LabTestResponse:
    return LabTestResponse(
        id=lt.id,
        patient_id=lt.patient_id,
        ordered_by=lt.ordered_by,
        destination_provider_id=lt.destination_provider_id,
        destination_provider_name=_display_name(lt.destination_provider),
        processed_by=lt.processed_by,
        test_name=lt.test_name,
        test_code=lt.test_code,
        description=lt.description,
        status=lt.status.value if lt.status else LabTestStatus.ORDERED.value,
        result_value=lt.result_value,
        result_unit=lt.result_unit,
        reference_range=lt.reference_range,
        result_notes=lt.result_notes,
        result_file_url=lt.result_file_url,
        ordered_at=lt.ordered_at,
        collected_at=lt.collected_at,
        completed_at=lt.completed_at,
        created_at=lt.created_at,
        patient_name=_display_name(lt.patient),
        ordered_by_name=_display_name(lt.doctor),
    )


def _load_lab_with_users(db: Session, test_id: int) -> LabTest | None:
    return (
        db.query(LabTest)
        .options(joinedload(LabTest.patient), joinedload(LabTest.doctor), joinedload(LabTest.destination_provider))
        .filter(LabTest.id == test_id)
        .first()
    )


@router.post("/", response_model=LabTestResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_test(
    lab_test: LabTestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Order a new lab test (provider or admin)."""

    if current_user.role not in (UserRole.PROVIDER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only providers can order lab tests",
        )
    if current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "order lab tests")

    patient = db.query(User).filter(User.id == lab_test.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    destination_provider = db.query(User).filter(User.id == lab_test.destination_provider_id).first()
    if not destination_provider or destination_provider.role != UserRole.LABORATORY:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination provider must be a laboratory")
    if not destination_provider.is_active or not destination_provider.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination laboratory must be active and verified")

    db_lab_test = LabTest(
        patient_id=lab_test.patient_id,
        ordered_by=current_user.id,
        destination_provider_id=lab_test.destination_provider_id,
        test_name=lab_test.test_name,
        test_code=lab_test.test_code,
        description=lab_test.description,
        status=LabTestStatus.ORDERED,
    )

    db.add(db_lab_test)
    db.commit()

    loaded = _load_lab_with_users(db, db_lab_test.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load created lab test")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="lab_test.create",
        resource_type="lab_test",
        resource_id=loaded.id,
        description=f"Ordered lab test {loaded.test_name} for patient {loaded.patient_id}",
        status="created",
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.doctor,
        record_type="lab_result",
        category="laboratory",
        title=loaded.test_name,
        summary=loaded.description,
        status=loaded.status,
        event_time=loaded.ordered_at,
        source_record_id=f"lab-test:{loaded.id}",
        payload=loaded.to_dict(),
    )
    db.commit()
    return lab_test_to_response(loaded)


@router.get("/", response_model=list[LabTestResponse])
async def list_lab_tests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List lab tests visible to the current user."""

    if current_user.role == UserRole.PATIENT:
        query = db.query(LabTest).filter(LabTest.patient_id == current_user.id)
    elif current_user.role == UserRole.LABORATORY:
        require_verified_workforce_member(current_user, "view lab tests")
        query = db.query(LabTest).filter(LabTest.destination_provider_id == current_user.id)
    elif current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "view lab tests")
        query = db.query(LabTest).filter(LabTest.ordered_by == current_user.id)
    elif current_user.is_admin_or_super():
        query = db.query(LabTest)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    rows = (
        query.options(joinedload(LabTest.patient), joinedload(LabTest.doctor), joinedload(LabTest.destination_provider))
        .order_by(LabTest.ordered_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [lab_test_to_response(lt) for lt in rows]


@router.get("/{test_id}", response_model=LabTestResponse)
async def get_lab_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get lab test details."""

    db_lab_test = _load_lab_with_users(db, test_id)
    if not db_lab_test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab test not found",
        )

    if current_user.role == UserRole.PATIENT and db_lab_test.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    if current_user.role == UserRole.PROVIDER and db_lab_test.ordered_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    if current_user.role in (UserRole.PROVIDER, UserRole.LABORATORY):
        require_verified_workforce_member(current_user, "view lab tests")

    return lab_test_to_response(db_lab_test)


@router.put("/{test_id}", response_model=LabTestResponse)
async def update_lab_test(
    test_id: int,
    lab_test_update: LabTestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update lab test status/results (lab, ordering provider for own orders, or admin)."""

    db_lab_test = db.query(LabTest).filter(LabTest.id == test_id).first()
    if not db_lab_test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab test not found",
        )

    if current_user.role not in (UserRole.LABORATORY, UserRole.PROVIDER, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update lab tests",
        )
    if current_user.role == UserRole.PROVIDER and db_lab_test.ordered_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this lab test",
        )
    if current_user.role in (UserRole.PROVIDER, UserRole.LABORATORY):
        require_verified_workforce_member(current_user, "update lab tests")

    update_data = lab_test_update.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        try:
            db_lab_test.status = LabTestStatus(str(update_data["status"]))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid lab test status",
            ) from None
        del update_data["status"]

    for field, value in update_data.items():
        setattr(db_lab_test, field, value)

    if current_user.role == UserRole.LABORATORY:
        db_lab_test.processed_by = current_user.id

    db.commit()

    loaded = _load_lab_with_users(db, test_id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load lab test")

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="lab_test.update",
        resource_type="lab_test",
        resource_id=loaded.id,
        description=f"Updated lab test {loaded.id}",
        status="updated",
    )
    upsert_medical_record(
        db,
        patient_id=loaded.patient_id,
        provider=loaded.doctor,
        record_type="lab_result",
        category="laboratory",
        title=loaded.test_name,
        summary=loaded.result_notes or loaded.description,
        status=loaded.status,
        event_time=loaded.completed_at or loaded.ordered_at,
        source_record_id=f"lab-test:{loaded.id}",
        payload=loaded.to_dict(),
    )
    db.commit()
    if loaded.status == LabTestStatus.COMPLETED.value:
        await create_db_notification(
            db,
            user_id=loaded.patient_id,
            title="New lab result available",
            message=f"{loaded.test_name} results were added to your unified medical record.",
            notification_type="medical_record",
            action_url="/dashboard/medical-history",
        )
    return lab_test_to_response(loaded)


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lab_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a lab test order (ordering provider or admin)."""

    db_lab_test = db.query(LabTest).filter(LabTest.id == test_id).first()
    if not db_lab_test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab test not found",
        )

    if current_user.role == UserRole.PROVIDER:
        require_verified_workforce_member(current_user, "delete lab tests")
        if db_lab_test.ordered_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this lab test",
            )
    elif current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete lab tests",
        )

    db.delete(db_lab_test)
    db.commit()
    return None
