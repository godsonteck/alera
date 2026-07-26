"""
File management utilities and services for ALERA healthcare platform

VERSION: 2026-04-02 21:25 - Force rebuild with no module-level filesystem ops
"""

import logging
import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException
from config import settings
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

# Configuration constants
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png",
    ".txt",
    ".xls",
    ".xlsx",
    ".dcm",
    ".dicom",
    ".tif",
    ".tiff",
    ".bmp",
    ".zip",
}
ALLOWED_CONTENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword", "application/octet-stream"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".xls": {"application/vnd.ms-excel", "application/octet-stream"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"},
    ".dcm": {"application/dicom", "application/octet-stream"},
    ".dicom": {"application/dicom", "application/octet-stream"},
    ".tif": {"image/tiff", "application/octet-stream"},
    ".tiff": {"image/tiff", "application/octet-stream"},
    ".bmp": {"image/bmp", "application/octet-stream"},
    ".zip": {"application/zip", "application/x-zip-compressed", "multipart/x-zip", "application/octet-stream"},
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

# Upload directory cache
_UPLOAD_DIR_CACHE = None
DEFAULT_UPLOAD_DIR = Path("uploads")
SERVERLESS_UPLOAD_DIR = Path("/tmp/alera_uploads")


def _configured_upload_dir() -> Path | None:
    raw_value = str(getattr(settings, "UPLOAD_DIR", "") or "").strip()
    if not raw_value:
        return None
    return Path(raw_value)

def get_upload_dir():
    """
    Get the upload directory path - lazily initialized.
    This is deferred from module import time to avoid filesystem access on startup.
    """
    global _UPLOAD_DIR_CACHE
    
    if _UPLOAD_DIR_CACHE is not None:
        return _UPLOAD_DIR_CACHE
    
    try:
        configured_dir = _configured_upload_dir()
        is_vercel = os.path.exists('/var/task') or os.path.exists('/var/runtime')

        if configured_dir is not None:
            _UPLOAD_DIR_CACHE = configured_dir
        elif is_vercel:
            _UPLOAD_DIR_CACHE = SERVERLESS_UPLOAD_DIR
        else:
            _UPLOAD_DIR_CACHE = DEFAULT_UPLOAD_DIR
    except Exception as exc:
        logger.warning("Failed to resolve upload directory, falling back to default path", exc_info=exc)
        _UPLOAD_DIR_CACHE = DEFAULT_UPLOAD_DIR
    
    return _UPLOAD_DIR_CACHE


def _safe_subfolder_path(subfolder: str) -> Path:
    parts = [part for part in Path(subfolder).parts if part not in {"", ".", ".."}]
    return Path(*parts) if parts else Path("documents")


def _matches_expected_signature(file_ext: str, contents: bytes) -> bool:
    if file_ext == ".pdf":
        return contents.startswith(b"%PDF-")
    if file_ext in {".jpg", ".jpeg"}:
        return contents.startswith(b"\xff\xd8\xff")
    if file_ext == ".png":
        return contents.startswith(b"\x89PNG\r\n\x1a\n")
    if file_ext == ".zip":
        return contents.startswith(b"PK\x03\x04") or contents.startswith(b"PK\x05\x06") or contents.startswith(b"PK\x07\x08")
    return True


class FileStorageService:
    """Handle file uploads and storage"""

    @staticmethod
    def ensure_upload_directory(path: Path | None = None) -> Path:
        """Create and return the target upload directory."""
        target = path or get_upload_dir()
        try:
            target.mkdir(exist_ok=True, parents=True)
            return target
        except Exception as exc:
            logger.error("Upload storage is unavailable for path %s", target, exc_info=exc)
            raise HTTPException(status_code=503, detail="Upload storage is unavailable") from exc

    @staticmethod
    def _cleanup_file(file_path: Path) -> None:
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception as exc:
            logger.warning("Failed to cleanup temporary upload file at %s", file_path, exc_info=exc)

    @staticmethod
    def validate_file(file: UploadFile) -> tuple[bool, str]:
        """
        Validate uploaded file
        Returns: (is_valid, message)
        """
        if not file.filename:
            return False, "No filename provided"

        sanitized_name = Path(file.filename).name.strip()
        if not sanitized_name or sanitized_name in {".", ".."}:
            return False, "Invalid filename"

        # Check file extension
        file_ext = Path(sanitized_name).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            allowed = ", ".join(ALLOWED_EXTENSIONS)
            return False, f"File type not allowed. Allowed types: {allowed}"

        content_type = (file.content_type or "application/octet-stream").lower()
        allowed_types = ALLOWED_CONTENT_TYPES.get(file_ext, {"application/octet-stream"})
        if content_type not in allowed_types:
            return False, "File content type does not match the allowed type for this extension"

        # Check file size (we'll verify actual size during upload)
        return True, "Valid"

    @staticmethod
    async def save_file(
        file: UploadFile,
        subfolder: str = "documents",
        prefix: str = "file"
    ) -> dict:
        """
        Save uploaded file and return file info
        """
        # Validate file
        is_valid, message = FileStorageService.validate_file(file)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)

        if not file.filename or not isinstance(file.filename, str):
            raise HTTPException(status_code=400, detail="Invalid filename")

        # Prepare path/key
        filename = Path(file.filename).name
        file_ext = Path(filename).suffix.lower()
        file_id = f"{prefix}_{uuid.uuid4().hex[:12]}"
        unique_filename = f"{file_id}{file_ext}"
        
        # S3 vs Local path
        safe_sub = _safe_subfolder_path(subfolder)
        storage_key = f"{safe_sub}/{unique_filename}".replace("\\", "/")

        try:
            contents = await file.read()
            if not contents:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
            if len(contents) > MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File too large")
            if not _matches_expected_signature(file_ext, contents):
                raise HTTPException(
                    status_code=400,
                    detail="File contents do not match the declared file type",
                )

            mime_type = file.content_type or "application/octet-stream"

            if settings.USE_S3:
                # S3 Implementation
                try:
                    import boto3
                    s3_client = boto3.client(
                        's3',
                        aws_access_key_id=settings.S3_ACCESS_KEY,
                        aws_secret_access_key=settings.S3_SECRET_KEY,
                        region_name=settings.S3_REGION,
                        endpoint_url=settings.S3_ENDPOINT_URL or None
                    )
                    
                    import asyncio
                    await asyncio.to_thread(
                        s3_client.put_object,
                        Bucket=settings.S3_BUCKET,
                        Key=storage_key,
                        Body=contents,
                        ContentType=mime_type
                    )
                    file_path = f"s3://{settings.S3_BUCKET}/{storage_key}"
                except ImportError:
                    logger.error("boto3 not installed, cannot use S3 storage")
                    raise HTTPException(status_code=500, detail="S3 storage misconfigured")
            else:
                # Local Implementation
                base_upload_dir = FileStorageService.ensure_upload_directory()
                save_dir = FileStorageService.ensure_upload_directory(base_upload_dir / safe_sub)
                file_path_local = save_dir / unique_filename
                
                import asyncio
                def write_sync():
                    with open(file_path_local, "wb") as f:
                        f.write(contents)
                await asyncio.to_thread(write_sync)
                file_path = str(file_path_local)

            return {
                "file_id": file_id,
                "filename": filename,
                "file_path": file_path,
                "file_size": len(contents),
                "mime_type": mime_type,
                "upload_time": utcnow().isoformat(),
            }
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Failed to save uploaded file %s", filename, exc_info=exc)
            raise HTTPException(status_code=500, detail="Failed to save file")

    @staticmethod
    def get_file_path(file_id: str, subfolder: str = "documents") -> Optional[Path]:
        """Get file path by file ID"""
        if not file_id or not isinstance(file_id, str):
            return None
        
        save_dir = get_upload_dir() / _safe_subfolder_path(subfolder)
        
        # Find file with this ID (could be any extension)
        try:
            for file_path in save_dir.glob(f"{file_id}.*"):
                if file_path.is_file():
                    return file_path
        except Exception as exc:
            logger.warning("Failed to resolve file path for file_id=%s in %s", file_id, save_dir, exc_info=exc)
        
        return None

    @staticmethod
    def delete_file(file_id: str, subfolder: str = "documents") -> bool:
        """Delete a file by file ID"""
        if not file_id:
            return False
        
        file_path = FileStorageService.get_file_path(file_id, subfolder)
        if file_path and file_path.exists():
            try:
                file_path.unlink()
                return True
            except Exception as exc:
                logger.warning("Failed to delete file %s", file_path, exc_info=exc)
                return False
        return False

    @staticmethod
    def get_file_size(file_id: str, subfolder: str = "documents") -> int:
        """Get file size in bytes"""
        if not file_id:
            return 0
        
        file_path = FileStorageService.get_file_path(file_id, subfolder)
        if file_path and file_path.exists():
            try:
                return file_path.stat().st_size
            except Exception as exc:
                logger.warning("Failed to read file size for %s", file_path, exc_info=exc)
                return 0
        return 0


class DocumentService:
    """Handle document-related operations"""

    @staticmethod
    def generate_document_reference(document_type: str, user_id: str) -> str:
        """
        Generate a unique document reference
        Format: DOC_TYPE_USERID_TIMESTAMP
        """
        timestamp = utcnow().strftime("%Y%m%d%H%M%S")
        doc_type_abbr = document_type[:4].upper()
        user_abbr = user_id[:6]
        return f"{doc_type_abbr}_{user_abbr}_{timestamp}"

    @staticmethod
    def categorize_document(filename: str) -> str:
        """Categorize document based on filename"""
        filename_lower = filename.lower()
        
        if any(x in filename_lower for x in ["prescription", "med", "rx"]):
            return "prescription"
        elif any(x in filename_lower for x in ["lab", "test", "result"]):
            return "lab_result"
        elif any(x in filename_lower for x in ["image", "scan", "x-ray", "ct", "mri"]):
            return "imaging"
        elif any(x in filename_lower for x in ["consent", "form", "agreement"]):
            return "consent"
        elif any(x in filename_lower for x in ["note", "clinical", "summary"]):
            return "clinical_note"
        else:
            return "other"
