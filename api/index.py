"""Vercel serverless API entry point for ALERA Healthcare."""

import logging
import os
import sys
import traceback
from pathlib import Path
from threading import Lock

from fastapi import FastAPI
from fastapi.responses import JSONResponse


logger = logging.getLogger(__name__)

# Setup path to find backend modules
_root = Path(__file__).parent.parent
_backend = _root / "backend"
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_root))


def _runtime_environment() -> str:
    vercel_environment = (os.environ.get("VERCEL_ENV") or "").strip().lower()
    if vercel_environment:
        return vercel_environment

    explicit_environment = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    if explicit_environment:
        return explicit_environment

    if os.environ.get("VERCEL") == "1":
        return "production"

    return "development"


class LazyBackendApp:
    """Load the backend app only when a request actually needs it."""

    def __init__(self) -> None:
        self._app = None
        self._startup_error = None
        self._startup_traceback = None
        self._lock = Lock()

    def ensure_loaded(self):
        if self._app is not None or self._startup_error is not None:
            return self._app

        with self._lock:
            if self._app is not None or self._startup_error is not None:
                return self._app

            try:
                from main import app as imported_app

                if imported_app is None:
                    raise RuntimeError("FastAPI app is None")
                self._app = imported_app
            except Exception as exc:
                self._startup_error = str(exc)
                self._startup_traceback = traceback.format_exc()
                logger.error("ALERA API bootstrap failed on Vercel\n%s", self._startup_traceback)

        return self._app

    def backend_status(self) -> str:
        if self._app is not None:
            return "ok"
        if self._startup_error is not None:
            return "error"
        return "pending"

    @property
    def startup_error(self) -> str | None:
        return self._startup_error

    def database_status(self) -> tuple[bool, str]:
        if self.ensure_loaded() is None:
            return False, self._startup_error or "Backend startup failed"

        try:
            from app.bootstrap import database_ready

            return database_ready()
        except Exception as exc:
            return False, str(exc)

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "lifespan":
            await self._handle_lifespan(receive, send)
            return

        backend_app = self.ensure_loaded()
        if backend_app is None:
            response = JSONResponse(
                status_code=503,
                content={
                    "service": "ALERA Healthcare API",
                    "status": "error",
                    "message": "API startup failed",
                    "startup_error": self._startup_error,
                    "path": scope.get("path", ""),
                },
            )
            await response(scope, receive, send)
            return

        await backend_app(scope, receive, send)

    async def _handle_lifespan(self, receive, send) -> None:
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return


backend_app = LazyBackendApp()
app = FastAPI(title="ALERA Healthcare API", version="serverless")


@app.get("/api/health")
async def health_check():
    database_ok, database_status = backend_app.database_status()
    backend_status = backend_app.backend_status()

    payload = {
        "status": "healthy" if database_ok and backend_status == "ok" else "degraded",
        "service": "ALERA Healthcare API",
        "environment": _runtime_environment(),
        "checks": {
            "backend": backend_status,
            "database": database_status,
        },
        "path": "/api/health",
    }
    if backend_app.startup_error:
        payload["startup_error"] = backend_app.startup_error

    return JSONResponse(status_code=200, content=payload)


@app.get("/api/ready")
async def readiness_check():
    database_ok, database_status = backend_app.database_status()
    backend_status = backend_app.backend_status()
    is_ready = backend_status == "ok" and database_ok

    payload = {
        "status": "ready" if is_ready else "not_ready",
        "service": "ALERA Healthcare API",
        "environment": _runtime_environment(),
        "checks": {
            "backend": backend_status,
            "database": database_status,
        },
        "path": "/api/ready",
    }
    if backend_app.startup_error:
        payload["startup_error"] = backend_app.startup_error

    return JSONResponse(status_code=200 if is_ready else 503, content=payload)


@app.get("/api")
async def api_root():
    return JSONResponse(
        status_code=200,
        content={
            "message": "Welcome to ALERA Healthcare API",
            "health": "/api/health",
            "readiness": "/api/ready",
        },
    )


app.mount("/", backend_app)

__all__ = ["app"]
