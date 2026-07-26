from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from app.models import AmbulanceRequest, User, UserRole, AmbulanceRequestStatus, EmergencyPriority
from app.schemas import AmbulanceRequestResponse, AmbulanceRequestCreate, AmbulanceRequestUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.utils.time import utcnow
from datetime import datetime

router = APIRouter(prefix="/api/ambulance", tags=["ambulance"])


def _can_access_request(current_user: User, db_request: AmbulanceRequest) -> bool:
    is_patient = current_user.role == UserRole.PATIENT and db_request.patient_id == current_user.id
    is_assigned_ambulance = (
        current_user.role == UserRole.AMBULANCE and db_request.assigned_ambulance_id == current_user.id
    )
    is_dispatch_viewer = current_user.role in [UserRole.ADMIN, UserRole.HOSPITAL, UserRole.PROVIDER]
    return is_patient or is_assigned_ambulance or is_dispatch_viewer


@router.post("/", response_model=AmbulanceRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_ambulance_request(
    request: AmbulanceRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new ambulance/emergency request"""

    if current_user.role == UserRole.PATIENT:
        if request.patient_id is not None and request.patient_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients can only request ambulance help for themselves"
            )
        patient_id = current_user.id if request.patient_id is None else request.patient_id
    elif current_user.role in [UserRole.ADMIN, UserRole.HOSPITAL, UserRole.AMBULANCE]:
        if current_user.role in [UserRole.HOSPITAL, UserRole.AMBULANCE]:
            require_verified_workforce_member(current_user, "create ambulance requests")
        patient_id = request.patient_id or current_user.id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients, hospitals, ambulance dispatchers, and admins can create ambulance requests"
        )

    if current_user.role == UserRole.PATIENT and (request.latitude is None or request.longitude is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Live GPS coordinates are required for patient ambulance requests",
        )
    
    db_request = AmbulanceRequest(
        patient_id=patient_id,
        location_name=request.location_name,
        address=request.address,
        latitude=request.latitude,
        longitude=request.longitude,
        description=request.description,
        priority=EmergencyPriority(request.priority) if request.priority else EmergencyPriority.MEDIUM,
        status=AmbulanceRequestStatus.PENDING
    )
    
    db.add(db_request)
    db.commit()
    db.refresh(db_request)

    # Real-time notification for dispatchers
    from app.utils.websocket_manager import manager
    await manager.broadcast_to_room(
        message={
            "type": "NEW_AMBULANCE_REQUEST",
            "request_id": db_request.id,
            "patient_id": db_request.patient_id,
            "priority": db_request.priority.value,
            "location_name": db_request.location_name,
            "timestamp": utcnow().isoformat()
        },
        room_id="dispatch"
    )

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="ambulance_request.create",
        resource_type="ambulance_request",
        resource_id=db_request.id,
        description=f"Created ambulance request {db_request.id}",
        status="created",
    )
    
    return db_request


@router.get("/", response_model=list[AmbulanceRequestResponse])
async def list_ambulance_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List ambulance requests (filtered by user role)"""
    
    if current_user.role == UserRole.PATIENT:
        query = db.query(AmbulanceRequest).filter(AmbulanceRequest.patient_id == current_user.id)
    elif current_user.role in [UserRole.AMBULANCE, UserRole.ADMIN, UserRole.HOSPITAL, UserRole.PROVIDER]:
        # Dispatchers, Admins, and Hospitals see all requests
        if current_user.role in [UserRole.AMBULANCE, UserRole.HOSPITAL, UserRole.PROVIDER]:
            require_verified_workforce_member(current_user, "view ambulance requests")
        query = db.query(AmbulanceRequest)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
        
    return query.order_by(AmbulanceRequest.requested_at.desc()).offset(skip).limit(limit).all()


@router.get("/{request_id}", response_model=AmbulanceRequestResponse)
async def get_ambulance_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific ambulance request details"""
    
    db_request = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == request_id).first()
    
    if not db_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambulance request not found"
        )
        
    # Check access
    if current_user.role in [UserRole.AMBULANCE, UserRole.HOSPITAL, UserRole.PROVIDER]:
        require_verified_workforce_member(current_user, "view ambulance requests")
    if current_user.role not in [UserRole.PATIENT, UserRole.AMBULANCE, UserRole.HOSPITAL, UserRole.ADMIN, UserRole.PROVIDER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    if not _can_access_request(current_user, db_request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
        
    return db_request


@router.put("/{request_id}", response_model=AmbulanceRequestResponse)
async def update_ambulance_request(
    request_id: int,
    request_update: AmbulanceRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update ambulance request status (dispatchers/admins only)"""
    
    db_request = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == request_id).first()
    
    if not db_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambulance request not found"
        )
        
    if current_user.role not in [UserRole.AMBULANCE, UserRole.ADMIN, UserRole.HOSPITAL]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dispatchers, hospitals, or admins can update ambulance requests"
        )
    if current_user.role in [UserRole.AMBULANCE, UserRole.HOSPITAL]:
        require_verified_workforce_member(current_user, "update ambulance requests")
        
    update_data = request_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            db_request.status = AmbulanceRequestStatus(value)
            if value == AmbulanceRequestStatus.DISPATCHED.value:
                if db_request.accepted_at is None:
                    db_request.accepted_at = utcnow()
                db_request.dispatched_at = utcnow()
                if current_user.role == UserRole.AMBULANCE and db_request.assigned_ambulance_id is None:
                    db_request.assigned_ambulance_id = current_user.id
            elif value == AmbulanceRequestStatus.ARRIVED.value:
                db_request.arrived_at = utcnow()
            elif value == AmbulanceRequestStatus.COMPLETED.value:
                db_request.completed_at = utcnow()
        elif field == "priority" and value:
            db_request.priority = EmergencyPriority(value)
        elif field == "assigned_ambulance_id" and value is not None:
            db_request.assigned_ambulance_id = value
            if db_request.accepted_at is None:
                db_request.accepted_at = utcnow()
        else:
            setattr(db_request, field, value)
            
    db.commit()
    db.refresh(db_request)

    # Real-time notification for patient and dispatchers
    from app.utils.websocket_manager import manager
    
    # Notify patient
    await manager.send_to_user(
        user_id=db_request.patient_id,
        message={
            "type": "AMBULANCE_STATUS_UPDATE",
            "request_id": db_request.id,
            "status": db_request.status.value,
            "assigned_ambulance_id": db_request.assigned_ambulance_id,
            "timestamp": utcnow().isoformat()
        }
    )
    
    # Notify dispatchers
    await manager.broadcast_to_room(
        message={
            "type": "AMBULANCE_REQUEST_UPDATED",
            "request_id": db_request.id,
            "status": db_request.status.value,
            "assigned_ambulance_id": db_request.assigned_ambulance_id,
            "timestamp": utcnow().isoformat()
        },
        room_id="dispatch"
    )

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="ambulance_request.update",
        resource_type="ambulance_request",
        resource_id=db_request.id,
        description=f"Updated ambulance request {db_request.id}",
        status="updated",
    )
    
    return db_request
