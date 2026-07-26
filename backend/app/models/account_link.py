from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from database import Base
from app.utils.time import utcnow


class AccountLink(Base):
    __tablename__ = "linked_accounts"

    id = Column(Integer, primary_key=True, index=True)
    primary_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    linked_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    link_type = Column(String(50), nullable=False, default="same_person")
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    primary_user = relationship("User", foreign_keys=[primary_user_id], back_populates="primary_account_links")
    linked_user = relationship("User", foreign_keys=[linked_user_id], back_populates="secondary_account_links")

    __table_args__ = (
        UniqueConstraint("primary_user_id", "linked_user_id", name="uq_linked_accounts_pair"),
        Index("idx_linked_accounts_primary_linked", "primary_user_id", "linked_user_id"),
    )

    def __repr__(self):
        return (
            f"<AccountLink(id={self.id}, primary_user_id={self.primary_user_id}, "
            f"linked_user_id={self.linked_user_id}, link_type={self.link_type})>"
        )
