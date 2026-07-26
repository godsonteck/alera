from __future__ import annotations

import asyncio
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers, UploadFile

import app.services.file_service as file_service_module
from app.bootstrap import create_application
from app.schemas import PasswordChangeRequest, PasswordResetConfirmRequest
from app.services.file_service import FileStorageService
from app.utils.csrf import validate_csrf_token


def _request_with_csrf(*, header_token: str, cookie_token: str, origin: str | None = None) -> Request:
    headers = []
    if header_token:
        headers.append((b"x-csrf-token", header_token.encode("utf-8")))
    if origin:
        headers.append((b"origin", origin.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/users/me",
            "headers": headers,
            "client": ("127.0.0.1", 12345),
        }
    )


def test_password_change_requires_letter_and_digit():
    with pytest.raises(Exception):
        PasswordChangeRequest(
            old_password="Current123",
            new_password="password",
            confirm_password="password",
        )


def test_password_reset_requires_letter_and_digit():
    with pytest.raises(Exception):
        PasswordResetConfirmRequest(
            token="token",
            new_password="12345678",
            confirm_password="12345678",
        )


def test_csrf_validation_uses_constant_time_compare():
    request = _request_with_csrf(header_token="same-token", cookie_token="same-token")
    request._cookies = {"csrf_token": "same-token"}
    assert validate_csrf_token(request) is True

    request._cookies = {"csrf_token": "different-token"}
    assert validate_csrf_token(request) is False


@pytest.fixture(autouse=True)
def isolate_upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(file_service_module, "_UPLOAD_DIR_CACHE", Path(tmp_path))


def test_file_upload_rejects_extension_content_mismatch():
    upload = UploadFile(
        file=BytesIO(b"not-a-real-pdf"),
        filename="report.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(FileStorageService.save_file(upload, subfolder="../documents"))

    assert exc_info.value.status_code == 400
    assert "declared file type" in str(exc_info.value.detail)


def test_global_exception_handler_hides_internal_details():
    app = create_application()
    handler = app.exception_handlers[Exception]
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/fail",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
    )
    request.state.request_id = "req-test"

    response = asyncio.run(handler(request, RuntimeError("database password is secret")))

    assert isinstance(response, JSONResponse)
    assert response.status_code == 500
    assert b"Internal server error" in response.body
    assert b"database password is secret" not in response.body
