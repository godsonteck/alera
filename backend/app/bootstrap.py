import os
import logging
import traceback
from urllib.parse import urlparse
from contextlib import asynccontextmanager
import asyncio
from uuid import uuid4
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.routes import (
    account_links,
    admin,
    allergies,
    ambulance,
    appointments,
    audit,
    auth,
    consents,
    documents,
    external_ingestion,
    imaging,
    lab_tests,
    live_locations,
    location_ws,
    medical_documents,
    medical_records,
    notifications,
    organizations,
    patient_permissions,
    prescriptions,
    records,
    referrals,
    reminders_templates,
    telemedicine,
    users,
)
from app.utils.csrf import validate_csrf_token
from app.utils.auth import decode_token, get_user_id_from_payload, get_token_from_request
from app.services.audit_service import append_response_background_task, build_request_audit_payload, write_audit_log
from config import settings
from database import engine, init_db, SessionLocal
from app.models.system import SystemSettings

logger = logging.getLogger(__name__)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_EXEMPT_PATHS = {
    "/api",
    "/api/health",
    "/api/ready",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
    "/api/auth/verify-email",
}

DEFAULT_TRUSTED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "testserver",
    "*.vercel.app",
    "*.railway.app",
    "*.render.com",
    "*.up.railway.app",
]

ROUTERS = [
    auth.router,
    account_links.router,
    users.router,
    appointments.router,
    prescriptions.router,
    allergies.router,
    notifications.router,
    telemedicine.router,
    admin.router,
    documents.router,
    consents.router,
    reminders_templates.router,
    audit.router,
    lab_tests.router,
    imaging.router,
    ambulance.router,
    referrals.router,
    records.router,
    organizations.router,
    patient_permissions.router,
    medical_records.router,
    medical_documents.router,
    external_ingestion.router,
    location_ws.router,
    live_locations.router,
]


def get_allowed_hosts() -> list[str]:
    extra_hosts = os.environ.get("TRUSTED_HOSTS", "")
    return DEFAULT_TRUSTED_HOSTS + [host.strip() for host in extra_hosts.split(",") if host.strip()]


def get_trusted_origins() -> set[str]:
    origins = {settings.FRONTEND_URL.rstrip("/")}
    origins.update(origin.rstrip("/") for origin in settings.CORS_ORIGINS if origin)
    return {origin for origin in origins if origin}


def request_origin_is_trusted(request: Request) -> bool:
    trusted_origins = get_trusted_origins()
    header_value = request.headers.get("Origin") or request.headers.get("Referer")
    if not header_value:
        return True

    parsed = urlparse(header_value)
    if not parsed.scheme or not parsed.netloc:
        return False
    origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    return origin in trusted_origins


async def initialize_application_state(app: FastAPI) -> None:
    try:
        # In production environments with horizontal scaling, we often want to 
        # run migrations as a separate deployment step rather than on every 
        # application startup to avoid race conditions and slow startup times.
        if os.environ.get("SKIP_DB_INIT") == "true":
            logger.info("Skipping database initialization (SKIP_DB_INIT=true)")
        else:
            # Always run idempotent table creation/patches so existing deployments
            # receive schema updates required by new features such as audit logging.
            init_db()
            
        app.state.startup_complete = True
        app.state.startup_error = None
    except Exception as exc:
        app.state.startup_complete = False
        app.state.startup_error = str(exc)
        logger.error(f"Error during startup database initialization: {exc}", exc_info=True)


def database_ready() -> tuple[bool, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "ok"
    except Exception as exc:
        return False, str(exc)


def register_middlewares(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=get_allowed_hosts(),
    )

    @app.middleware("http")
    async def maintenance_middleware(request: Request, call_next):
        path = request.url.path

        # Always allowed paths
        if any(path.startswith(p) for p in [
            "/api/health", 
            "/api/ready", 
            "/api/admin",  # Admins must be able to access their tools
            "/api/auth/login", 
            "/api/auth/logout",
            "/api/system/status"  # Frontend needs to fetch status
        ]):
            return await call_next(request)

        # Check maintenance mode with caching
        from app.utils.redis import redis_get, redis_set
        
        cache_key = "system:maintenance_mode"
        is_maintenance = redis_get(cache_key)
        maintenance_msg = ""

        if is_maintenance is None:
            # Cache miss or Redis down, check DB
            db = SessionLocal()
            try:
                settings_row = db.query(SystemSettings).first()
                if settings_row:
                    is_maintenance = "1" if settings_row.is_maintenance_mode else "0"
                    maintenance_msg = settings_row.maintenance_message
                    # Cache for 30 seconds
                    redis_set(cache_key, is_maintenance, ex=30)
                    if maintenance_msg:
                        redis_set("system:maintenance_message", maintenance_msg, ex=30)
                else:
                    is_maintenance = "0"
            except Exception as exc:
                logger.error("Error checking maintenance mode: %s", exc)
                is_maintenance = "0" # Fallback to up
            finally:
                db.close()
        
        if is_maintenance == "1":
            if not maintenance_msg:
                maintenance_msg = redis_get("system:maintenance_message") or "ALERA is currently undergoing scheduled maintenance."
            return JSONResponse(
                status_code=503,
                content={
                    "detail": maintenance_msg,
                    "maintenance": True
                }
            )

        return await call_next(request)


    @app.middleware("http")
    async def csrf_protection_middleware(request: Request, call_next):
        path = request.url.path
        if (
            request.method not in SAFE_METHODS
            and path.startswith("/api")
            and request.cookies.get("access_token")
            and not request_origin_is_trusted(request)
        ):
            return JSONResponse(
                status_code=403,
                content={"detail": "Request origin is not allowed"},
            )

        if (
            request.method not in SAFE_METHODS
            and path.startswith("/api")
            and path not in CSRF_EXEMPT_PATHS
            and request.cookies.get("access_token")
        ):
            if not validate_csrf_token(request):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token validation failed"},
                )

        return await call_next(request)

    @app.middleware("http")
    async def add_runtime_headers(request: Request, call_next):
        started_at = perf_counter()
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = int((perf_counter() - started_at) * 1000)
            token = get_token_from_request(request)
            user_id = None
            if token:
                try:
                    payload = decode_token(token)
                    user_id = get_user_id_from_payload(payload)
                except Exception:
                    user_id = None
            write_audit_log(**build_request_audit_payload(
                request,
                user_id=user_id,
                role=None,
                status_code=500,
                duration_ms=duration_ms,
            ))
            raise

        duration_ms = int((perf_counter() - started_at) * 1000)
        
        # Log slow requests (> 500ms) for observability
        if duration_ms > 500:
            logger.warning(
                f"SLOW REQUEST: {request.method} {request.url.path} took {duration_ms}ms (RID: {request_id})"
            )

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = str(duration_ms)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(self)",
        )
        if settings.ENVIRONMENT == "production":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains; preload",
            )

        if request.url.path.startswith("/api") and request.url.path not in {"/api/health", "/api/ready"}:
            token = get_token_from_request(request)
            user_id = None
            if token:
                try:
                    payload = decode_token(token)
                    user_id = get_user_id_from_payload(payload)
                except Exception:
                    user_id = None
            append_response_background_task(
                response,
                write_audit_log,
                **build_request_audit_payload(
                    request,
                    user_id=user_id,
                    role=None,
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                ),
            )
        return response


def register_routers(app: FastAPI) -> None:
    for router in ROUTERS:
        app.include_router(router)


def register_system_routes(app: FastAPI) -> None:
    @app.get("/api/health")
    async def health_check():
        database_ok, database_status = database_ready()
        return {
            "status": "healthy" if database_ok else "degraded",
            "service": "ALERA Healthcare API",
            "version": "1.0.0",
            "environment": settings.ENVIRONMENT,
            "checks": {
                "database": database_status,
                "startup": "ok" if app.state.startup_complete else "pending",
            },
        }

    @app.get("/api/ready")
    async def readiness_check():
        database_ok, database_status = database_ready()
        startup_complete = bool(app.state.startup_complete)
        is_ready = startup_complete and database_ok
        status_code = 200 if is_ready else 503
        payload = {
            "status": "ready" if is_ready else "not_ready",
            "environment": settings.ENVIRONMENT,
            "checks": {
                "startup": "ok" if startup_complete else "pending",
                "database": database_status,
            },
        }
        if app.state.startup_error:
            payload["startup_error"] = app.state.startup_error
        return JSONResponse(status_code=status_code, content=payload)

    @app.get("/api/system/status")
    async def get_system_status():
        """Public endpoint to check system status and maintenance mode"""
        from app.utils.redis import redis_get_json, redis_set_json
        
        cache_key = "system:status_blob"
        cached_status = redis_get_json(cache_key)
        if cached_status:
            return cached_status

        from database import SessionLocal
        from app.models.system import SystemSettings
        
        db = SessionLocal()
        try:
            settings_row = db.query(SystemSettings).first()
            if not settings_row:
                status_blob = {
                    "is_maintenance_mode": False,
                    "maintenance_message": "",
                    "notification_banner_active": False,
                    "notification_banner_message": "",
                    "notification_banner_type": "info"
                }
            else:
                status_blob = {
                    "is_maintenance_mode": settings_row.is_maintenance_mode,
                    "maintenance_message": settings_row.maintenance_message,
                    "notification_banner_active": settings_row.notification_banner_active,
                    "notification_banner_message": settings_row.notification_banner_message,
                    "notification_banner_type": settings_row.notification_banner_type
                }
            
            # Cache for 60 seconds
            redis_set_json(cache_key, status_blob, ex=60)
            return status_blob
        finally:
            db.close()

    @app.get("/api")
    async def root():
        return {
            "message": "Welcome to ALERA Healthcare API",
            "docs": "/api/docs" if settings.DEBUG or settings.EXPOSE_API_DOCS else None,
            "health": "/api/health",
            "readiness": "/api/ready",
        }


def register_exception_handlers(app: FastAPI) -> None:
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        request_id = getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "status": "error",
                "request_id": request_id,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID")
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Validation failed",
                "errors": exc.errors(),
                "status": "error",
                "request_id": request_id,
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID")
        logger.exception("Unhandled exception for request %s", request_id, exc_info=exc)

        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "status": "error",
                "request_id": request_id,
            },
        )


def create_application() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await initialize_application_state(app)
        
        # Start distributed WebSocket listener
        from app.utils.websocket_manager import manager
        manager.redis_listener_task = asyncio.create_task(manager.start_redis_listener())
        
        yield
        
        # Cleanup
        if manager.redis_listener_task:
            manager.redis_listener_task.cancel()
            try:
                await manager.redis_listener_task
            except asyncio.CancelledError:
                pass

    app = FastAPI(
        title="ALERA Healthcare API",
        description="Backend API for ALERA Healthcare Platform",
        version="1.0.0",
        docs_url="/api/docs" if settings.DEBUG or settings.EXPOSE_API_DOCS else None,
        openapi_url="/api/openapi.json" if settings.DEBUG or settings.EXPOSE_API_DOCS else None,
        lifespan=lifespan,
    )

    app.state.startup_complete = False
    app.state.startup_error = None

    register_middlewares(app)
    register_routers(app)
    register_system_routes(app)
    register_exception_handlers(app)
    return app
