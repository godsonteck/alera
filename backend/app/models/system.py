from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from database import Base
from app.utils.time import utcnow


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Maintenance Mode
    is_maintenance_mode = Column(Boolean, default=False, nullable=False)
    maintenance_message = Column(Text, default="ALERA is currently undergoing scheduled maintenance. Please check back later.", nullable=False)
    
    # Global Notification Banner
    notification_banner_active = Column(Boolean, default=False, nullable=False)
    notification_banner_message = Column(String(500), default="", nullable=False)
    notification_banner_type = Column(String(50), default="info", nullable=False) # info, warning, success
    
    # Audit
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    updated_by_id = Column(Integer, nullable=True) # ID of the admin who last updated

    def __repr__(self):
        return f"<SystemSettings(is_maintenance={self.is_maintenance_mode})>"
