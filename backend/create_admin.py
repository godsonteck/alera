import os
import argparse
import getpass
import sys
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal, init_db
from app.models.user import User, UserRole
from app.utils.auth import hash_password, validate_password_strength

def create_admin(email: str, password: str):
    # Ensure tables exist
    init_db()
    
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == email).first()
        
        if existing_admin:
            print(f"Admin user already exists with email: {email}")
            return

        # Create the admin user
        validate_password_strength(password)
        print("Creating super-admin user...")
        admin = User(
            email=email,
            username=email.split("@", 1)[0],
            hashed_password=hash_password(password),
            first_name="Alera",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
            email_verified=True
        )
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print("✅ Default admin user successfully created!")
        print("--------------------------------------------------")
        print(f"Email:    {admin.email}")
        print("Credentials were supplied securely and are not echoed.")

    except Exception as e:
        print(f"Error creating admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create an Alera super-admin account")
    parser.add_argument("--email", default=os.environ.get("SUPER_ADMIN_EMAIL"), help="Administrator email address")
    parser.add_argument("--prompt-password", action="store_true", help="Prompt for a password instead of using SUPER_ADMIN_PASSWORD")
    args = parser.parse_args()
    if not args.email:
        parser.error("--email is required (or set SUPER_ADMIN_EMAIL)")
    password = "" if args.prompt_password else os.environ.get("SUPER_ADMIN_PASSWORD", "")
    if not password:
        password = getpass.getpass("Super-admin password: ")
    if not password:
        parser.error("a password is required")
    create_admin(args.email.strip().lower(), password)
