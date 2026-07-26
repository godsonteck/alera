"""
Lab test and imaging scan database models
"""

from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import sys
from database import Base
from app.utils.db_types import enum_values
from app.utils.time import utcnow


class LabTestStatus(str, enum.Enum):
    ORDERED = "ordered"
    SAMPLE_COLLECTED = "sample_collected"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ImagingScanStatus(str, enum.Enum):
    ORDERED = "ordered"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class LabTest(Base):
    __tablename__ = "lab_tests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ordered_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # doctor
    destination_provider_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # lab facility
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # lab user

    test_name = Column(String, nullable=False)
    test_code = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(LabTestStatus, values_callable=enum_values), default=LabTestStatus.ORDERED)

    # Results
    result_value = Column(String, nullable=True)
    result_unit = Column(String, nullable=True)
    reference_range = Column(String, nullable=True)
    result_notes = Column(Text, nullable=True)
    result_file_url = Column(String, nullable=True)

    ordered_at = Column(DateTime, default=utcnow)
    collected_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[ordered_by])
    destination_provider = relationship("User", foreign_keys=[destination_provider_id])
    lab_user = relationship("User", foreign_keys=[processed_by])

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "ordered_by": self.ordered_by,
            "destination_provider_id": self.destination_provider_id,
            "processed_by": self.processed_by,
            "test_name": self.test_name,
            "test_code": self.test_code,
            "description": self.description,
            "status": self.status.value if self.status else None,
            "result_value": self.result_value,
            "result_unit": self.result_unit,
            "reference_range": self.reference_range,
            "result_notes": self.result_notes,
            "result_file_url": self.result_file_url,
            "ordered_at": self.ordered_at.isoformat() if self.ordered_at else None,
            "collected_at": self.collected_at.isoformat() if self.collected_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ImagingScan(Base):
    __tablename__ = "imaging_scans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ordered_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    destination_provider_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    scan_type = Column(String, nullable=False)  # X-Ray, MRI, CT, Ultrasound
    body_part = Column(String, nullable=True)
    clinical_indication = Column(Text, nullable=True)
    status = Column(SQLEnum(ImagingScanStatus, values_callable=enum_values), default=ImagingScanStatus.ORDERED)

    # Results
    findings = Column(Text, nullable=True)
    impression = Column(Text, nullable=True)
    report_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    report_file_id = Column(String, nullable=True)
    report_filename = Column(String, nullable=True)
    report_mime_type = Column(String, nullable=True)
    report_file_size = Column(Integer, nullable=True)
    image_files = Column(JSON, nullable=True)
    postdicom_study_id = Column(String(255), nullable=True)
    postdicom_study_url = Column(String(500), nullable=True)

    scheduled_at = Column(DateTime, nullable=True)
    ordered_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[ordered_by])
    destination_provider = relationship("User", foreign_keys=[destination_provider_id])
    imaging_user = relationship("User", foreign_keys=[processed_by])

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "ordered_by": self.ordered_by,
            "destination_provider_id": self.destination_provider_id,
            "processed_by": self.processed_by,
            "scan_type": self.scan_type,
            "body_part": self.body_part,
            "clinical_indication": self.clinical_indication,
            "status": self.status.value if self.status else None,
            "findings": self.findings,
            "impression": self.impression,
            "report_url": self.report_url,
            "image_url": self.image_url,
            "report_file_id": self.report_file_id,
            "report_filename": self.report_filename,
            "report_mime_type": self.report_mime_type,
            "report_file_size": self.report_file_size,
            "image_files": self.image_files or [],
            "postdicom_study_id": self.postdicom_study_id,
            "postdicom_study_url": self.postdicom_study_url,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "ordered_at": self.ordered_at.isoformat() if self.ordered_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


sys.modules.setdefault("app.models.lab_imaging", sys.modules[__name__])
sys.modules.setdefault("backend.app.models.lab_imaging", sys.modules[__name__])
