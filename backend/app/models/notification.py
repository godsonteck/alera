from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from app.utils.time import utcnow


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    
    # Relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Notification Details
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)  # appointment, prescription, message, alert
    
    # Content
    related_id = Column(Integer, nullable=True)  # ID of related resource (appointment, prescription, etc.)
    related_type = Column(String(50), nullable=True)  # Type of related resource
    action_url = Column(String(500), nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    
    # Delivery
    email_sent = Column(Boolean, default=False)
    sms_sent = Column(Boolean, default=False)
    push_sent = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)
    scheduled_for = Column(DateTime, nullable=True)
    
    # Relationship
    user = relationship("User", back_populates="notifications")
    
    # Indexes
    __table_args__ = (
        Index('idx_notification_user_id', 'user_id'),
        Index('idx_notification_is_read', 'is_read'),
        Index('idx_notification_created_at', 'created_at'),
        Index('idx_notification_type', 'notification_type'),
    )

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.notification_type})>"
