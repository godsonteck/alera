import json
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from database import Base
from app.utils.time import utcnow


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    role = Column(String(50), nullable=True, index=True)

    # Action Details
    action = Column(String(255), nullable=False)
    resource = Column(String(255), nullable=True, index=True)
    resource_type = Column(String(100), nullable=False)  # User, Appointment, Prescription, etc.
    resource_id = Column(String(100), nullable=True)
    status = Column(String(50), default="success", nullable=False, index=True)

    # Change Details
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    # Request Info
    ip_address = Column(String(45), nullable=True)  # supports IPv6
    user_agent = Column(Text, nullable=True)
    device_info = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    request_id = Column(String(64), nullable=True, index=True)
    request_method = Column(String(16), nullable=True)
    request_path = Column(String(255), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Compliance
    reason = Column(String(500), nullable=True)  # Why was this action taken
    severity = Column(String(50), default="info", nullable=False)  # info, warning, critical
    
    # Timestamp
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    
    # Relationship
    user = relationship("User", back_populates="audit_logs")
    
    # Indexes
    __table_args__ = (
        Index('idx_audit_log_user_id', 'user_id'),
        Index('idx_audit_log_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_log_action', 'action'),
        Index('idx_audit_log_created_at', 'created_at'),
        Index('idx_audit_log_severity', 'severity'),
        Index('idx_audit_log_role', 'role'),
        Index('idx_audit_log_status', 'status'),
        Index('idx_audit_log_resource_label', 'resource'),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, resource={self.resource_type})>"

    @staticmethod
    def _timestamp_value(value) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, str) and value.strip():
            return value
        if value is not None:
            return str(value)
        return utcnow().isoformat()

    def to_dict(self):
        metadata = {}
        if self.metadata_json:
            try:
                metadata = json.loads(self.metadata_json)
            except Exception:
                metadata = {"raw": self.metadata_json}

        return {
            "id": self.id,
            "user_id": self.user_id,
            "role": self.role,
            "action": self.action,
            "resource": self.resource,
            "resource_type": self.resource_type or "system",
            "resource_id": self.resource_id,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "changes": self.old_value,
            "description": self.new_value,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "device_info": self.device_info,
            "metadata": metadata,
            "reason": self.reason,
            "severity": self.severity or "info",
            "status": self.status or "success",
            "error_message": self.reason,
            "request_id": self.request_id,
            "request_method": self.request_method,
            "request_path": self.request_path,
            "duration_ms": self.duration_ms,
            "timestamp": self._timestamp_value(self.created_at),
            "created_at": self._timestamp_value(self.created_at),
        }
