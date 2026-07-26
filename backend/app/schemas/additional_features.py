"""
Pydantic schemas for Phase 3C features
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum


# File/Document Schemas

class DocumentTypeEnum(str, Enum):
    PRESCRIPTION = "prescription"
    LAB_RESULT = "lab_result"
    IMAGING = "imaging"
    CLINICAL_NOTE = "clinical_note"
    CONSENT = "consent"
    OTHER = "other"


class PatientDocumentCreate(BaseModel):
    description: Optional[str] = None
    is_private: bool = False


class PatientDocumentUpdate(BaseModel):
    description: Optional[str] = None
    is_private: Optional[bool] = None


class PatientDocumentResponse(BaseModel):
    id: str
    patient_id: int
    file_id: str
    filename: str
    file_type: str
    file_size: int
    mime_type: str
    upload_time: Optional[str]
    description: Optional[str]
    uploaded_by: Optional[int]
    is_private: bool
    accessed_count: int
    last_accessed: Optional[str]

    model_config = ConfigDict(from_attributes=True)


# Consent Schemas

class PatientConsentCreate(BaseModel):
    consent_type: str
    title: str
    description: Optional[str] = None
    expires_at: Optional[datetime] = None


class PatientConsentUpdate(BaseModel):
    is_accepted: bool = False
    title: Optional[str] = None
    description: Optional[str] = None


class PatientConsentResponse(BaseModel):
    id: str
    patient_id: int
    consent_type: str
    title: str
    description: Optional[str]
    is_accepted: bool
    accepted_at: Optional[str]
    expires_at: Optional[str]
    document_file_id: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    requested_by: Optional[int]

    model_config = ConfigDict(from_attributes=True)


# Reminder Schemas

class AppointmentReminderCreate(BaseModel):
    appointment_id: int
    reminder_type: str = Field(..., description="email, sms, or push")
    scheduled_time: datetime
    recipient: str
    recipient_id: Optional[int] = None


class AppointmentReminderUpdate(BaseModel):
    is_sent: Optional[bool] = None
    delivery_status: Optional[str] = None
    error_message: Optional[str] = None


class AppointmentReminderResponse(BaseModel):
    id: str
    appointment_id: int
    reminder_type: str
    scheduled_time: str
    is_sent: bool
    sent_at: Optional[str]
    delivery_status: str
    recipient: str
    recipient_id: Optional[int]
    retry_count: int
    last_retry_at: Optional[str]
    error_message: Optional[str]
    created_at: str

    model_config = ConfigDict(from_attributes=True)


# Template Schemas

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    variables: Optional[str] = None
    is_active: bool = True


class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    variables: Optional[str] = None
    is_active: Optional[bool] = None


class EmailTemplateResponse(BaseModel):
    id: str
    name: str
    subject: str
    body_html: str
    body_text: Optional[str]
    variables: Optional[str]
    is_active: bool
    is_system: bool
    usage_count: int
    last_used: Optional[str]
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class SMSTemplateCreate(BaseModel):
    name: str
    content: str = Field(..., max_length=160)
    variables: Optional[str] = None
    is_active: bool = True


class SMSTemplateUpdate(BaseModel):
    content: Optional[str] = Field(None, max_length=160)
    variables: Optional[str] = None
    is_active: Optional[bool] = None


class SMSTemplateResponse(BaseModel):
    id: str
    name: str
    content: str
    variables: Optional[str]
    is_active: bool
    is_system: bool
    usage_count: int
    last_used: Optional[str]
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# Audit Log Schemas

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    role: Optional[str] = None
    action: str
    resource: Optional[str] = None
    resource_type: Optional[str]
    resource_id: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    changes: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str]
    user_agent: Optional[str]
    device_info: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = None
    severity: str
    status: Optional[str] = None
    error_message: Optional[str] = None
    request_id: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    duration_ms: Optional[int] = None
    timestamp: str
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogFilter(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    status: Optional[str] = None
    search: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# Batch Responses

class DocumentListResponse(BaseModel):
    total: int
    items: List[PatientDocumentResponse]


class ConsentListResponse(BaseModel):
    total: int
    items: List[PatientConsentResponse]


class ReminderListResponse(BaseModel):
    total: int
    items: List[AppointmentReminderResponse]


class AuditLogListResponse(BaseModel):
    total: int
    items: List[AuditLogResponse]


class TemplateListResponse(BaseModel):
    total: int
    items: List[EmailTemplateResponse]
