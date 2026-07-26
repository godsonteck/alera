from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from app.utils.time import utcnow


class MedicalHistory(Base):
    __tablename__ = "medical_history"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationship
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Condition
    condition_name = Column(String(255), nullable=False)
    icd_code = Column(String(20), nullable=True)  # ICD-10 code
    
    # Details
    description = Column(Text, nullable=False)
    onset_date = Column(DateTime, nullable=True)
    resolution_date = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String(50), default="active", nullable=False)  # active, inactive, resolved
    severity = Column(String(50), nullable=True)  # mild, moderate, severe
    
    # Treatment
    treatment = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    
    # Relationship
    patient = relationship("User", back_populates="medical_histories")
    
    # Indexes
    __table_args__ = (
        Index('idx_medical_history_patient_id', 'patient_id'),
        Index('idx_medical_history_condition', 'condition_name'),
        Index('idx_medical_history_status', 'status'),
    )

    def __repr__(self):
        return f"<MedicalHistory(id={self.id}, patient_id={self.patient_id}, condition={self.condition_name})>"
