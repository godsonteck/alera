from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OrganizationResponse(BaseModel):
    id: int
    name: str
    slug: str
    organization_type: str
    description: str | None = None
    is_active: bool
    created_by: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255)
    organization_type: str = Field(..., min_length=1, max_length=64)
    description: str | None = None


class OrganizationListResponse(BaseModel):
    total: int
    items: list[OrganizationResponse]


class MedicalRecordBase(BaseModel):
    patient_id: int
    organization_id: int | None = None
    provider_id: int | None = None
    parent_record_id: str | None = None
    record_type: str
    category: str | None = None
    title: str
    summary: str | None = None
    status: str | None = None
    event_time: datetime | None = None
    source_system: str = "alera"
    source_record_id: str | None = None
    source_version: str | None = None
    is_external: bool = False
    payload: dict[str, Any] = Field(default_factory=dict)


class MedicalRecordCreate(MedicalRecordBase):
    id: str | None = None


class MedicalRecordUpdate(BaseModel):
    organization_id: int | None = None
    provider_id: int | None = None
    parent_record_id: str | None = None
    category: str | None = None
    title: str | None = None
    summary: str | None = None
    status: str | None = None
    event_time: datetime | None = None
    source_version: str | None = None
    is_external: bool | None = None
    sync_status: str | None = None
    payload: dict[str, Any] | None = None


class MedicalDocumentResponse(BaseModel):
    id: str
    medical_record_id: str
    patient_id: int
    organization_id: int | None = None
    uploaded_by: int | None = None
    file_id: str
    filename: str
    mime_type: str
    file_size: int
    document_type: str
    storage_subpath: str
    description: str | None = None
    is_external: bool
    source_system: str
    source_document_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class MedicalRecordResponse(MedicalRecordBase):
    id: str
    is_deleted: bool = False
    sync_status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    documents: list[MedicalDocumentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MedicalRecordListResponse(BaseModel):
    total: int
    items: list[MedicalRecordResponse]


class PatientPermissionCreate(BaseModel):
    patient_id: int
    organization_id: int
    scope: list[str] = Field(default_factory=lambda: ["full_record"])
    reason: str | None = None


class PatientPermissionUpdate(BaseModel):
    scope: list[str] | None = None
    reason: str | None = None
    expires_at: datetime | None = None


class PatientPermissionAction(BaseModel):
    reason: str | None = None
    expires_at: datetime | None = None


class PatientPermissionResponse(BaseModel):
    id: str
    patient_id: int
    organization_id: int
    requested_by: int | None = None
    granted_by: int | None = None
    revoked_by: int | None = None
    scope: list[str] = Field(default_factory=list)
    status: str
    reason: str | None = None
    requested_at: datetime | None = None
    granted_at: datetime | None = None
    revoked_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PatientPermissionListResponse(BaseModel):
    total: int
    items: list[PatientPermissionResponse]


class UnifiedPatientRecordResponse(BaseModel):
    patient_id: int
    organization_access: list[OrganizationResponse] = Field(default_factory=list)
    permissions: list[PatientPermissionResponse] = Field(default_factory=list)
    records: list[MedicalRecordResponse] = Field(default_factory=list)
    timeline: list[MedicalRecordResponse] = Field(default_factory=list)
    document_count: int = 0


class ExternalMedicalIngestionResponse(BaseModel):
    medical_record: MedicalRecordResponse
    document: MedicalDocumentResponse | None = None
