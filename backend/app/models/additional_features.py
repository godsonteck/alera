"""
Additional data models for Phase 3C features
"""

from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import sys
from database import Base
from app.utils.db_types import enum_values
from app.utils.time import utcnow


class DocumentType(str, enum.Enum):
    PRESCRIPTION = "prescription"
    LAB_RESULT = "lab_result"
    IMAGING = "imaging"
    CLINICAL_NOTE = "clinical_note"
    CONSENT = "consent"
    OTHER = "other"


class PatientDocument(Base):
    """Store medical documents/files"""
    __tablename__ = "patient_documents"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    file_id = Column(String, unique=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(SQLEnum(DocumentType, values_callable=enum_values), default=DocumentType.OTHER)
    file_size = Column(Integer)  # bytes
    mime_type = Column(String)
    upload_time = Column(DateTime, default=utcnow)
    
    # Metadata
    description = Column(String)
    uploaded_by = Column(Integer, ForeignKey("users.id"))  # user_id
    is_private = Column(Boolean, default=False)
    
    # Tracking
    accessed_count = Column(Integer, default=0)
    last_accessed = Column(DateTime)
    
    # Relationships
    patient = relationship("User", foreign_keys=[patient_id])
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by])

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "file_id": self.file_id,
            "filename": self.filename,
            "file_type": self.file_type.value,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "upload_time": self.upload_time.isoformat() if self.upload_time is not None else None,
            "description": self.description,
            "uploaded_by": self.uploaded_by,
            "is_private": self.is_private,
            "accessed_count": self.accessed_count,
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed is not None else None,
        }


class PatientConsent(Base):
    """Track patient consents and agreements"""
    __tablename__ = "patient_consents"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Consent details
    consent_type = Column(String)  # data_sharing, treatment, research, etc.
    title = Column(String, nullable=False)
    description = Column(Text)
    
    # Consent status
    is_accepted = Column(Boolean, default=False)
    accepted_at = Column(DateTime)
    expires_at = Column(DateTime)  # Optional expiration
    
    # Document reference
    document_file_id = Column(String, ForeignKey("patient_documents.file_id"))
    
    # Tracking
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    requested_by = Column(Integer)  # user_id who requested consent
    
    # Relationships
    patient = relationship("User", foreign_keys=[patient_id])
    document = relationship("PatientDocument", foreign_keys=[document_file_id])

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "consent_type": self.consent_type,
            "title": self.title,
            "description": self.description,
            "is_accepted": self.is_accepted,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at is not None else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at is not None else None,
            "document_file_id": self.document_file_id,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
            "requested_by": self.requested_by,
        }


class AppointmentReminder(Base):
    """Schedule and track appointment reminders"""
    __tablename__ = "appointment_reminders"

    id = Column(String, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    
    # Reminder details
    reminder_type = Column(String)  # email, sms, push
    scheduled_time = Column(DateTime, nullable=False)  # When to send
    
    # Status tracking
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    delivery_status = Column(String)  # pending, sent, failed, bounced
    
    # Recipient
    recipient = Column(String)  # email or phone number
    recipient_id = Column(Integer, ForeignKey("users.id"))
    
    # Additional info
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime)
    error_message = Column(String)
    
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "appointment_id": self.appointment_id,
            "reminder_type": self.reminder_type,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time is not None else None,
            "is_sent": self.is_sent,
            "sent_at": self.sent_at.isoformat() if self.sent_at is not None else None,
            "delivery_status": self.delivery_status,
            "recipient": self.recipient,
            "recipient_id": self.recipient_id,
            "retry_count": self.retry_count,
            "last_retry_at": self.last_retry_at.isoformat() if self.last_retry_at is not None else None,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
        }


class EmailTemplate(Base):
    """Store customizable email templates"""
    __tablename__ = "email_templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    subject = Column(String, nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text)  # Plain text alternative
    
    # Template variables (for templating)
    variables = Column(String)  # JSON list of variable names
    
    # Status
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # System templates can't be deleted
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "subject": self.subject,
            "body_html": self.body_html,
            "body_text": self.body_text,
            "variables": self.variables,
            "is_active": self.is_active,
            "is_system": self.is_system,
            "usage_count": self.usage_count,
            "last_used": self.last_used.isoformat() if self.last_used is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


class SMSTemplate(Base):
    """Store customizable SMS templates"""
    __tablename__ = "sms_templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    content = Column(String, nullable=False)  # SMS max 160 chars
    
    # Template variables
    variables = Column(String)  # JSON list of variable names
    
    # Status
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "content": self.content,
            "variables": self.variables,
            "is_active": self.is_active,
            "is_system": self.is_system,
            "usage_count": self.usage_count,
            "last_used": self.last_used.isoformat() if self.last_used is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


sys.modules.setdefault("app.models.additional_features", sys.modules[__name__])
sys.modules.setdefault("backend.app.models.additional_features", sys.modules[__name__])
