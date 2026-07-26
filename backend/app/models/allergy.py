from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from app.utils.time import utcnow


class Allergy(Base):
    __tablename__ = "allergies"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationship
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Allergy Details
    allergen = Column(String(255), nullable=False)
    allergen_type = Column(String(100), nullable=False)  # medication, food, environmental, etc.
    
    # Reaction
    reaction_description = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False)  # mild, moderate, severe
    
    # Details
    onset_date = Column(DateTime, nullable=True)
    reaction_onset = Column(String(100), nullable=True)  # immediate, delayed, etc.
    confirmed = Column(String(1), default="Y", nullable=False)  # Y/N
    
    # Treatment
    treatment = Column(Text, nullable=True)
    medication_avoided = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    
    # Relationship
    patient = relationship("User", back_populates="allergies")
    
    # Indexes
    __table_args__ = (
        Index('idx_allergy_patient_id', 'patient_id'),
        Index('idx_allergy_allergen', 'allergen'),
        Index('idx_allergy_severity', 'severity'),
    )

    def __repr__(self):
        return f"<Allergy(id={self.id}, patient_id={self.patient_id}, allergen={self.allergen})>"
