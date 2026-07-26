from fastapi import HTTPException, UploadFile
import httpx
from app.models.lab_imaging import ImagingScan
from app.utils.time import utcnow


class PostDICOMService:
    """Support uploading imaging results and DICOM files to an external PostDICOM endpoint."""

    @staticmethod
    def _build_headers(api_key: str | None) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "ALERA-PostDICOM-Integration/1.0",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    @staticmethod
    async def upload_imaging_results(
        api_url: str,
        api_key: str | None,
        scan: ImagingScan,
        report_file: UploadFile | None = None,
        image_files: list[UploadFile] | None = None,
        findings: str | None = None,
        impression: str | None = None,
        status: str | None = None,
    ) -> dict[str, str] | None:
        if not api_url:
            raise HTTPException(status_code=400, detail="PostDICOM API URL is required")

        def _display_name(user):
            if not user:
                return None
            name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            return name or None

        data = {
            "patient_id": str(scan.patient_id),
            "patient_name": _display_name(getattr(scan, 'patient', None)) or str(scan.patient_id),
            "doctor_id": str(scan.ordered_by),
            "doctor_name": _display_name(getattr(scan, 'doctor', None)) or str(scan.ordered_by),
            "scan_id": str(scan.id),
            "scan_type": scan.scan_type,
            "body_part": scan.body_part or "",
            "clinical_indication": scan.clinical_indication or "",
            "findings": findings or "",
            "impression": impression or "",
            "status": status or "",
            "source_system": "alera",
            "source_record_id": f"imaging:{scan.id}",
            "uploaded_at": utcnow().isoformat(),
        }

        files = []
        if report_file and report_file.filename:
            report_file.file.seek(0)
            report_bytes = await report_file.read()
            report_file.file.seek(0)
            files.append(
                (
                    "report_file",
                    (report_file.filename, report_bytes, report_file.content_type or "application/octet-stream"),
                )
            )

        for image_file in image_files or []:
            if not image_file.filename:
                continue
            image_file.file.seek(0)
            image_bytes = await image_file.read()
            image_file.file.seek(0)
            files.append(
                (
                    "image_files",
                    (image_file.filename, image_bytes, image_file.content_type or "application/octet-stream"),
                )
            )

        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                response = await client.post(
                    api_url,
                    headers=PostDICOMService._build_headers(api_key),
                    data=data,
                    files=files,
                )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to send imaging files to PostDICOM: {exc}") from exc

        if response.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"PostDICOM upload failed ({response.status_code}): {response.text}",
            )

        try:
            return response.json()
        except ValueError:
            return {"status": "ok", "response_text": response.text}
