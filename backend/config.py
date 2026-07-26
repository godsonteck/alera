from pydantic_settings import BaseSettings, SettingsConfigDict, PydanticBaseSettingsSource
from pydantic import field_validator, Field, model_validator
from typing import List, Tuple, Type, Any
import sys
import os
import json


def infer_environment_default() -> str:
    explicit_environment = os.environ.get("ENVIRONMENT")
    vercel_environment = os.environ.get("VERCEL_ENV")
    if vercel_environment:
        return vercel_environment.strip().lower()

    if explicit_environment:
        return explicit_environment

    if os.environ.get("VERCEL") == "1":
        return "production"

    return "development"


def infer_database_url_default() -> str:
    if os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV"):
        return "sqlite:////tmp/alera.db"
    return "sqlite:///alera.db"


def infer_frontend_url_default() -> str:
    vercel_environment = (os.environ.get("VERCEL_ENV") or "").strip().lower()

    candidate_hosts: list[str | None] = []
    if vercel_environment == "production":
        candidate_hosts.extend(
            [
                os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
                os.environ.get("VERCEL_URL"),
            ]
        )
    elif vercel_environment:
        candidate_hosts.extend(
            [
                os.environ.get("VERCEL_BRANCH_URL"),
                os.environ.get("VERCEL_URL"),
                os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
            ]
        )
    elif os.environ.get("VERCEL") == "1":
        candidate_hosts.extend(
            [
                os.environ.get("VERCEL_URL"),
                os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
            ]
        )

    for host in candidate_hosts:
        normalized_host = (host or "").strip().strip("/")
        if not normalized_host:
            continue
        if normalized_host.startswith(("http://", "https://")):
            return normalized_host.rstrip("/")
        return f"https://{normalized_host}"

    return "http://localhost:5173"


def _normalize_origin(value: str | None) -> str | None:
    normalized = (value or "").strip().rstrip("/")
    if not normalized:
        return None
    if normalized.startswith(("http://", "https://")):
        return normalized
    return f"https://{normalized}"


def _normalize_optional_string(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    return str(value).strip() or None


def _is_local_origin(value: str | None) -> bool:
    normalized = (value or "").strip().lower()
    return normalized.startswith("http://localhost") or normalized.startswith("http://127.0.0.1")


def _vercel_origin_candidates() -> list[str]:
    vercel_environment = (os.environ.get("VERCEL_ENV") or "").strip().lower()
    candidate_hosts: list[str | None] = []

    if vercel_environment == "production":
        candidate_hosts.extend(
            [
                os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
                os.environ.get("VERCEL_BRANCH_URL"),
                os.environ.get("VERCEL_URL"),
            ]
        )
    elif vercel_environment:
        candidate_hosts.extend(
            [
                os.environ.get("VERCEL_BRANCH_URL"),
                os.environ.get("VERCEL_URL"),
                os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
            ]
        )
    elif os.environ.get("VERCEL") == "1":
        candidate_hosts.extend(
            [
                os.environ.get("VERCEL_URL"),
                os.environ.get("VERCEL_BRANCH_URL"),
                os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"),
            ]
        )

    normalized_candidates: list[str] = []
    seen: set[str] = set()
    for host in candidate_hosts:
        normalized = _normalize_origin(host)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        normalized_candidates.append(normalized)

    return normalized_candidates

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = Field(default_factory=infer_database_url_default, description="Database connection URL")
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", description="Redis connection URL")

    # Security - Generate a strong default if not provided
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-me",
        description="Secret key for JWT tokens - MUST be set in production"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = Field(default=True, description="Use secure cookies (HTTPS only) in production")
    JWT_EXPIRE_HOURS: int = 24

    # Bootstrap administrators are opt-in. Never ship default privileged credentials.
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    SUPER_ADMIN_EMAIL: str = ""
    SUPER_ADMIN_PASSWORD: str = ""

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    # Preview origins must be explicitly listed; do not use a wildcard with credentials.
    CORS_ORIGIN_REGEX: str = ""
    EXPOSE_API_DOCS: bool = Field(default=False, description="Expose OpenAPI docs endpoints")

    # Email
    EMAIL_PROVIDER: str = "auto"
    EMAIL_FROM_NAME: str = "ALERA Healthcare"
    EMAIL_FROM_EMAIL: str = "noreply@alera.health"
    EMAIL_TIMEOUT_SECONDS: int = 10
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "noreply@alera.health"
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@alera.health"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    FRONTEND_URL: str = Field(default_factory=infer_frontend_url_default, description="Frontend application base URL")

    # SMS
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Environment
    ENVIRONMENT: str = Field(default_factory=infer_environment_default, description="Environment: development, staging, or production")
    DEBUG: bool = Field(default=False, description="Debug mode flag")

    # OAuth
    GOOGLE_CLIENT_ID: str = ""
    APPLE_CLIENT_ID: str = ""

    # WebRTC
    AGORA_APP_ID: str = ""
    AGORA_APP_CERTIFICATE: str = ""

    # HIPAA
    ENCRYPTION_KEY: str = Field(
        default="dev-encryption-key-change-me",
        description="Encryption key for sensitive data"
    )
    AUDIT_LOG_RETENTION_DAYS: int = 2555

    # Storage
    USE_S3: bool = Field(default=False, description="Use S3-compatible object storage instead of local filesystem")
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = "" # Useful for Cloudflare R2 or MinIO
    S3_PUBLIC_URL_PREFIX: str = "" # For serving through a CDN

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "backend/.env"),
        case_sensitive=True,
        extra="allow",  # Allow extra fields from environment variables
    )

    @field_validator("COOKIE_SECURE", mode="before")
    @classmethod
    def set_cookie_secure(cls, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False
        return infer_environment_default().strip().lower() in {"production", "staging"}

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def normalize_environment(cls, value: Any) -> str:
        normalized = str(value).strip().lower() if value is not None else ""
        vercel_environment = os.environ.get("VERCEL_ENV")
        if vercel_environment:
            normalized_vercel_environment = vercel_environment.strip().lower()
            if normalized_vercel_environment in {"preview", "development"}:
                return normalized_vercel_environment
            if normalized in {"", "development", "preview"}:
                return normalized_vercel_environment
        return normalized or infer_environment_default()

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        if os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV"):
            return (
                init_settings,
                env_settings,
                file_secret_settings,
            )

        return (
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
        )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> List[str]:
        if isinstance(value, list):
            return value
        if value is None:
            return []
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return []
            if normalized.startswith("["):
                parsed = json.loads(normalized)
                if not isinstance(parsed, list):
                    raise ValueError("CORS_ORIGINS JSON must be an array of origins")
                return [str(origin).strip() for origin in parsed if str(origin).strip()]
            return [origin.strip() for origin in normalized.split(",") if origin.strip()]
        raise ValueError("CORS_ORIGINS must be a list or comma-separated string")

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value: Any) -> bool:
        if isinstance(value, bool):
            return value

        if value is None:
            return False

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False

        return bool(value)

    @field_validator("EXPOSE_API_DOCS", mode="before")
    @classmethod
    def parse_docs_flag(cls, value: Any) -> bool:
        if isinstance(value, bool):
            return value

        if value is None:
            return False

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on"}:
                return True
            if normalized in {"0", "false", "no", "off"}:
                return False

        return bool(value)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        if not value or len(value.strip()) < 12:
            raise ValueError("SECRET_KEY must be set to a strong value")
        return value

    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, value: str) -> str:
        if not value or len(value.strip()) < 12:
            raise ValueError("ENCRYPTION_KEY must be set to a strong value")
        return value

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, value: object) -> str:
        normalized = _normalize_optional_string(value)
        if normalized is None:
            fallback = infer_database_url_default()
            if fallback:
                return fallback
            raise ValueError("DATABASE_URL is required")
        return normalized

    @field_validator("FRONTEND_URL", mode="before")
    @classmethod
    def validate_frontend_url(cls, value: object) -> str:
        normalized = _normalize_optional_string(value)
        if normalized is None:
            fallback = infer_frontend_url_default()
            if fallback:
                return fallback.rstrip("/")
            raise ValueError("FRONTEND_URL is required")
        return normalized.rstrip("/")

    @classmethod
    def _is_placeholder_secret(cls, value: str) -> bool:
        return value in {"dev-secret-key-change-me", "dev-encryption-key-change-me"}

    @classmethod
    def _is_sqlite_url(cls, value: str) -> bool:
        return value.startswith("sqlite")

    @classmethod
    def _best_frontend_origin(cls, frontend_url: str, cors_origins: List[str]) -> str:
        explicit_frontend = _normalize_origin(frontend_url)
        if explicit_frontend and not _is_local_origin(explicit_frontend):
            return explicit_frontend

        for vercel_origin in _vercel_origin_candidates():
            if not _is_local_origin(vercel_origin):
                return vercel_origin

        inferred_frontend = _normalize_origin(infer_frontend_url_default())
        if inferred_frontend and not _is_local_origin(inferred_frontend):
            return inferred_frontend

        for origin in cors_origins:
            normalized_origin = _normalize_origin(origin)
            if normalized_origin and not _is_local_origin(normalized_origin):
                return normalized_origin

        # Last resort: use the known production deployment URL for this project
        # when running in a production environment with no other hints.
        known_production_url = _normalize_origin("https://alera-typescript.vercel.app")
        environment = (os.environ.get("ENVIRONMENT") or "").strip().lower()
        if environment == "production" and known_production_url:
            return known_production_url

        return explicit_frontend or inferred_frontend or "http://localhost:5173"

    @model_validator(mode="after")
    def validate_production_requirements(self) -> 'Settings':
        self.FRONTEND_URL = self._best_frontend_origin(self.FRONTEND_URL, self.CORS_ORIGINS)
        normalized_frontend_origin = _normalize_origin(self.FRONTEND_URL)

        if normalized_frontend_origin and normalized_frontend_origin not in {
            _normalize_origin(origin) for origin in self.CORS_ORIGINS if origin
        }:
            self.CORS_ORIGINS = [normalized_frontend_origin, *self.CORS_ORIGINS]

        if self.ENVIRONMENT == "production":
            if self._is_placeholder_secret(self.SECRET_KEY):
                raise ValueError("SECRET_KEY must be explicitly configured in production")
            if self._is_placeholder_secret(self.ENCRYPTION_KEY):
                raise ValueError("ENCRYPTION_KEY must be explicitly configured in production")
            if self._is_sqlite_url(self.DATABASE_URL):
                raise ValueError("Production DATABASE_URL must use a persistent database, not SQLite")
            if self.CORS_ORIGIN_REGEX:
                raise ValueError("CORS_ORIGIN_REGEX must be empty in production; explicitly allowlist trusted origins")
        return self


try:
    settings = Settings()
    print(f"✓ Config loaded: ENV={settings.ENVIRONMENT} DB={settings.DATABASE_URL[:30]}...")
except Exception as e:
    print(f"ERROR: Failed to load config: {e}")
    import traceback
    traceback.print_exc()
    raise

# Keep both import styles pointing at the same module.
sys.modules.setdefault("config", sys.modules[__name__])
sys.modules.setdefault("backend.config", sys.modules[__name__])
