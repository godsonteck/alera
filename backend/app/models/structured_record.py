from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import relationship

from database import Base
from app.utils.time import utcnow


class StructuredRecord(Base):
    """
    Generic persistence layer for patient/provider dashboard records.

    This stores the long tail of workflow entities that do not need a bespoke
    table but still must be durable and queryable in production.
    """

    __tablename__ = "structured_records"

    id = Column(String(128), primary_key=True, index=True)
    record_type = Column(String(64), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)
    status = Column(String(64), nullable=True, index=True)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    patient = relationship("User", foreign_keys=[patient_id])
    provider = relationship("User", foreign_keys=[provider_id])
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        Index("idx_structured_records_type_patient", "record_type", "patient_id"),
        Index("idx_structured_records_type_provider", "record_type", "provider_id"),
        Index("idx_structured_records_type_creator", "record_type", "created_by"),
        Index("idx_structured_records_type_created_at", "record_type", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        payload = self.payload if isinstance(self.payload, dict) else {}
        return {
            "id": self.id,
            "record_type": self.record_type,
            "patient_id": self.patient_id,
            "provider_id": self.provider_id,
            "created_by": self.created_by,
            "appointment_id": self.appointment_id,
            "status": self.status or payload.get("status"),
            "payload": payload,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


import sys

sys.modules.setdefault("app.models.structured_record", sys.modules[__name__])
sys.modules.setdefault("backend.app.models.structured_record", sys.modules[__name__])
