from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from database import Base
from app.utils.time import utcnow


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(String(128), primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    parent_record_id = Column(String(128), ForeignKey("medical_records.id"), nullable=True, index=True)
    record_type = Column(String(64), nullable=False, index=True)
    category = Column(String(64), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String(64), nullable=True, index=True)
    event_time = Column(DateTime, default=utcnow, nullable=False, index=True)
    source_system = Column(String(120), nullable=False, default="alera", index=True)
    source_record_id = Column(String(255), nullable=True, index=True)
    source_version = Column(String(64), nullable=True)
    is_external = Column(Boolean, default=False, nullable=False, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    sync_status = Column(String(32), nullable=False, default="synced", index=True)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    patient = relationship("User", foreign_keys=[patient_id])
    provider = relationship("User", foreign_keys=[provider_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    parent_record = relationship("MedicalRecord", remote_side=[id], foreign_keys=[parent_record_id])
    documents = relationship("MedicalDocument", back_populates="medical_record", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_medical_record_patient_event", "patient_id", "event_time"),
        Index("idx_medical_record_patient_type", "patient_id", "record_type"),
        Index("idx_medical_record_source_unique", "source_system", "source_record_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "organization_id": self.organization_id,
            "provider_id": self.provider_id,
            "parent_record_id": self.parent_record_id,
            "record_type": self.record_type,
            "category": self.category,
            "title": self.title,
            "summary": self.summary,
            "status": self.status,
            "event_time": self.event_time.isoformat() if self.event_time else None,
            "source_system": self.source_system,
            "source_record_id": self.source_record_id,
            "source_version": self.source_version,
            "is_external": self.is_external,
            "is_deleted": self.is_deleted,
            "sync_status": self.sync_status,
            "payload": self.payload or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id = Column(String(128), primary_key=True, index=True)
    medical_record_id = Column(String(128), ForeignKey("medical_records.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    file_id = Column(String(255), nullable=False, unique=True, index=True)
    filename = Column(String(500), nullable=False)
    mime_type = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    document_type = Column(String(64), nullable=False, index=True)
    storage_subpath = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    is_external = Column(Boolean, default=False, nullable=False, index=True)
    source_system = Column(String(120), nullable=False, default="alera")
    source_document_id = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    medical_record = relationship("MedicalRecord", back_populates="documents")
    patient = relationship("User", foreign_keys=[patient_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])

    __table_args__ = (
        Index("idx_medical_document_patient_record", "patient_id", "medical_record_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "medical_record_id": self.medical_record_id,
            "patient_id": self.patient_id,
            "organization_id": self.organization_id,
            "uploaded_by": self.uploaded_by,
            "file_id": self.file_id,
            "filename": self.filename,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "document_type": self.document_type,
            "storage_subpath": self.storage_subpath,
            "description": self.description,
            "is_external": self.is_external,
            "source_system": self.source_system,
            "source_document_id": self.source_document_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PatientPermission(Base):
    __tablename__ = "patient_permissions"

    id = Column(String(128), primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    revoked_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    scope = Column(JSON, nullable=False, default=list)
    status = Column(String(32), nullable=False, default="requested", index=True)
    reason = Column(Text, nullable=True)
    requested_at = Column(DateTime, default=utcnow, nullable=False)
    granted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    patient = relationship("User", foreign_keys=[patient_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    requester = relationship("User", foreign_keys=[requested_by])
    granter = relationship("User", foreign_keys=[granted_by])
    revoker = relationship("User", foreign_keys=[revoked_by])

    __table_args__ = (
        Index("idx_patient_permission_patient_org", "patient_id", "organization_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "organization_id": self.organization_id,
            "requested_by": self.requested_by,
            "granted_by": self.granted_by,
            "revoked_by": self.revoked_by,
            "scope": self.scope or [],
            "status": self.status,
            "reason": self.reason,
            "requested_at": self.requested_at.isoformat() if self.requested_at else None,
            "granted_at": self.granted_at.isoformat() if self.granted_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
