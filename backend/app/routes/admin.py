import logging
import json
from app.utils.redis import redis_get, redis_set, redis_delete
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from app.models import (
    User, UserRole, Appointment, AppointmentStatus, Prescription,
    LabTest, LabTestStatus, ImagingScan, ImagingScanStatus,
    AmbulanceRequest, AmbulanceRequestStatus, EmergencyPriority,
    SystemSettings, Notification
)
from app.utils.dependencies import get_current_admin, get_current_super_admin
from app.schemas import UserResponse, SystemSettingsResponse, SystemSettingsUpdate
from app.schemas.additional_features import AuditLogResponse
from app.utils.access import WORKFORCE_ROLES, normalized_enum_text
from app.utils.time import utcnow
from app.utils.auth import hash_password
from datetime import datetime, timedelta, time
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _revoke_user_sessions(user: User) -> None:
    user.session_version = int(user.session_version or 0) + 1
    # Invalidate status cache
    redis_delete(f"user:{user.id}:status")


def _workforce_users_query(db: Session):
    role_text = normalized_enum_text(User.role)
    return db.query(User).filter(role_text.in_([role.value for role in WORKFORCE_ROLES]))


def _log_dashboard_query_failure(label: str, exc: Exception) -> None:
    logger.warning("Admin dashboard query failed for %s", label, exc_info=exc)


def _dashboard_user_counts(db: Session) -> dict[str, int]:
    counts = {role.value: 0 for role in UserRole}
    role_text = normalized_enum_text(User.role)
    rows = (
        db.query(role_text.label("role"), func.count(User.id).label("count"))
        .group_by(role_text)
        .all()
    )
    for role, count in rows:
        if role in counts:
            counts[role] = count
    return counts


def _status_value(value):
    return value.value if hasattr(value, "value") else value


# ─────────────────────────────────────────────────────────────────────────────
# Schemas for super admin operations
# ─────────────────────────────────────────────────────────────────────────────

class CreateAdminRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str = "admin"  # "admin" or "super_admin"


class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.PATIENT
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    specialty: Optional[str] = None
    postdicom_api_url: Optional[str] = None
    postdicom_api_key: Optional[str] = None

    @model_validator(mode="after")
    def validate_role_specific_fields(self):
        if self.role not in (UserRole.PATIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN):
            if not self.license_number or not self.license_state:
                raise ValueError("license_number and license_state are required for professional accounts")
        return self


class ChangeUserRoleRequest(BaseModel):
    new_role: str


ROLE_ALIASES: dict[str, UserRole] = {
    "patient": UserRole.PATIENT,
    "doctor": UserRole.PROVIDER,
    "provider": UserRole.PROVIDER,
    "pharmacy": UserRole.PHARMACIST,
    "pharmacist": UserRole.PHARMACIST,
    "hospital": UserRole.HOSPITAL,
    "laboratory": UserRole.LABORATORY,
    "imaging": UserRole.IMAGING,
    "ambulance": UserRole.AMBULANCE,
    "physiotherapist": UserRole.PHYSIOTHERAPIST,
    "admin": UserRole.ADMIN,
    "super_admin": UserRole.SUPER_ADMIN,
}


def _parse_user_role(raw_role: str) -> UserRole:
    normalized = raw_role.strip().lower().replace("-", "_")
    role = ROLE_ALIASES.get(normalized)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {raw_role}",
        )
    return role


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard / Stats (accessible to all admins)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get admin dashboard statistics with Redis caching"""
    
    cache_key = "admin:dashboard:stats"
    cached_data = redis_get(cache_key)
    
    if cached_data:
        try:
            stats = json.loads(cached_data)
            # Add non-cacheable info
            stats["current_admin_role"] = current_user.role.value
            stats["cached"] = True
            return stats
        except Exception as e:
            logger.warning("Failed to parse cached dashboard stats: %s", e)

    user_counts = {role.value: 0 for role in UserRole}
    total_users = 0
    total_appointments = 0
    today_appointments = 0
    active_prescriptions = 0
    pending_labs = 0
    pending_imaging = 0
    active_emergencies = 0

    try:
        user_counts = _dashboard_user_counts(db)
        total_users = sum(user_counts.values())
    except Exception as exc:
        _log_dashboard_query_failure("users", exc)

    try:
        today = utcnow().date()
        start_of_today = datetime.combine(today, time.min)
        end_of_today = datetime.combine(today, time.max)
        total_appointments = db.query(Appointment).count()
        today_appointments = db.query(Appointment).filter(
            Appointment.scheduled_time >= start_of_today,
            Appointment.scheduled_time <= end_of_today
        ).count()
    except Exception as exc:
        _log_dashboard_query_failure("appointments", exc)

    try:
        active_prescriptions = db.query(Prescription).filter(
            Prescription.status == "active"
        ).count()
    except Exception as exc:
        _log_dashboard_query_failure("prescriptions", exc)

    try:
        pending_labs = db.query(LabTest).filter(
            LabTest.status != LabTestStatus.COMPLETED.value
        ).count()
        pending_imaging = db.query(ImagingScan).filter(
            ImagingScan.status != ImagingScanStatus.COMPLETED.value
        ).count()
    except Exception as exc:
        _log_dashboard_query_failure("lab_imaging", exc)

    try:
        active_emergencies = db.query(AmbulanceRequest).filter(
            AmbulanceRequest.status != AmbulanceRequestStatus.COMPLETED.value,
            AmbulanceRequest.status != AmbulanceRequestStatus.CANCELLED.value,
            AmbulanceRequest.priority == EmergencyPriority.CRITICAL.value
        ).count()
    except Exception as exc:
        _log_dashboard_query_failure("emergencies", exc)

    stats_response = {
        "timestamp": utcnow().isoformat() if hasattr(utcnow(), "isoformat") else str(utcnow()),
        "users": {"total": total_users, "by_role": user_counts},
        "appointments": {"total": total_appointments, "today": today_appointments},
        "prescriptions": {"active": active_prescriptions},
        "lab_tests": {"pending": pending_labs},
        "imaging": {"pending": pending_imaging},
        "emergencies": {"active": active_emergencies},
        "system": {"db_status": "partially_online" if total_users == 0 else "operational"},
    }

    # Cache for 60 seconds
    try:
        redis_set(cache_key, json.dumps(stats_response), ex=60)
    except Exception as e:
        logger.warning("Failed to cache dashboard stats: %s", e)

    # Add final per-request info
    stats_response["current_admin_role"] = current_user.role.value
    return stats_response


# ─────────────────────────────────────────────────────────────────────────────
# User management (accessible to all admins)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users/", response_model=list[UserResponse])
async def list_all_users(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    role_filter: str = None,
    skip: int = 0,
    limit: int = 100
):
    """List all users with filtering"""

    query = db.query(User)

    if role_filter:
        try:
            role = UserRole[role_filter.upper()]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role filter: {role_filter}"
            )
        query = query.filter(normalized_enum_text(User.role) == role.value)

    # Regular admins cannot see super_admins
    if current_user.role == UserRole.ADMIN:
        query = query.filter(normalized_enum_text(User.role) != UserRole.SUPER_ADMIN.value)

    users = query.offset(skip).limit(limit).all()
    return users


@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Deactivate a user account"""

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate yourself")

    # Prevent regular admin from deactivating super admins or other admins
    if user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN) and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can deactivate admin accounts"
        )

    user.is_active = False
    _revoke_user_sessions(user)
    db.commit()

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.deactivate_user",
        resource_type="user", resource_id=user.id,
        description=f"Deactivated user {user.email}", status="warning",
    )

    return {"message": f"User {user.email} has been deactivated"}


@router.put("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Reactivate a user account"""

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent regular admin from reactivating super admins
    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can reactivate super admin accounts"
        )

    user.is_active = True
    # Invalidate status cache
    redis_delete(f"user:{user.id}:status")
    db.commit()

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.reactivate_user",
        resource_type="user", resource_id=user.id,
        description=f"Reactivated user {user.email}", status="success",
    )

    return {"message": f"User {user.email} has been reactivated"}


@router.put("/users/{user_id}/change-role")
async def change_user_role(
    user_id: int,
    payload: Optional[ChangeUserRoleRequest] = Body(default=None),
    new_role: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Change user's role — super_admin required to assign admin/super_admin roles"""

    requested_role = payload.new_role if isinstance(payload, ChangeUserRoleRequest) else new_role
    if not requested_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_role is required",
        )

    role = _parse_user_role(requested_role)

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")

    # Only super_admin can assign or remove admin/super_admin roles
    elevated = {UserRole.ADMIN, UserRole.SUPER_ADMIN}
    if (role in elevated or user.role in elevated) and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can assign or remove admin-level roles"
        )

    old_role = user.role
    user.role = role
    user.is_verified = role in (UserRole.PATIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    _revoke_user_sessions(user)
    db.commit()

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.change_user_role",
        resource_type="user", resource_id=user.id,
        description=f"Changed role from {old_role.value} to {role.value}", status="warning",
    )

    return {
        "message": f"User role changed from {old_role.value} to {role.value}",
        "user_id": user_id, "old_role": old_role.value, "new_role": role.value
    }


@router.post("/users/create", response_model=UserResponse)
async def create_user_account(
    payload: CreateUserRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new user account through the admin console."""

    if payload.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN) and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can create admin or super admin accounts"
        )

    existing = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already in use"
        )

    new_user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        role=payload.role,
        license_number=payload.license_number,
        specialty=payload.specialty,
        license_state=payload.license_state,
        postdicom_api_url=payload.postdicom_api_url,
        postdicom_api_key=payload.postdicom_api_key,
        is_active=True,
        is_verified=payload.role in (UserRole.PATIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
        email_verified=True,
        email_verified_at=utcnow(),
        session_version=0,
        notification_email=True,
        notification_sms=False,
        privacy_public_profile=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    from app.routes.audit import log_action
    await log_action(
        db=db,
        user_id=current_user.id,
        action="admin.create_user",
        resource_type="user",
        resource_id=new_user.id,
        description=f"Created account with role {new_user.role.value}: {new_user.email}",
        status="created",
    )

    return new_user


# ─────────────────────────────────────────────────────────────────────────────
# SUPER ADMIN ONLY — Admin account management
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/admins/create", response_model=UserResponse)
async def create_admin_account(
    payload: CreateAdminRequest,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Create a new admin or super_admin account (SUPER_ADMIN only)"""

    allowed_roles = {"admin", "super_admin"}
    if payload.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {allowed_roles}"
        )

    existing = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already in use"
        )

    try:
        role_enum = UserRole[payload.role.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid role")

    new_admin = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        role=role_enum,
        is_active=True,
        is_verified=True,
        email_verified=True,
        email_verified_at=utcnow(),
        session_version=0,
        notification_email=True,
        notification_sms=False,
        privacy_public_profile=False,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="superadmin.create_admin",
        resource_type="user", resource_id=new_admin.id,
        description=f"Created {role_enum.value} account: {new_admin.email}", status="created",
    )

    return new_admin


@router.delete("/users/{user_id}")
async def delete_user_account(
    user_id: int,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Permanently delete a user account (SUPER_ADMIN only)"""

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")

    user_email = user.email
    user_role = user.role.value

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="superadmin.delete_user",
        resource_type="user", resource_id=user_id,
        description=f"Permanently deleted user {user_email} (role={user_role})", status="critical",
    )

    db.delete(user)
    db.commit()

    return {"message": f"User {user_email} has been permanently deleted"}


@router.get("/admins/", response_model=list[UserResponse])
async def list_admins(
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List all admin and super_admin accounts (SUPER_ADMIN only)"""
    role_text = normalized_enum_text(User.role)
    admins = db.query(User).filter(
        role_text.in_([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value])
    ).offset(skip).limit(limit).all()
    return admins


@router.get("/system/info")
async def get_system_info(
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Get detailed system information (SUPER_ADMIN only)"""

    total_users = db.query(User).count()
    total_admins = db.query(User).filter(
        normalized_enum_text(User.role).in_([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value])
    ).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    inactive_users = total_users - active_users

    from app.models.audit_log import AuditLog
    total_audit_logs = db.query(AuditLog).count()
    recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5).all()

    return {
        "system": {
            "version": "2.0.0",
            "environment": "production",
            "db_status": "operational",
            "timestamp": utcnow()
        },
        "users": {
            "total": total_users,
            "active": active_users,
            "inactive": inactive_users,
            "admins": total_admins
        },
        "audit": {
            "total_logs": total_audit_logs,
            "recent_actions": [log.to_dict() for log in recent_logs]
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Analytics (all admins)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analytics/appointments")
async def get_appointment_analytics(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    days: int = 30
):
    """Get appointment analytics for last N days"""

    start_date = utcnow() - timedelta(days=days)
    aggregates = (
        db.query(Appointment.status, func.count(Appointment.id))
        .filter(Appointment.created_at >= start_date)
        .group_by(Appointment.status)
        .all()
    )

    total = 0
    status_counts = {}
    for status_value, count in aggregates:
        normalized_status = status_value.value if hasattr(status_value, "value") else str(status_value)
        numeric_count = int(count or 0)
        status_counts[normalized_status] = numeric_count
        total += numeric_count

    return {
        "period_days": days,
        "total": total,
        "by_status": status_counts,
        "average_per_day": total / days if days > 0 else 0
    }


@router.get("/analytics/users")
async def get_user_analytics(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    days: int = 30
):
    """Get user signup analytics"""

    start_date = utcnow() - timedelta(days=days)
    aggregates = (
        db.query(User.role, func.count(User.id))
        .filter(User.created_at >= start_date)
        .group_by(User.role)
        .all()
    )

    total = 0
    users_by_role = {}
    for role_value, count in aggregates:
        normalized_role = role_value.value if hasattr(role_value, "value") else str(role_value)
        numeric_count = int(count or 0)
        users_by_role[normalized_role] = numeric_count
        total += numeric_count

    return {
        "period_days": days,
        "new_users": total,
        "by_role": users_by_role
    }


# ─────────────────────────────────────────────────────────────────────────────
# Audit logs (all admins can view; super admin can see everything)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/audit-logs/", response_model=list[AuditLogResponse])
async def get_audit_logs(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get audit logs"""

    from app.models.audit_log import AuditLog

    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    # Regular admins cannot see super_admin actions
    if current_user.role == UserRole.ADMIN:
        query = query.filter(~AuditLog.action.like("superadmin.%"))

    logs = query.offset(skip).limit(limit).all()
    return [AuditLogResponse(**log.to_dict()) for log in logs]


# ─────────────────────────────────────────────────────────────────────────────
# System health
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/system/health")
async def get_system_health(
    current_user: User = Depends(get_current_admin)
):
    """Get system health status"""

    return {
        "status": "healthy",
        "timestamp": utcnow(),
        "database": "connected",
        "cache": "operational",
        "version": "2.0.0",
        "requesting_role": current_user.role.value
    }


# ─────────────────────────────────────────────────────────────────────────────
# Trust Pillar: Professional Verification
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/verifications/pending", response_model=list[UserResponse])
async def get_pending_verifications(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """List providers awaiting professional verification"""

    providers = _workforce_users_query(db).filter(
        User.is_verified.is_(False),
        User.is_active.is_(True)
    ).all()
    return providers


@router.get("/verifications/", response_model=list[UserResponse])
async def list_verifications(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """List all workforce verification records"""
    return _workforce_users_query(db).order_by(User.created_at.desc()).all()


@router.put("/verifications/{user_id}/approve")
async def approve_provider(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Verify a provider's professional credentials"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.PATIENT:
        raise HTTPException(status_code=400, detail="Patients do not require professional verification")

    user.is_verified = True
    user.is_active = True
    db.commit()

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.verify_provider",
        resource_type="user", resource_id=user.id,
        description=f"Verified account for {user.email}", status="success",
    )

    return {"message": f"Provider {user.email} verified successfully", "user_id": user_id}


@router.put("/verifications/{user_id}/reject")
async def reject_provider(
    user_id: int,
    reason: str = "Invalid credentials",
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Reject/Flag a provider's credentials"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.PATIENT:
        raise HTTPException(status_code=400, detail="Patients do not require professional verification")

    user.is_active = False
    user.is_verified = False
    _revoke_user_sessions(user)
    db.commit()

    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.reject_verification",
        resource_type="user", resource_id=user.id,
        description=f"Rejected verification for {user.email}: {reason}", status="warning",
    )

    return {"message": f"Provider {user.email} rejected: {reason}", "user_id": user_id}


# ─────────────────────────────────────────────────────────────────────────────
# Management Pillar: Ecosystem Activity
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ecosystem/activity")
async def get_ecosystem_activity(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = 20
):
    """Centralized feed of recent ecosystem events"""

    limit = min(max(limit, 1), 100)
    activity = []

    try:
        appts = db.query(Appointment).order_by(Appointment.created_at.desc()).limit(10).all()
        for a in appts:
            activity.append({
                "type": "appointment",
                "time": a.created_at,
                "description": f"Appointment scheduled for {a.scheduled_time.strftime('%Y-%m-%d')}",
                "status": a.status
            })

        scripts = db.query(Prescription).order_by(Prescription.created_at.desc()).limit(10).all()
        for s in scripts:
            activity.append({
                "type": "prescription",
                "time": s.created_at,
                "description": f"New prescription for {s.medication_name}",
                "status": s.status
            })

    except Exception as exc:
        logger.error("Failed to build activity feed: %s", exc)

    activity.sort(key=lambda x: x["time"], reverse=True)
    return activity[:limit]


# ─────────────────────────────────────────────────────────────────────────────
# System Settings & Maintenance
# ─────────────────────────────────────────────────────────────────────────────

def _get_or_create_system_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/system/settings", response_model=SystemSettingsResponse)
async def get_system_settings(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get global system settings including maintenance mode status"""
    return _get_or_create_system_settings(db)


@router.put("/system/settings", response_model=SystemSettingsResponse)
async def update_system_settings(
    payload: SystemSettingsUpdate,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Update global system settings (SUPER_ADMIN only)"""
    settings = _get_or_create_system_settings(db)
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    
    settings.updated_by_id = current_user.id
    db.commit()
    db.refresh(settings)
    
    # Invalidate caches to reflect changes immediately
    from app.utils.redis import redis_delete
    redis_delete("system:maintenance_mode")
    redis_delete("system:maintenance_message")
    redis_delete("system:status_blob")
    
    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.update_system_settings",
        resource_type="system_settings", resource_id=settings.id,
        description=f"Updated system settings. Maintenance={settings.is_maintenance_mode}",
        status="warning" if settings.is_maintenance_mode else "info",
    )
    
    return settings


class GlobalNotificationRequest(BaseModel):
    title: str
    message: str
    notification_type: str = "alert"
    action_url: Optional[str] = None


@router.post("/system/notify-all")
async def notify_all_users(
    payload: GlobalNotificationRequest,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Send a notification to all active users in the system (SUPER_ADMIN only)"""
    
    # Get all active users
    active_users = db.query(User).filter(User.is_active == True).all()
    
    notifications = []
    for user in active_users:
        notifications.append(Notification(
            user_id=user.id,
            title=payload.title,
            message=payload.message,
            notification_type=payload.notification_type,
            action_url=payload.action_url
        ))
    
    db.add_all(notifications)
    db.commit()
    
    from app.routes.audit import log_action
    await log_action(
        db=db, user_id=current_user.id, action="admin.notify_all",
        resource_type="system", resource_id=0,
        description=f"Sent global notification to {len(active_users)} users: {payload.title}",
        status="info",
    )
    
    return {"message": f"Notification sent to {len(active_users)} users"}


@router.get("/ecosystem-activity", response_model=list)
async def get_ecosystem_activity(
    limit: int = 20,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get a unified feed of the most recent critical activities across the ecosystem"""
    activity = []
    
    try:
        appointments = db.query(Appointment).order_by(Appointment.created_at.desc()).limit(limit).all()
        for a in appointments:
            activity.append({
                "type": "appointment",
                "time": a.created_at,
                "description": f"Appointment scheduled: {a.title}",
                "status": a.status
            })

        scripts = db.query(Prescription).order_by(Prescription.created_at.desc()).limit(limit).all()
        for s in scripts:
            activity.append({
                "type": "prescription",
                "time": s.created_at,
                "description": f"New prescription issued: {s.medication_name}",
                "status": s.status
            })

        labs = db.query(LabTest).order_by(LabTest.ordered_at.desc()).limit(limit).all()
        for l in labs:
            activity.append({
                "type": "lab_test",
                "time": l.ordered_at,
                "description": f"Lab test requested: {l.test_name}",
                "status": l.status
            })
    except Exception as exc:
        logger.warning("Failed to build ecosystem activity feed", exc_info=exc)

    activity.sort(key=lambda x: x.get("time") or "", reverse=True)
    return activity[:limit]


# ─────────────────────────────────────────────────────────────────────────────
# OPS Pillar: Emergency Dispatch Monitoring
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ops/emergencies/active")
async def get_active_emergency_dispatch(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Real-time view of active emergency requests"""

    try:
        active_requests = db.query(AmbulanceRequest).filter(
            AmbulanceRequest.status.in_([
                AmbulanceRequestStatus.PENDING.value,
                AmbulanceRequestStatus.DISPATCHED.value,
                AmbulanceRequestStatus.EN_ROUTE.value,
                AmbulanceRequestStatus.ARRIVED.value
            ])
        ).order_by(AmbulanceRequest.requested_at.desc()).all()

        return [req.to_dict() for req in active_requests]
    except Exception as exc:
        logger.warning("Failed to load active emergency dispatch view", exc_info=exc)
        return []
