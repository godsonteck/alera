from __future__ import annotations

import asyncio
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

import app.services.file_service as file_service_module
from app.services.file_service import FileStorageService, MAX_FILE_SIZE


@pytest.fixture(autouse=True)
def isolate_upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(file_service_module, "_UPLOAD_DIR_CACHE", Path(tmp_path))


def test_save_file_rejects_oversized_uploads_with_413():
    upload = UploadFile(
        file=BytesIO(b"x" * (MAX_FILE_SIZE + 1)),
        filename="oversized.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(FileStorageService.save_file(upload, subfolder="documents"))

    assert exc_info.value.status_code == 413
    assert "File too large" in str(exc_info.value.detail)


def test_save_file_sanitizes_original_filename_metadata():
    upload = UploadFile(
        file=BytesIO(b"%PDF-1.4\nok"),
        filename="../../sneaky/report.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )

    result = asyncio.run(FileStorageService.save_file(upload, subfolder="documents"))

    assert result["filename"] == "report.pdf"
    assert result["file_path"].endswith(".pdf")


def test_save_file_returns_503_when_upload_storage_is_unavailable(monkeypatch):
    upload = UploadFile(
        file=BytesIO(b"%PDF-1.4\nok"),
        filename="report.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )

    def fail_mkdir(self, *args, **kwargs):
        raise OSError("read-only filesystem")

    monkeypatch.setattr(file_service_module.Path, "mkdir", fail_mkdir, raising=False)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(FileStorageService.save_file(upload, subfolder="documents"))

    assert exc_info.value.status_code == 503
