from sqlalchemy import Integer, String, Enum as SQLEnum, DateTime, Boolean, Text, Index, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum
from database import Base
from app.utils.db_types import enum_values
from app.utils.time import utcnow


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    PROVIDER = "provider"  # Doctor
    PHARMACIST = "pharmacist"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    HOSPITAL = "hospital"
    LABORATORY = "laboratory"
    IMAGING = "imaging"
    AMBULANCE = "ambulance"
    PHYSIOTHERAPIST = "physiotherapist"

    def __str__(self) -> str:
        return self.value


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile Information
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Account Information
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole, values_callable=enum_values), default=UserRole.PATIENT, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    session_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    postdicom_api_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    postdicom_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notification_sms: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    privacy_public_profile: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    live_location_sharing_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    live_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    live_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    live_location_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Account recovery / verification
    email_verification_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    password_reset_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # License Information (for providers)
    license_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    specialty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    appointments_as_patient = relationship("Appointment", foreign_keys="Appointment.patient_id", back_populates="patient")
    appointments_as_provider = relationship("Appointment", foreign_keys="Appointment.provider_id", back_populates="provider")
    prescriptions_as_patient = relationship("Prescription", foreign_keys="Prescription.patient_id", back_populates="patient")
    prescriptions_as_provider = relationship("Prescription", foreign_keys="Prescription.provider_id", back_populates="provider")
    allergies = relationship("Allergy", back_populates="patient")
    medical_histories = relationship("MedicalHistory", back_populates="patient")
    notifications = relationship("Notification", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    organization = relationship("Organization", back_populates="members", foreign_keys=[organization_id])
    primary_account_links = relationship(
        "AccountLink",
        foreign_keys="AccountLink.primary_user_id",
        back_populates="primary_user",
        cascade="all, delete-orphan",
    )
    secondary_account_links = relationship(
        "AccountLink",
        foreign_keys="AccountLink.linked_user_id",
        back_populates="linked_user",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
        Index('idx_user_role', 'role'),
        Index('idx_user_created_at', 'created_at'),
        Index('idx_user_is_active', 'is_active'),
        Index('idx_user_is_verified', 'is_verified'),
    )

    def is_admin_or_super(self) -> bool:
        """Returns True if this user has any admin-level role."""
        return self.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)

    def is_super_admin(self) -> bool:
        """Returns True only for super admin."""
        return self.role == UserRole.SUPER_ADMIN

    @staticmethod
    def _mask_email(email: str | None) -> str | None:
        if not email or "@" not in email:
            return email
        local_part, domain = email.split("@", 1)
        if len(local_part) <= 2:
            masked_local = f"{local_part[0]}*" if local_part else "*"
        else:
            masked_local = f"{local_part[:2]}{'*' * max(2, len(local_part) - 2)}"
        return f"{masked_local}@{domain}"

    @property
    def linked_accounts(self) -> list[dict[str, str | int | None]]:
        account_summaries: list[dict[str, str | int | None]] = []
        seen_user_ids: set[int] = set()

        for relation in [*self.primary_account_links, *self.secondary_account_links]:
            other_user = relation.linked_user if relation.primary_user_id == self.id else relation.primary_user
            if other_user is None or other_user.id in seen_user_ids:
                continue
            seen_user_ids.add(other_user.id)
            account_summaries.append(
                {
                    "id": other_user.id,
                    "role": other_user.role.value if hasattr(other_user.role, "value") else str(other_user.role),
                    "masked_email": self._mask_email(other_user.email),
                    "created_at": relation.created_at.isoformat() if relation.created_at is not None else None,
                    "link_type": relation.link_type,
                }
            )

        return account_summaries

    @property
    def has_linked_account(self) -> bool:
        return bool(self.primary_account_links or self.secondary_account_links)

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
