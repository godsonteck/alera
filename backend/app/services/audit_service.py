from __future__ import annotations

import json
from typing import Any

from starlette.background import BackgroundTask, BackgroundTasks
from fastapi import Request, Response

from database import SessionLocal
from app.models.audit_log import AuditLog
from app.models.user import User


SENSITIVE_KEYS = {
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "csrf",
    "refresh_token",
    "access_token",
    "smtp_password",
    "twilio_auth_token",
    "sendgrid_api_key",
    "resend_api_key",
    "encryption_key",
    "api_key",
}


def client_ip_from_request(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    if request.client and request.client.host:
        return request.client.host
    return None


def _detect_browser(user_agent: str) -> str:
    ua = user_agent.lower()
    if "edg/" in ua:
        return "Edge"
    if "chrome/" in ua and "edg/" not in ua:
        return "Chrome"
    if "firefox/" in ua:
        return "Firefox"
    if "safari/" in ua and "chrome/" not in ua:
        return "Safari"
    if "postmanruntime" in ua:
        return "Postman"
    if "python-requests" in ua or "httpx" in ua:
        return "Programmatic Client"
    return "Unknown Browser"


def _detect_os(user_agent: str) -> str:
    ua = user_agent.lower()
    if "windows" in ua:
        return "Windows"
    if "mac os" in ua or "macintosh" in ua:
        return "macOS"
    if "android" in ua:
        return "Android"
    if "iphone" in ua or "ipad" in ua or "ios" in ua:
        return "iOS"
    if "linux" in ua:
        return "Linux"
    return "Unknown OS"


def _detect_device_type(user_agent: str) -> str:
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua:
        return "tablet"
    if "mobile" in ua or "iphone" in ua or "android" in ua:
        return "mobile"
    return "desktop"


def summarize_device_info(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    browser = _detect_browser(user_agent)
    os_name = _detect_os(user_agent)
    device_type = _detect_device_type(user_agent)
    return f"{browser} on {os_name} ({device_type})"


def sanitize_for_audit(value: Any, *, key: str | None = None) -> Any:
    if key and key.lower() in SENSITIVE_KEYS:
        return "[REDACTED]"

    if isinstance(value, dict):
        return {
            str(child_key): sanitize_for_audit(child_value, key=str(child_key))
            for child_key, child_value in value.items()
        }
    if isinstance(value, list):
        return [sanitize_for_audit(item) for item in value]
    if isinstance(value, tuple):
        return [sanitize_for_audit(item) for item in value]
    if isinstance(value, str) and len(value) > 2000:
        return f"{value[:2000]}...[truncated]"
    return value


def _serialize_metadata(metadata: dict[str, Any] | None) -> str | None:
    if not metadata:
        return None
    return json.dumps(sanitize_for_audit(metadata), default=str, sort_keys=True)


def _resource_label(resource: str | None, resource_type: str | None, resource_id: str | int | None) -> str | None:
    if resource:
        return resource
    if resource_type and resource_id is not None:
        return f"{resource_type}:{resource_id}"
    if resource_type:
        return resource_type
    return None


def _infer_role(db, user_id: int | None, explicit_role: str | None) -> str | None:
    if explicit_role:
        return explicit_role
    if not user_id:
        return None
    
    # Check if we can get the role without a DB query if the user object is somehow available
    # but for now we just optimize the query.
    user = db.query(User).filter(User.id == user_id).with_entities(User.role).first()
    if not user:
        return None
    return user[0].value if hasattr(user[0], "value") else str(user[0])


def write_audit_log(
    *,
    user_id: int | None,
    role: str | None = None,
    action: str,
    resource: str | None = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    status: str = "success",
    ip_address: str | None = None,
    user_agent: str | None = None,
    device_info: str | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
    request_method: str | None = None,
    request_path: str | None = None,
    duration_ms: int | None = None,
    changes: str | None = None,
    description: str | None = None,
    error_message: str | None = None,
    severity: str = "info",
) -> None:
    db = SessionLocal()
    try:
        resolved_role = _infer_role(db, user_id, role)
        audit_log = AuditLog(
            user_id=user_id,
            role=resolved_role,
            action=action,
            resource=_resource_label(resource, resource_type, resource_id),
            resource_type=resource_type or "system",
            resource_id=str(resource_id) if resource_id is not None else None,
            status=status,
            old_value=changes,
            new_value=description,
            ip_address=ip_address,
            user_agent=user_agent,
            device_info=device_info or summarize_device_info(user_agent),
            metadata_json=_serialize_metadata(metadata),
            request_id=request_id,
            request_method=request_method,
            request_path=request_path,
            duration_ms=duration_ms,
            reason=error_message,
            severity=severity,
        )
        db.add(audit_log)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def append_response_background_task(response: Response, func, *args, **kwargs) -> None:
    if response.background is None:
        tasks = BackgroundTasks()
        tasks.add_task(func, *args, **kwargs)
        response.background = tasks
        return

    if isinstance(response.background, BackgroundTasks):
        response.background.add_task(func, *args, **kwargs)
        return

    existing_background = response.background
    tasks = BackgroundTasks()
    tasks.add_task(existing_background.func, *existing_background.args, **existing_background.kwargs) if isinstance(existing_background, BackgroundTask) else None
    tasks.add_task(func, *args, **kwargs)
    response.background = tasks


async def log_action(
    db,
    user_id: int | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    changes: str | None = None,
    description: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    status: str = "success",
    error_message: str | None = None,
    role: str | None = None,
    resource: str | None = None,
    device_info: str | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
    request_method: str | None = None,
    request_path: str | None = None,
    duration_ms: int | None = None,
    background_tasks: BackgroundTasks | None = None,
):
    # If background_tasks is provided, offload the DB write to keep the request fast.
    if background_tasks:
        background_tasks.add_task(
            write_audit_log,
            user_id=user_id,
            role=role,
            action=action,
            resource=resource,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            device_info=device_info,
            metadata=metadata,
            request_id=request_id,
            request_method=request_method,
            request_path=request_path,
            duration_ms=duration_ms,
            changes=changes,
            description=description,
            error_message=error_message,
            severity=_normalize_severity(status)
        )
        return

    try:
        resolved_role = _infer_role(db, user_id, role)
        audit_log = AuditLog(
            user_id=user_id,
            role=resolved_role,
            action=action,
            resource=_resource_label(resource, resource_type, resource_id),
            resource_type=resource_type or "system",
            resource_id=str(resource_id) if resource_id is not None else None,
            status=status,
            old_value=changes,
            new_value=description,
            ip_address=ip_address,
            user_agent=user_agent,
            device_info=device_info or summarize_device_info(user_agent),
            metadata_json=_serialize_metadata(metadata),
            request_id=request_id,
            request_method=request_method,
            request_path=request_path,
            duration_ms=duration_ms,
            reason=error_message,
            severity=_normalize_severity(status),
        )
        db.add(audit_log)
        db.commit()
    except Exception:
        db.rollback()


def _normalize_severity(status: str) -> str:
    normalized = status.strip().lower()
    if normalized in {"success", "info", "created", "updated", "read"}:
        return "info"
    if normalized in {"warning", "warn"}:
        return "warning"
    if normalized in {"error", "failed", "failure", "critical"}:
        return "critical"
    return "info"


def build_request_audit_payload(
    request: Request,
    *,
    user_id: int | None,
    role: str | None,
    status_code: int,
    duration_ms: int,
) -> dict[str, Any]:
    resource_type = request.url.path.split("/")[2] if len(request.url.path.split("/")) > 2 else "api"
    return {
        "user_id": user_id,
        "role": role,
        "action": f"api.{request.method.lower()}",
        "resource": request.url.path,
        "resource_type": resource_type,
        "resource_id": None,
        "status": "success" if status_code < 400 else "failed",
        "ip_address": client_ip_from_request(request),
        "user_agent": request.headers.get("user-agent"),
        "metadata": {
            "query_keys": sorted(list(request.query_params.keys())),
            "status_code": status_code,
        },
        "request_id": getattr(request.state, "request_id", None),
        "request_method": request.method,
        "request_path": request.url.path,
        "duration_ms": duration_ms,
        "severity": "critical" if status_code >= 500 else "warning" if status_code >= 400 else "info",
        "description": f"{request.method} {request.url.path}",
    }
