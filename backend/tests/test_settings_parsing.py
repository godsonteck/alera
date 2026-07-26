from backend.config import Settings


def test_settings_accept_comma_separated_cors_origins():
    settings = Settings(
        DATABASE_URL="sqlite:///test.db",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        FRONTEND_URL="https://example.com/",
        CORS_ORIGINS="https://one.example.com, https://two.example.com",
        ENVIRONMENT="development",
    )

    assert settings.CORS_ORIGINS == [
        "https://example.com",
        "https://one.example.com",
        "https://two.example.com",
    ]
    assert settings.FRONTEND_URL == "https://example.com"


def test_settings_infer_vercel_preview_environment(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.setenv("VERCEL_ENV", "preview")
    monkeypatch.setenv("VERCEL_BRANCH_URL", "preview-branch.vercel.app")

    settings = Settings(
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS="https://preview.example.com",
    )

    assert settings.ENVIRONMENT == "preview"
    assert settings.DATABASE_URL == "sqlite:////tmp/alera.db"
    assert settings.FRONTEND_URL == "https://preview-branch.vercel.app"


def test_settings_ignore_development_override_on_vercel(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("VERCEL_ENV", "production")

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        FRONTEND_URL="https://prod.example.com",
        CORS_ORIGINS="https://prod.example.com",
    )

    assert settings.ENVIRONMENT == "production"


def test_settings_do_not_force_preview_deployments_into_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.setenv("VERCEL_ENV", "preview")
    monkeypatch.setenv("VERCEL_BRANCH_URL", "preview-branch.vercel.app")

    settings = Settings(
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS="https://preview.example.com",
    )

    assert settings.ENVIRONMENT == "preview"
    assert settings.DATABASE_URL == "sqlite:////tmp/alera.db"
    assert settings.FRONTEND_URL == "https://preview-branch.vercel.app"


def test_settings_infer_vercel_production_frontend_url(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "alera.health")

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS="https://alera.health",
    )

    assert settings.ENVIRONMENT == "production"
    assert settings.FRONTEND_URL == "https://alera.health"


def test_settings_can_recover_frontend_origin_from_cors_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS='["https://alera.health"]',
    )

    assert settings.FRONTEND_URL == "https://alera.health"


def test_settings_can_recover_frontend_origin_from_default_cors_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("VERCEL_URL", raising=False)
    monkeypatch.delenv("VERCEL_PROJECT_PRODUCTION_URL", raising=False)
    monkeypatch.delenv("VERCEL_BRANCH_URL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
    )

    assert settings.FRONTEND_URL == "https://alera-typescript.vercel.app"
    assert "https://alera-typescript.vercel.app" in settings.CORS_ORIGINS


def test_settings_infer_frontend_from_vercel_url_when_frontend_url_missing(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_URL", "alera-gamma.vercel.app")
    monkeypatch.delenv("VERCEL_PROJECT_PRODUCTION_URL", raising=False)
    monkeypatch.delenv("VERCEL_BRANCH_URL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS="",
    )

    assert settings.FRONTEND_URL == "https://alera-gamma.vercel.app"
    assert "https://alera-gamma.vercel.app" in settings.CORS_ORIGINS


def test_settings_infer_frontend_from_vercel_url_when_frontend_url_blank(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_URL", "alera-gamma.vercel.app")
    monkeypatch.delenv("VERCEL_PROJECT_PRODUCTION_URL", raising=False)
    monkeypatch.delenv("VERCEL_BRANCH_URL", raising=False)
    monkeypatch.setenv("FRONTEND_URL", "   ")

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS="",
    )

    assert settings.FRONTEND_URL == "https://alera-gamma.vercel.app"
    assert "https://alera-gamma.vercel.app" in settings.CORS_ORIGINS


def test_settings_prefer_production_url_over_preview_hosts(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "alera.health")
    monkeypatch.setenv("VERCEL_BRANCH_URL", "alera-gamma.vercel.app")
    monkeypatch.setenv("VERCEL_URL", "alera-gamma.vercel.app")
    monkeypatch.delenv("FRONTEND_URL", raising=False)

    settings = Settings(
        DATABASE_URL="postgresql://alera:secret@db.example.com:5432/alera",
        SECRET_KEY="strong-secret-key",
        ENCRYPTION_KEY="strong-encryption-key",
        CORS_ORIGINS="",
    )

    assert settings.FRONTEND_URL == "https://alera.health"
    assert settings.CORS_ORIGINS[0] == "https://alera.health"
