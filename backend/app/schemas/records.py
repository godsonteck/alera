from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class StructuredRecordCreate(BaseModel):
    id: Optional[str] = None
    record_type: str = Field(..., min_length=1)
    patient_id: Optional[int] = None
    provider_id: Optional[int] = None
    created_by: Optional[int] = None
    appointment_id: Optional[int] = None
    status: Optional[str] = None
    payload: dict[str, Any]


class StructuredRecordUpdate(BaseModel):
    patient_id: Optional[int] = None
    provider_id: Optional[int] = None
    created_by: Optional[int] = None
    appointment_id: Optional[int] = None
    status: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


class StructuredRecordResponse(BaseModel):
    id: str
    record_type: str
    patient_id: Optional[int] = None
    provider_id: Optional[int] = None
    created_by: Optional[int] = None
    appointment_id: Optional[int] = None
    status: Optional[str] = None
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StructuredRecordListResponse(BaseModel):
    total: int
    items: list[StructuredRecordResponse]


class SynchronizedHistoryParticipant(BaseModel):
    user_id: int
    role: str
    name: str


class SynchronizedHistoryCounts(BaseModel):
    appointments: int
    allergies: int
    medical_history_entries: int
    prescriptions: int
    lab_tests: int
    imaging_scans: int
    structured_records: int


class SynchronizedHistoryTimelineEntry(BaseModel):
    source: str
    source_id: str
    title: str
    status: Optional[str] = None
    timestamp: Optional[datetime] = None
    provider_id: Optional[int] = None
    provider_name: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class SynchronizedHistoryResponse(BaseModel):
    patient_id: int
    access_scope: str
    has_shared_history_consent: bool
    interacting_organizations: list[SynchronizedHistoryParticipant]
    counts: SynchronizedHistoryCounts
    appointments: list[dict[str, Any]]
    allergies: list[dict[str, Any]]
    medical_history: list[dict[str, Any]]
    prescriptions: list[dict[str, Any]]
    lab_tests: list[dict[str, Any]]
    imaging_scans: list[dict[str, Any]]
    structured_records: list[StructuredRecordResponse]
    timeline: list[SynchronizedHistoryTimelineEntry]


import sys

sys.modules.setdefault("app.schemas.records", sys.modules[__name__])
sys.modules.setdefault("backend.app.schemas.records", sys.modules[__name__])
