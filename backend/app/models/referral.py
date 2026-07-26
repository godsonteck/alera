"""Referrals — clinically distinct queues: specialist/hospital, laboratory, imaging, pharmacy."""

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.utils.time import utcnow

from database import Base

# Values must match API / frontend ReferralType
REFERRAL_TYPE_HOSPITAL = "hospital"
REFERRAL_TYPE_LABORATORY = "laboratory"
REFERRAL_TYPE_IMAGING = "imaging"
REFERRAL_TYPE_PHARMACY = "pharmacy"


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    from_doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    referral_type: Mapped[str] = mapped_column(String(32), nullable=False, default=REFERRAL_TYPE_HOSPITAL, index=True)
    destination_provider_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    to_department: Mapped[str] = mapped_column(String(255), nullable=False)
    to_department_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id])
    from_doctor: Mapped["User"] = relationship("User", foreign_keys=[from_doctor_id])
    destination_provider: Mapped["User | None"] = relationship("User", foreign_keys=[destination_provider_id])

    __table_args__ = (
        Index("idx_referral_patient", "patient_id"),
        Index("idx_referral_doctor", "from_doctor_id"),
        Index("idx_referral_destination_provider", "destination_provider_id"),
        Index("idx_referral_status", "status"),
        Index("idx_referral_type", "referral_type"),
    )
