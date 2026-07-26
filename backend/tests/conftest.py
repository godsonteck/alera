import os
import sys
from pathlib import Path
from datetime import datetime

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ADMIN_EMAIL", "admin@alera.health")
os.environ.setdefault("ADMIN_PASSWORD", "admin_alera_2026!")

import database  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.utils.time import utcnow  # noqa: E402
from database import Base, SessionLocal, engine  # noqa: E402


ADMIN_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MgbgnJPyvteaE+L8v5cS4g$VBM/CZaZX34GJGv5NjCI4oQQYqFf/BSbAoqGW4nVjRc"


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        admin = User(
            email=os.environ["ADMIN_EMAIL"],
            username="admin",
            hashed_password=ADMIN_PASSWORD_HASH,
            first_name="Alera",
            last_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            email_verified=True,
            email_verified_at=utcnow(),
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
