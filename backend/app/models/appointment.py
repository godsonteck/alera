from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base
from app.utils.db_types import enum_values
from app.utils.time import utcnow


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class AppointmentType(str, enum.Enum):
    IN_PERSON = "in_person"
    TELEHEALTH = "telehealth"
    PHONE = "phone"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationships
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Appointment Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    appointment_type = Column(SQLEnum(AppointmentType, values_callable=enum_values), default=AppointmentType.TELEHEALTH, nullable=False)
    status = Column(SQLEnum(AppointmentStatus, values_callable=enum_values), default=AppointmentStatus.SCHEDULED, nullable=False)
    
    # Date/Time
    scheduled_time = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, default=30, nullable=False)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    
    # Location (for in-person)
    location = Column(String(500), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    
    # Relationships
    patient = relationship("User", foreign_keys=[patient_id], back_populates="appointments_as_patient")
    provider = relationship("User", foreign_keys=[provider_id], back_populates="appointments_as_provider")
    
    # Indexes
    __table_args__ = (
        Index('idx_appointment_patient_id', 'patient_id'),
        Index('idx_appointment_provider_id', 'provider_id'),
        Index('idx_appointment_status', 'status'),
        Index('idx_appointment_scheduled_time', 'scheduled_time'),
    )

    def __repr__(self):
        return f"<Appointment(id={self.id}, patient_id={self.patient_id}, provider_id={self.provider_id})>"
