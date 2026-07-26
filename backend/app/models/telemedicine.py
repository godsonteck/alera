from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from app.utils.time import utcnow


class VideoCall(Base):
    __tablename__ = "video_calls"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationships
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Call Details
    appointment_id = Column(Integer, nullable=True)  # Related appointment if any
    call_token = Column(String(255), unique=True, nullable=False)
    
    # Status
    status = Column(String(50), default="initiated", nullable=False)  # initiated, ringing, connected, ended, failed
    
    # WebRTC/Agora
    channel_name = Column(String(255), nullable=False)
    agora_uid = Column(Integer, nullable=True)
    
    # Timing
    initiated_at = Column(DateTime, default=utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    
    # Call Quality
    duration_seconds = Column(Integer, nullable=True)
    call_quality = Column(String(50), nullable=True)  # good, fair, poor
    
    # Recording
    is_recorded = Column(String(1), default="N", nullable=False)
    recording_url = Column(String(500), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    reason_for_call = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    
    # Relationships
    patient = relationship("User", foreign_keys=[patient_id])
    provider = relationship("User", foreign_keys=[provider_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_video_call_patient_id', 'patient_id'),
        Index('idx_video_call_provider_id', 'provider_id'),
        Index('idx_video_call_status', 'status'),
        Index('idx_video_call_initiated_at', 'initiated_at'),
    )

    def __repr__(self):
        return f"<VideoCall(id={self.id}, patient_id={self.patient_id}, provider_id={self.provider_id})>"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationships
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Message Content
    content = Column(Text, nullable=False)
    subject = Column(String(255), nullable=True)
    
    # Status
    is_read = Column(String(1), default="N", nullable=False)
    is_archived = Column(String(1), default="N", nullable=False)
    
    # Attachments
    attachment_url = Column(String(500), nullable=True)
    attachment_type = Column(String(50), nullable=True)  # document, image, etc.
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_message_sender_id', 'sender_id'),
        Index('idx_message_recipient_id', 'recipient_id'),
        Index('idx_message_is_read', 'is_read'),
        Index('idx_message_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<Message(id={self.id}, sender_id={self.sender_id}, recipient_id={self.recipient_id})>"
