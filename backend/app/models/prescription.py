from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from app.utils.time import utcnow


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationships
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pharmacy_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Prescription Details
    medication_name = Column(String(255), nullable=False)
    medication_code = Column(String(50), nullable=True)  # NDC code
    dosage = Column(String(100), nullable=False)
    dosage_unit = Column(String(50), nullable=False)  # mg, ml, tablet, etc.
    
    # Instructions
    frequency = Column(String(100), nullable=False)  # Once daily, Twice daily, etc.
    route = Column(String(50), nullable=False)  # oral, injection, topical, etc.
    instructions = Column(Text, nullable=True)
    
    # Duration
    quantity = Column(Integer, nullable=True)
    refills = Column(Integer, default=0, nullable=False)
    refills_remaining = Column(Integer, default=0, nullable=False)
    
    # Dates
    prescribed_date = Column(DateTime, default=utcnow, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    
    # Status & Notes
    status = Column(String(50), default="active", nullable=False)  # active, discontinued, expired
    reason = Column(String(500), nullable=True)
    pharmacy_notes = Column(Text, nullable=True)
    
    # Drug Interactions
    checked_for_interactions = Column(String(1), default="N", nullable=False)
    interaction_warnings = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    
    # Relationships
    patient = relationship("User", foreign_keys=[patient_id], back_populates="prescriptions_as_patient")
    provider = relationship("User", foreign_keys=[provider_id], back_populates="prescriptions_as_provider")
    pharmacy = relationship("User", foreign_keys=[pharmacy_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_prescription_patient_id', 'patient_id'),
        Index('idx_prescription_provider_id', 'provider_id'),
        Index('idx_prescription_pharmacy_id', 'pharmacy_id'),
        Index('idx_prescription_status', 'status'),
        Index('idx_prescription_start_date', 'start_date'),
    )

    def __repr__(self):
        return f"<Prescription(id={self.id}, patient_id={self.patient_id}, medication={self.medication_name})>"
