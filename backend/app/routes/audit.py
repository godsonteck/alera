"""
Audit log and compliance endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import sys

from database import get_db
from app.models import AuditLog
from app.models.user import User
from app.schemas.additional_features import (
    AuditLogResponse,
    AuditLogFilter,
    AuditLogListResponse,
)
from app.utils.dependencies import get_current_super_admin
from app.utils.time import utcnow
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    """
    Get audit logs (admin only)
    
    Filters:
    - user_id: Filter by user
    - action: Filter by action (view, create, update, delete, etc.)
    - resource_type: Filter by resource type
    - days: Number of days to look back (default: 30, max: 2555 for 7 years)
    """
    
    skip = max(skip, 0)
    limit = max(1, min(limit, 200))
    
    query = db.query(AuditLog)

    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    if role:
        query = query.filter(AuditLog.role == role)

    if action:
        query = query.filter(AuditLog.action == action)

    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)

    if status_filter:
        query = query.filter(AuditLog.status == status_filter)

    if search:
        like_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(like_term),
                AuditLog.role.ilike(like_term),
                AuditLog.resource.ilike(like_term),
                AuditLog.resource_type.ilike(like_term),
                AuditLog.ip_address.ilike(like_term),
                AuditLog.device_info.ilike(like_term),
                AuditLog.new_value.ilike(like_term),
                AuditLog.reason.ilike(like_term),
                AuditLog.metadata_json.ilike(like_term),
            )
        )

    # Order by most recent first
    query = query.order_by(AuditLog.created_at.desc())

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return AuditLogListResponse(
        total=total,
        items=[AuditLogResponse(**log.to_dict()) for log in items]
    )


@router.post("/export", status_code=status.HTTP_200_OK)
async def export_audit_logs(
    filter_data: AuditLogFilter,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    """
    Export audit logs as CSV
    For compliance and auditing purposes
    (Admin only)
    """
    
    from fastapi.responses import StreamingResponse
    import csv
    import io

    query = db.query(AuditLog)

    if filter_data.user_id is not None:
        query = query.filter(AuditLog.user_id == filter_data.user_id)

    if filter_data.action:
        query = query.filter(AuditLog.action == filter_data.action)

    if filter_data.role:
        query = query.filter(AuditLog.role == filter_data.role)

    if filter_data.resource_type:
        query = query.filter(AuditLog.resource_type == filter_data.resource_type)

    if filter_data.status:
        query = query.filter(AuditLog.status == filter_data.status)

    if filter_data.search:
        like_term = f"%{filter_data.search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(like_term),
                AuditLog.role.ilike(like_term),
                AuditLog.resource.ilike(like_term),
                AuditLog.resource_type.ilike(like_term),
                AuditLog.ip_address.ilike(like_term),
                AuditLog.device_info.ilike(like_term),
                AuditLog.new_value.ilike(like_term),
                AuditLog.reason.ilike(like_term),
                AuditLog.metadata_json.ilike(like_term),
            )
        )

    if filter_data.start_date:
        query = query.filter(AuditLog.created_at >= filter_data.start_date)

    if filter_data.end_date:
        query = query.filter(AuditLog.created_at <= filter_data.end_date)

    logs = query.order_by(AuditLog.created_at.desc()).all()

    # Create CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'id', 'user_id', 'action', 'resource_type', 'resource_id',
        'role', 'resource', 'description', 'status', 'timestamp', 'ip_address', 'device_info'
    ])
    writer.writeheader()

    for log in logs:
        log_data = log.to_dict()
        writer.writerow({
            'id': log_data["id"],
            'user_id': log_data["user_id"],
            'action': log_data["action"],
            'role': log_data["role"],
            'resource': log_data["resource"],
            'resource_type': log_data["resource_type"],
            'resource_id': log_data["resource_id"],
            'description': log_data["description"],
            'status': log_data["status"],
            'timestamp': log_data["timestamp"],
            'ip_address': log_data["ip_address"],
            'device_info': log_data["device_info"],
        })

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment;filename=audit_logs.csv"}
    )


@router.get("/compliance/data-retention", status_code=status.HTTP_200_OK)
async def get_data_retention_policy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    """
    Get data retention policy information
    Shows HIPAA compliance details
    """
    
    # Get oldest log
    oldest_log = db.query(AuditLog).order_by(AuditLog.created_at.asc()).first()

    return {
        "policy": "7-year retention for HIPAA compliance",
        "retention_days": 2555,
        "oldest_record": oldest_log.created_at.isoformat() if oldest_log is not None else None,
        "oldest_record_days_old": (utcnow() - oldest_log.created_at).days if oldest_log is not None else 0,
        "description": "All audit logs are retained for 7 years as required by HIPAA regulations",
        "gdpr_compliance": "Personal data is deleted upon patient request unless legal hold applies",
    }


@router.get("/user/{user_id}/history", response_model=AuditLogListResponse)
async def get_user_audit_history(
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    """Get audit history for a specific user"""

    days = max(1, min(days, 2555))
    skip = max(skip, 0)
    limit = max(1, min(limit, 100))

    start_date = utcnow() - timedelta(days=days)

    query = db.query(AuditLog).filter(
        AuditLog.user_id == user_id,
        AuditLog.created_at >= start_date
    ).order_by(AuditLog.created_at.desc())

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return AuditLogListResponse(
        total=total,
        items=[AuditLogResponse(**log.to_dict()) for log in items]
    )


@router.get("/resource/{resource_type}/{resource_id}/changes", response_model=AuditLogListResponse)
async def get_resource_changes(
    resource_type: str,
    resource_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    """
    Get audit trail for a specific resource
    Shows all changes to a patient, appointment, prescription, etc.
    """
    
    skip = max(skip, 0)
    limit = max(1, min(limit, 100))

    query = db.query(AuditLog).filter(
        AuditLog.resource_type == resource_type,
        AuditLog.resource_id == resource_id
    ).order_by(AuditLog.created_at.desc())

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return AuditLogListResponse(
        total=total,
        items=[AuditLogResponse(**log.to_dict()) for log in items]
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
):
    """Get a specific audit log entry (admin only)"""

    audit_log = db.query(AuditLog).filter(
        AuditLog.id == log_id
    ).first()

    if not audit_log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return AuditLogResponse(**audit_log.to_dict())


@router.get("/summary/overview")
async def get_audit_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_super_admin),
    days: int = 7,
):
    days = max(1, min(days, 90))
    start_date = utcnow() - timedelta(days=days)

    base_query = db.query(AuditLog).filter(AuditLog.created_at >= start_date)
    total = base_query.count()
    failed_logins = base_query.filter(AuditLog.action == "auth.login.failed").count()
    critical = base_query.filter(AuditLog.severity == "critical").count()

    top_actions = (
        db.query(AuditLog.action, func.count(AuditLog.id))
        .filter(AuditLog.created_at >= start_date)
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
        .all()
    )

    recent_suspicious = (
        base_query.filter(
            or_(
                AuditLog.action == "auth.login.failed",
                AuditLog.severity == "critical",
                AuditLog.status == "failed",
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "period_days": days,
        "total_logs": total,
        "failed_logins": failed_logins,
        "critical_events": critical,
        "top_actions": [{"action": action, "count": count} for action, count in top_actions],
        "recent_suspicious": [log.to_dict() for log in recent_suspicious],
    }


sys.modules.setdefault("app.routes.audit", sys.modules[__name__])
sys.modules.setdefault("backend.app.routes.audit", sys.modules[__name__])
