from sqlalchemy import create_engine, event, inspect, text, Enum as SQLEnum
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import NullPool, StaticPool
from config import settings
from app.utils.time import utcnow
from app.utils.db_types import enum_value_renames
from datetime import datetime
from typing import Generator
import sys
import os
import re

database_url = settings.DATABASE_URL

CANONICAL_USER_ROLE_VALUES = {
    "patient",
    "provider",
    "pharmacist",
    "admin",
    "super_admin",
    "hospital",
    "laboratory",
    "imaging",
    "ambulance",
    "physiotherapist",
}

LEGACY_USER_ROLE_ALIASES = {
    "doctor": "provider",
    "pharmacy": "pharmacist",
    "superadmin": "super_admin",
}

AUDIT_STATUS_SEVERITY_MAP = {
    "success": "info",
    "info": "info",
    "created": "info",
    "updated": "info",
    "read": "info",
    "warning": "warning",
    "warn": "warning",
    "error": "critical",
    "failed": "critical",
    "failure": "critical",
    "critical": "critical",
}

# Database engine configuration
engine_kwargs = {
    "echo": settings.DATABASE_ECHO,
    # pool_pre_ping is incompatible with StaticPool (SQLite), added per-dialect below
}

# Use appropriate pool settings based on database type
if database_url.startswith("sqlite"):
    # SQLite: StaticPool is required for in-memory or shared SQLite connections in threads
    # NOTE: pool_pre_ping is NOT compatible with StaticPool
    engine_kwargs["poolclass"] = StaticPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif database_url.startswith("postgresql"):
    # PostgreSQL: For 100k users, we need robust pooling unless we use an external proxy (PgBouncer).
    # pool_pre_ping keeps connections alive and detects stale connections.
    engine_kwargs["pool_pre_ping"] = True
    if os.environ.get("DB_POOL_DISABLED") == "true" or os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV"):
        from sqlalchemy.pool import NullPool
        engine_kwargs["poolclass"] = NullPool
        engine_kwargs.pop("pool_pre_ping", None)  # NullPool doesn't need pre-ping
    else:
        # Default to QueuePool (implicit when poolclass is not set)
        engine_kwargs["pool_size"] = int(os.environ.get("DB_POOL_SIZE", "20"))
        engine_kwargs["max_overflow"] = int(os.environ.get("DB_MAX_OVERFLOW", "10"))
        engine_kwargs["pool_timeout"] = 30
        engine_kwargs["pool_recycle"] = 1800  # 30 mins

    engine_kwargs["connect_args"] = {
        "connect_timeout": max(1, int(os.environ.get("DATABASE_CONNECT_TIMEOUT_SECONDS", "10"))),
    }
else:
    # Default: Use NullPool for safety if unknown, but allow pooling in production
    engine_kwargs["pool_pre_ping"] = True
    if settings.ENVIRONMENT == "production":
        engine_kwargs["pool_size"] = 10

try:
    # Create engine
    engine = create_engine(
        database_url,
        **engine_kwargs,
    )
except Exception as e:
    print(f"ERROR: Failed to create database engine with URL: {database_url[:50]}...")
    print(f"ERROR: {str(e)}")
    # If we are in production and it's a critical failure, we should probably know
    raise

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base model
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Database session generator for dependency injection in FastAPI routes.
    Ensures proper connection cleanup after each request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Event listeners for database connection pooling
@event.listens_for(engine, "connect")
def receive_connect(dbapi_connection, connection_record):
    """Enable foreign key constraints for SQLite"""
    if "sqlite" in str(engine.url):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _patch_referrals_referral_type_column():
    """SQLite: add referral_type if missing (create_all does not ALTER existing tables)."""
    if not str(engine.url).startswith("sqlite"):
        return

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE referrals ADD COLUMN referral_type VARCHAR(32) NOT NULL DEFAULT 'hospital'"
                )
            )
    except Exception:
        pass


def _patch_users_session_version_column():
    """Add session_version to users when upgrading an existing database."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    if "session_version" in columns:
        return

    try:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0")
            )
    except Exception as e:
        print(f"WARNING: Could not patch users.session_version column: {e}")


def _patch_users_account_recovery_columns():
    """Add email verification and password reset columns when upgrading an existing database."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    patches = {
        "email_verified": "BOOLEAN NOT NULL DEFAULT FALSE",
        "email_verified_at": "TIMESTAMP",
        "email_verification_token_hash": "VARCHAR(255)",
        "email_verification_expires_at": "TIMESTAMP",
        "password_reset_token_hash": "VARCHAR(255)",
        "password_reset_expires_at": "TIMESTAMP",
    }

    for column_name, ddl in patches.items():
        if column_name in columns:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch users.{column_name} column: {e}")


def _patch_users_notification_preferences_columns():
    """Add notification preference and privacy fields when upgrading an existing database."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    patches = {
        "notification_email": "BOOLEAN NOT NULL DEFAULT TRUE",
        "notification_sms": "BOOLEAN NOT NULL DEFAULT FALSE",
        "privacy_public_profile": "BOOLEAN NOT NULL DEFAULT FALSE",
    }

    for column_name, ddl in patches.items():
        if column_name in columns:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch users.{column_name} column: {e}")


def _patch_users_live_location_columns():
    """Add live-location tracking columns when upgrading an existing users table."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    patches = {
        "live_location_sharing_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
        "live_latitude": "FLOAT",
        "live_longitude": "FLOAT",
        "live_location_updated_at": "TIMESTAMP",
    }

    for column_name, ddl in patches.items():
        if column_name in columns:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch users.{column_name} column: {e}")


def _patch_users_organization_column():
    """Add organization_id to users when enabling organization-level permissions."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    if "organization_id" in columns:
        return

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN organization_id INTEGER"))
    except Exception as e:
        print(f"WARNING: Could not patch users.organization_id column: {e}")


def _patch_ambulance_request_tracking_columns():
    """Add assignment and richer tracking columns to ambulance requests."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("ambulance_requests")}
    except Exception:
        return

    patches = {
        "assigned_ambulance_id": "INTEGER",
        "accepted_at": "TIMESTAMP",
        "arrived_at": "TIMESTAMP",
    }

    for column_name, ddl in patches.items():
        if column_name in columns:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE ambulance_requests ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch ambulance_requests.{column_name} column: {e}")


def _patch_admin_accounts_email_verified():
    """Backfill seeded/admin accounts so they never get stuck behind email verification."""
    try:
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    required = {
        "role",
        "email_verified",
        "email_verified_at",
        "is_verified",
        "email_verification_token_hash",
        "email_verification_expires_at",
    }
    if not required.issubset(columns):
        return

    try:
        with engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE users
                    SET email_verified = TRUE,
                        email_verified_at = COALESCE(email_verified_at, :now),
                        is_verified = TRUE,
                        email_verification_token_hash = NULL,
                        email_verification_expires_at = NULL
                    WHERE role IN ('admin', 'super_admin')
                    """
                ),
                {"now": utcnow()},
            )
            if result.rowcount:
                print(f"✓ Normalized {result.rowcount} admin account(s) as verified")
    except Exception as e:
        print(f"WARNING: Could not patch admin verification state: {e}")


def _patch_destination_routing_columns():
    """Add destination/provider routing columns introduced after initial launch."""
    patches = {
        "referrals": {
            "destination_provider_id": "INTEGER",
        },
        "lab_tests": {
            "destination_provider_id": "INTEGER",
        },
        "imaging_scans": {
            "destination_provider_id": "INTEGER",
        },
        "prescriptions": {
            "pharmacy_id": "INTEGER",
        },
    }

    for table_name, columns in patches.items():
        try:
            existing = {column["name"] for column in inspect(engine).get_columns(table_name)}
        except Exception:
            continue

        for column_name, ddl in columns.items():
            if column_name in existing:
                continue
            try:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))
            except Exception as e:
                print(f"WARNING: Could not patch {table_name}.{column_name} column: {e}")


def _patch_imaging_result_asset_columns():
    """Add structured imaging report/image metadata columns for uploaded studies."""
    try:
        existing = {column["name"] for column in inspect(engine).get_columns("imaging_scans")}
    except Exception:
        return

    patches = {
        "report_file_id": "VARCHAR(255)",
        "report_filename": "VARCHAR(500)",
        "report_mime_type": "VARCHAR(255)",
        "report_file_size": "INTEGER",
        "image_files": "JSON",
        "postdicom_study_id": "VARCHAR(255)",
        "postdicom_study_url": "VARCHAR(500)",
    }

    for column_name, ddl in patches.items():
        if column_name in existing:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE imaging_scans ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch imaging_scans.{column_name} column: {e}")


def _patch_user_postdicom_columns():
    """Add optional PostDICOM configuration columns for imaging centers."""
    try:
        existing = {column["name"] for column in inspect(engine).get_columns("users")}
    except Exception:
        return

    patches = {
        "postdicom_api_url": "VARCHAR(500)",
        "postdicom_api_key": "VARCHAR(255)",
    }

    for column_name, ddl in patches.items():
        if column_name in existing:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch users.{column_name} column: {e}")


def _patch_audit_log_columns():
    """Add newer audit log fields when upgrading an existing database."""
    try:
        existing = {column["name"] for column in inspect(engine).get_columns("audit_logs")}
    except Exception:
        return

    patches = {
        "role": "VARCHAR(50)",
        "resource": "VARCHAR(255)",
        "status": "VARCHAR(50) NOT NULL DEFAULT 'success'",
        "severity": "VARCHAR(50) NOT NULL DEFAULT 'info'",
        "device_info": "TEXT",
        "metadata_json": "TEXT",
        "request_id": "VARCHAR(64)",
        "request_method": "VARCHAR(16)",
        "request_path": "VARCHAR(255)",
        "duration_ms": "INTEGER",
    }

    for column_name, ddl in patches.items():
        if column_name in existing:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE audit_logs ADD COLUMN {column_name} {ddl}"))
        except Exception as e:
            print(f"WARNING: Could not patch audit_logs.{column_name} column: {e}")


def _normalize_user_role_value(raw_role: str | None) -> str | None:
    if raw_role is None:
        return None

    normalized = re.sub(r"[^a-z0-9]+", "_", raw_role.strip().lower()).strip("_")
    if not normalized:
        return None
    if normalized in CANONICAL_USER_ROLE_VALUES:
        return normalized
    return LEGACY_USER_ROLE_ALIASES.get(normalized)


def _normalize_audit_status(raw_status: str | None) -> str:
    if raw_status is None:
        return "success"

    normalized = raw_status.strip().lower().replace("-", "_")
    if not normalized:
        return "success"
    return normalized


def _normalize_audit_severity(raw_severity: str | None, status: str) -> str:
    if raw_severity is not None:
        normalized = raw_severity.strip().lower()
        if normalized in {"info", "warning", "critical"}:
            return normalized

    return AUDIT_STATUS_SEVERITY_MAP.get(status, "info")


def _backfill_audit_log_defaults():
    """Normalize legacy audit rows so list/detail endpoints can serialize them safely."""
    try:
        existing = {column["name"] for column in inspect(engine).get_columns("audit_logs")}
    except Exception:
        return

    required = {"id", "role", "resource_type", "status", "severity", "created_at"}
    if not required.issubset(existing):
        return

    updated_rows = 0
    try:
        with engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, role, resource_type, status, severity, created_at
                    FROM audit_logs
                    """
                )
            ).fetchall()

            for row in rows:
                row_id, raw_role, raw_resource_type, raw_status, raw_severity, raw_created_at = row
                updates: dict[str, object] = {}

                normalized_role = _normalize_user_role_value(raw_role)
                if normalized_role and normalized_role != raw_role:
                    updates["role"] = normalized_role

                normalized_resource_type = (raw_resource_type or "").strip()
                if not normalized_resource_type:
                    updates["resource_type"] = "system"

                normalized_status = _normalize_audit_status(raw_status)
                if normalized_status != raw_status:
                    updates["status"] = normalized_status

                normalized_severity = _normalize_audit_severity(raw_severity, normalized_status)
                if normalized_severity != raw_severity:
                    updates["severity"] = normalized_severity

                if raw_created_at is None:
                    updates["created_at"] = utcnow()

                if not updates:
                    continue

                assignments = ", ".join(f"{column_name} = :{column_name}" for column_name in updates)
                updates["row_id"] = row_id
                conn.execute(
                    text(f"UPDATE audit_logs SET {assignments} WHERE id = :row_id"),
                    updates,
                )
                updated_rows += 1
    except Exception as e:
        print(f"WARNING: Could not backfill audit log defaults: {e}")
        return

    if updated_rows > 0:
        print(f"✓ Normalized {updated_rows} audit log row(s) for legacy compatibility")


def _collect_sqlalchemy_enum_specs() -> dict[str, list[str]]:
    """Collect the desired persisted labels for every SQLAlchemy enum in metadata."""

    specs: dict[str, list[str]] = {}
    for table in Base.metadata.tables.values():
        for column in table.columns:
            column_type = getattr(column, "type", None)
            if not isinstance(column_type, SQLEnum):
                continue
            if not getattr(column_type, "native_enum", True):
                continue

            type_name = getattr(column_type, "name", None)
            labels = getattr(column_type, "enums", None)
            if not type_name or not labels:
                continue

            specs[type_name] = list(labels)

    return specs


def _missing_postgres_enum_labels(current_labels: list[str], desired_labels: list[str]) -> list[str]:
    """Return desired enum labels that are still missing after rename normalization."""

    current_set = set(current_labels)
    return [label for label in desired_labels if label not in current_set]


def _patch_postgres_enum_values():
    """Normalize legacy PostgreSQL enum labels and append any newly introduced labels."""

    if not str(database_url).startswith("postgresql"):
        return

    # Use raw SQL instead of inspect(engine).get_enums() which was removed in SQLAlchemy 2.x
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT t.typname AS name,
                       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE n.nspname = 'public'
                GROUP BY t.typname
            """))
            enum_specs = result.fetchall()
    except Exception as e:
        print(f"WARNING: Could not inspect PostgreSQL enums: {e}")
        return

    existing_enums = {row[0]: list(row[1]) for row in enum_specs if row[1]}
    desired_enums = _collect_sqlalchemy_enum_specs()

    rename_count = 0
    add_count = 0
    try:
        with engine.begin() as conn:
            for type_name, desired_labels in desired_enums.items():
                current_labels = existing_enums.get(type_name)
                if not current_labels:
                    continue

                for old_label, new_label in enum_value_renames(current_labels, desired_labels):
                    conn.execute(
                        text(f'ALTER TYPE "{type_name}" RENAME VALUE :{"old"} TO :{"new"}'.replace(':old', f"'{old_label}'").replace(':new', f"'{new_label}'"))
                    )
                    rename_count += 1

                rename_map = dict(enum_value_renames(current_labels, desired_labels))
                normalized_labels = [rename_map.get(label, label) for label in current_labels]
                for missing_label in _missing_postgres_enum_labels(normalized_labels, desired_labels):
                    conn.execute(
                        text(f"ALTER TYPE \"{type_name}\" ADD VALUE IF NOT EXISTS '{missing_label}'")
                    )
                    add_count += 1
    except Exception as e:
        print(f"WARNING: Could not normalize PostgreSQL enum values: {e}")
        return

    if rename_count:
        print(f"✓ Normalized {rename_count} PostgreSQL enum label(s)")
    if add_count:
        print(f"✓ Added {add_count} PostgreSQL enum label(s)")


def _patch_userrole_enum_values():
    """Add missing user role enum values and rename uppercase to lowercase for PostgreSQL userrole type."""
    if not str(database_url).startswith("postgresql"):
        # SQLite uses VARCHAR, so no enum alteration needed
        # But we still need to normalize any existing legacy values.
        _normalize_legacy_roles_sqlite()
        return

    try:
        with engine.begin() as conn:
            # Get enum info using raw SQL
            result = conn.execute(text("""
                SELECT n.nspname AS schema_name, t.typname AS type_name, 
                       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE t.typname = 'userrole'
                GROUP BY n.nspname, t.typname
            """))
            enum_info = result.fetchone()
            
            if enum_info:
                schema_name, type_name, labels = enum_info
                print(f"DEBUG: Found userrole enum in schema {schema_name} with labels: {labels}")
                
                # Convert labels to list if it's an array
                if hasattr(labels, '__iter__') and not isinstance(labels, str):
                    labels = list(labels)
                else:
                    labels = [labels] if labels else []
                
                normalized_labels = list(labels)
                normalized_label_set = set(normalized_labels)
                renamed_labels = 0
                updated_rows = 0

                for old_label in list(labels):
                    new_label = _normalize_user_role_value(old_label)
                    if not new_label or old_label == new_label:
                        continue

                    if new_label not in normalized_label_set:
                        try:
                            conn.execute(
                                text(f"ALTER TYPE {schema_name}.userrole RENAME VALUE '{old_label}' TO '{new_label}'")
                            )
                            normalized_label_set.discard(old_label)
                            normalized_label_set.add(new_label)
                            normalized_labels = [new_label if label == old_label else label for label in normalized_labels]
                            renamed_labels += 1
                            print(f"DEBUG: Renamed enum value {old_label} to {new_label}")
                            continue
                        except Exception as e:
                            print(f"WARNING: Could not rename {old_label} to {new_label}: {e}")

                    try:
                        result = conn.execute(
                            text("UPDATE users SET role = :new_role WHERE role = :old_role"),
                            {"new_role": new_label, "old_role": old_label},
                        )
                        if result.rowcount:
                            updated_rows += result.rowcount
                            print(f"DEBUG: Updated {result.rowcount} users from {old_label} to {new_label}")
                    except Exception as e:
                        print(f"WARNING: Could not update role {old_label} to {new_label}: {e}")

                if renamed_labels > 0:
                    print(f"✓ Normalized {renamed_labels} PostgreSQL userrole enum label(s)")
                if updated_rows > 0:
                    print(f"✓ Rewrote {updated_rows} user row(s) to canonical role values")

                missing_values = [
                    value for value in CANONICAL_USER_ROLE_VALUES
                    if value not in normalized_label_set
                ]
                for value in missing_values:
                    try:
                        conn.execute(text(f"ALTER TYPE {schema_name}.userrole ADD VALUE IF NOT EXISTS '{value}'"))
                        print(f"DEBUG: Added {value} to userrole enum")
                    except Exception as e:
                        print(f"WARNING: Could not add {value} to userrole enum: {e}")

                if missing_values:
                    print(f"✓ Added {', '.join(sorted(missing_values))} to PostgreSQL userrole enum")
            else:
                print("WARNING: userrole enum not found in database via raw SQL")
                
    except Exception as e:
        print(f"WARNING: Could not patch userrole enum values: {e}")
        import traceback
        print(f"DEBUG: Exception traceback: {traceback.format_exc()}")


def _normalize_legacy_roles_sqlite():
    """Normalize legacy SQLite role values to the backend's canonical enum values."""
    if not str(database_url).startswith("sqlite"):
        return

    try:
        with engine.begin() as conn:
            # Check if users table exists
            try:
                result = conn.execute(text("SELECT 1 FROM users LIMIT 1"))
                result.fetchone()
            except Exception:
                # Table doesn't exist yet
                return
            
            update_count = 0
            rows = conn.execute(text("SELECT id, role FROM users WHERE role IS NOT NULL")).fetchall()
            for row in rows:
                user_id = row[0]
                raw_role = row[1]
                new_role = _normalize_user_role_value(raw_role)
                if not new_role or raw_role == new_role:
                    continue

                result = conn.execute(
                    text("UPDATE users SET role = :new_role WHERE id = :user_id"),
                    {"new_role": new_role, "user_id": user_id},
                )
                if result.rowcount > 0:
                    print(f"DEBUG: Updated user {user_id} role from {raw_role} to {new_role}")
                    update_count += result.rowcount
            
            if update_count > 0:
                print(f"✓ Normalized {update_count} SQLite user role value(s)")
    except Exception as e:
        print(f"WARNING: Could not normalize legacy roles in SQLite: {e}")


def run_migrations():
    """Run Alembic migrations programmatically."""
    from alembic.config import Config
    from alembic import command
    import os

    # Path to alembic.ini relative to this file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ini_path = os.path.join(base_dir, "alembic.ini")
    
    cfg = Config(ini_path)
    # Ensure the script location is correct if we're running from a different CWD
    cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))
    
    try:
        command.upgrade(cfg, "head")
        print("✓ Database migrations applied successfully")
    except Exception as e:
        print(f"WARNING: Could not apply database migrations: {e}")

def init_db():
    """Initialize database - create all tables and seed default admin"""
    try:
        import app.models  # noqa: F401

        # On non-SQLite production/serverless, bypass legacy patches to prevent concurrent deadlocks
        is_serverless = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
        is_production = settings.ENVIRONMENT == "production"
        is_sqlite = str(engine.url).startswith("sqlite")

        # Always ensure schema tables exist (idempotent IF NOT EXISTS)
        Base.metadata.create_all(bind=engine)

        if is_serverless or (is_production and not is_sqlite):
            print("✓ Database tables verified (bypassing legacy DDL migration patches under serverless environment)")
        else:
            # 2. Legacy create_all and DDL patches for local dev
            run_migrations()
            _patch_referrals_referral_type_column()
            _patch_users_session_version_column()
            _patch_users_account_recovery_columns()
            _patch_users_notification_preferences_columns()
            _patch_users_live_location_columns()
            _patch_users_organization_column()
            _patch_ambulance_request_tracking_columns()
            _patch_destination_routing_columns()
            _patch_imaging_result_asset_columns()
            _patch_user_postdicom_columns()
            _patch_audit_log_columns()
            _backfill_audit_log_defaults()
            _patch_userrole_enum_values()
            _patch_postgres_enum_values()
            _patch_admin_accounts_email_verified()
            print("✓ Database tables initialized successfully")
    except Exception as e:
        print(f"ERROR: Failed to initialize database tables: {e}")
        raise

    # Seed default admin account on every startup (idempotent)
    try:
        _seed_admin()
    except Exception as e:
        print(f"WARNING: Failed to seed admin user: {e}")


def _production_seed_credentials_are_configured() -> bool:
    required_keys = (
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "SUPER_ADMIN_EMAIL",
        "SUPER_ADMIN_PASSWORD",
    )
    return all(bool(getattr(settings, key, "").strip()) for key in required_keys)


def _should_seed_default_admin_accounts() -> bool:
    if _production_seed_credentials_are_configured():
        return True

    print("WARNING: Skipping administrator bootstrap because explicit credentials are not configured")
    return False


def _seed_admin():
    """Create the default admin and super_admin users if they don't exist yet."""
    from app.models.user import User, UserRole
    from app.utils.auth import hash_password

    if not _should_seed_default_admin_accounts():
        return

    db = SessionLocal()
    try:
        # ── regular admin ──────────────────────────────────────────────────
        admin_email = settings.ADMIN_EMAIL
        admin_password = settings.ADMIN_PASSWORD

        if not db.query(User).filter(User.email == admin_email).first():
            admin = User(
                email=admin_email,
                username="admin",
                hashed_password=hash_password(admin_password),
                first_name="Alera",
                last_name="Admin",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                email_verified=True,
                email_verified_at=utcnow(),
                session_version=0,
                notification_email=True,
                notification_sms=False,
                privacy_public_profile=False,
            )
            db.add(admin)
            db.flush()
            print(f"✓ Default admin seeded: {admin_email}")

        # ── super admin ────────────────────────────────────────────────────
        super_email = settings.SUPER_ADMIN_EMAIL
        super_password = settings.SUPER_ADMIN_PASSWORD

        if not db.query(User).filter(User.email == super_email).first():
            super_admin = User(
                email=super_email,
                username="superadmin",
                hashed_password=hash_password(super_password),
                first_name="Alera",
                last_name="SuperAdmin",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
                email_verified=True,
                email_verified_at=utcnow(),
                session_version=0,
                notification_email=True,
                notification_sms=False,
                privacy_public_profile=False,
            )
            db.add(super_admin)
            db.flush()
            print(f"✓ Default super admin seeded: {super_email}")

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"WARNING: Could not seed admin: {e}")
    finally:
        db.close()


# Keep both import styles pointing at the same module.
sys.modules.setdefault("database", sys.modules[__name__])
sys.modules.setdefault("backend.database", sys.modules[__name__])
