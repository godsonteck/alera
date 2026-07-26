from .user import User, UserRole
from .appointment import Appointment, AppointmentStatus
from .prescription import Prescription
from .allergy import Allergy
from .medical_history import MedicalHistory
from .notification import Notification
from .audit_log import AuditLog
from .telemedicine import VideoCall, Message
from .lab_imaging import LabTest, ImagingScan, LabTestStatus, ImagingScanStatus
from .referral import Referral
from .ambulance import AmbulanceRequest, AmbulanceRequestStatus, EmergencyPriority
from .additional_features import (
    PatientDocument,
    PatientConsent,
    AppointmentReminder,
    EmailTemplate,
    SMSTemplate,
    DocumentType,
)
from .structured_record import StructuredRecord
from .organization import Organization
from .canonical_records import MedicalRecord, MedicalDocument, PatientPermission
from .account_link import AccountLink
from .system import SystemSettings

__all__ = [
    "User",
    "UserRole",
    "Appointment",
    "AppointmentStatus",
    "Prescription",
    "Allergy",
    "MedicalHistory",
    "Notification",
    "AuditLog",
    "VideoCall",
    "Message",
    "LabTest",
    "ImagingScan",
    "LabTestStatus",
    "ImagingScanStatus",
    "Referral",
    "AmbulanceRequest",
    "AmbulanceRequestStatus",
    "EmergencyPriority",
    "PatientDocument",
    "PatientConsent",
    "AppointmentReminder",
    "EmailTemplate",
    "SMSTemplate",
    "DocumentType",
    "StructuredRecord",
    "Organization",
    "MedicalRecord",
    "MedicalDocument",
    "PatientPermission",
    "AccountLink",
    "SystemSettings",
]

import sys

# Keep package-level imports consistent regardless of path style.
sys.modules.setdefault("app.models", sys.modules[__name__])
sys.modules.setdefault("backend.app.models", sys.modules[__name__])
