from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator, ConfigDict
from datetime import datetime
from typing import Optional, List, Literal
from enum import Enum
from app.utils.auth import validate_password_strength


class UserRole(str, Enum):
    PATIENT = "patient"
    PROVIDER = "provider"
    PHARMACIST = "pharmacist"
    ADMIN = "admin"
    HOSPITAL = "hospital"
    LABORATORY = "laboratory"
    IMAGING = "imaging"
    AMBULANCE = "ambulance"
    PHYSIOTHERAPIST = "physiotherapist"


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.PATIENT
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    specialty: Optional[str] = None
    postdicom_api_url: Optional[str] = None
    postdicom_api_key: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password complexity using the centralized utility."""
        return validate_password_strength(v)

    @model_validator(mode="after")
    def validate_role_specific_fields(self):
        if self.role != UserRole.PATIENT:
            if not self.license_number or not self.license_state:
                raise ValueError("license_number and license_state are required for professional accounts")

        return self


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    specialization: Optional[str] = None
    postdicom_api_url: Optional[str] = None
    postdicom_api_key: Optional[str] = None
    notification_email: Optional[bool] = None
    notification_sms: Optional[bool] = None
    privacy_public_profile: Optional[bool] = None


class LinkedAccountSummary(BaseModel):
    id: int
    role: str
    masked_email: Optional[str] = None
    created_at: Optional[str] = None
    link_type: str = "same_person"


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    is_verified: bool
    email_verified: bool = False
    email_verified_at: Optional[datetime] = None
    phone: Optional[str]
    date_of_birth: Optional[datetime]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    bio: Optional[str]
    profile_image_url: Optional[str]
    address: Optional[str]
    created_at: datetime
    last_login: Optional[datetime]
    notification_email: bool = True
    notification_sms: bool = False
    privacy_public_profile: bool = False
    
    # Professional Verification Fields
    license_number: Optional[str] = None
    specialty: Optional[str] = None
    license_state: Optional[str] = None
    organization_id: Optional[int] = None
    postdicom_api_url: Optional[str] = None
    has_linked_account: bool = False
    linked_accounts: list[LinkedAccountSummary] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)


class AccountLinkCreateRequest(BaseModel):
    current_password: str
    linked_email: EmailStr
    linked_password: str


class AccountLinkListResponse(BaseModel):
    has_linked_account: bool
    linked_accounts: list[LinkedAccountSummary]


# Authentication Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    message: str
    csrf_token: str


class AuthResponse(TokenResponse):
    user: UserResponse


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    _validate_new_password = field_validator("new_password")(validate_password_strength)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    _validate_new_password = field_validator("new_password")(validate_password_strength)


class EmailVerificationConfirmRequest(BaseModel):
    token: str


# Appointment Schemas
class AppointmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    appointment_type: str  # in_person, telehealth, phone
    scheduled_time: datetime
    duration_minutes: int = 30
    location: Optional[str] = None
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    provider_id: int


class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    cancellation_reason: Optional[str] = None


class AppointmentResponse(AppointmentBase):
    id: int
    patient_id: int
    provider_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    patient_name: Optional[str] = None
    provider_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Prescription Schemas
class PrescriptionBase(BaseModel):
    medication_name: str
    dosage: str
    dosage_unit: str
    frequency: str
    route: str
    instructions: Optional[str] = None
    quantity: Optional[int] = None
    refills: int = 0
    start_date: datetime
    end_date: Optional[datetime] = None


class PrescriptionCreate(PrescriptionBase):
    """Patient receiving the prescription; prescriber is always the authenticated provider."""

    patient_id: int
    pharmacy_id: int


class PrescriptionUpdate(BaseModel):
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    dosage_unit: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None
    refills_remaining: Optional[int] = None


class PrescriptionResponse(PrescriptionBase):
    id: int
    patient_id: int
    provider_id: int
    pharmacy_id: Optional[int] = None
    status: str
    prescribed_date: datetime
    created_at: datetime
    refills_remaining: int = 0
    patient_name: Optional[str] = None
    provider_name: Optional[str] = None
    pharmacy_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Allergy Schemas
class AllergyBase(BaseModel):
    allergen: str
    allergen_type: str
    reaction_description: str
    severity: str  # mild, moderate, severe
    onset_date: Optional[datetime] = None
    treatment: Optional[str] = None


class AllergyCreate(AllergyBase):
    """When set by a provider/admin, creates an allergy for that patient; patients omit this."""
    patient_id: Optional[int] = None


class AllergyUpdate(BaseModel):
    allergen: Optional[str] = None
    reaction_description: Optional[str] = None
    severity: Optional[str] = None
    treatment: Optional[str] = None


class AllergyResponse(AllergyBase):
    id: int
    patient_id: int
    confirmed: str
    created_at: datetime
    patient_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Notification Schemas
class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str


class NotificationCreate(NotificationBase):
    related_id: Optional[int] = None
    related_type: Optional[str] = None
    action_url: Optional[str] = None


class NotificationResponse(NotificationBase):
    id: int
    is_read: bool
    is_archived: bool
    created_at: datetime
    related_id: Optional[int] = None
    related_type: Optional[str] = None
    action_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# Lab Test Schemas
class LabTestBase(BaseModel):
    test_name: str
    test_code: Optional[str] = None
    description: Optional[str] = None


class LabTestCreate(LabTestBase):
    patient_id: int
    destination_provider_id: int


class LabTestUpdate(BaseModel):
    status: Optional[str] = None
    result_value: Optional[str] = None
    result_unit: Optional[str] = None
    reference_range: Optional[str] = None
    result_notes: Optional[str] = None
    result_file_url: Optional[str] = None
    collected_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class LabTestResponse(LabTestBase):
    id: int
    patient_id: int
    ordered_by: int
    destination_provider_id: Optional[int] = None
    destination_provider_name: Optional[str] = None
    processed_by: Optional[int] = None
    status: str
    result_value: Optional[str] = None
    result_unit: Optional[str] = None
    reference_range: Optional[str] = None
    result_notes: Optional[str] = None
    result_file_url: Optional[str] = None
    ordered_at: datetime
    collected_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    patient_name: Optional[str] = None
    ordered_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Imaging Scan Schemas
class ImagingScanBase(BaseModel):
    scan_type: str
    body_part: Optional[str] = None
    clinical_indication: Optional[str] = None


class ImagingScanCreate(ImagingScanBase):
    patient_id: int
    destination_provider_id: int


class ImagingScanUpdate(BaseModel):
    status: Optional[str] = None
    findings: Optional[str] = None
    impression: Optional[str] = None
    report_url: Optional[str] = None
    image_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ImagingFileAsset(BaseModel):
    file_id: str
    filename: str
    mime_type: str
    file_size: int
    upload_time: Optional[str] = None
    download_url: Optional[str] = None


class ImagingScanResponse(ImagingScanBase):
    id: int
    patient_id: int
    ordered_by: int
    destination_provider_id: Optional[int] = None
    destination_provider_name: Optional[str] = None
    processed_by: Optional[int] = None
    status: str
    findings: Optional[str] = None
    impression: Optional[str] = None
    report_url: Optional[str] = None
    image_url: Optional[str] = None
    report_file: Optional[ImagingFileAsset] = None
    image_files: List[ImagingFileAsset] = Field(default_factory=list)
    postdicom_study_id: Optional[str] = None
    postdicom_study_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    ordered_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    patient_name: Optional[str] = None
    ordered_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Referral schemas
REFERRAL_TYPE_VALUES = ("hospital", "laboratory", "imaging", "pharmacy")
ReferralTypeLiteral = Literal["hospital", "laboratory", "imaging", "pharmacy"]


def _normalize_referral_value(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


REFERRAL_SERVICE_ALIASES: dict[ReferralTypeLiteral, set[str]] = {
    "hospital": {"hospital", "specialist", "specialistcare"},
    "laboratory": {"laboratory", "lab"},
    "imaging": {"imaging", "radiology"},
    "pharmacy": {"pharmacy"},
}


class ReferralCreate(BaseModel):
    patient_id: int
    referral_type: ReferralTypeLiteral = "hospital"
    destination_provider_id: int
    to_department: str
    to_department_id: Optional[str] = None
    reason: str
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_destination_is_different_from_service_rendered(self):
        normalized_destination = _normalize_referral_value(self.to_department)
        service_aliases = REFERRAL_SERVICE_ALIASES[self.referral_type]
        if normalized_destination in service_aliases:
            raise ValueError("The destination must be different from service rendered")
        return self


class ReferralUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class ReferralResponse(BaseModel):
    id: int
    patient_id: int
    from_doctor_id: int
    referral_type: str
    destination_provider_id: Optional[int] = None
    destination_provider_name: Optional[str] = None
    destination_provider_role: Optional[str] = None
    to_department: str
    to_department_id: Optional[str] = None
    reason: str
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    patient_name: Optional[str] = None
    from_doctor_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Ambulance Request Schemas
class AmbulanceRequestBase(BaseModel):
    location_name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    priority: Optional[str] = "medium"


class AmbulanceRequestCreate(AmbulanceRequestBase):
    patient_id: Optional[int] = None


class AmbulanceRequestUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_ambulance_id: Optional[int] = None
    dispatched_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    location_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None


class AmbulanceRequestResponse(AmbulanceRequestBase):
    id: int
    patient_id: Optional[int] = None
    assigned_ambulance_id: Optional[int] = None
    status: str
    requested_at: datetime
    accepted_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LiveLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    sharing_enabled: bool = True


class LiveLocationResponse(BaseModel):
    user_id: int
    role: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_updated: Optional[datetime] = None
    sharing_enabled: bool = False


class EmergencyTrackingResponse(BaseModel):
    request_id: int
    status: str
    priority: str
    patient_id: Optional[int] = None
    assigned_ambulance_id: Optional[int] = None
    patient_location: Optional[LiveLocationResponse] = None
    ambulance_location: Optional[LiveLocationResponse] = None


# System Settings Schemas
class SystemSettingsBase(BaseModel):
    is_maintenance_mode: bool
    maintenance_message: str
    notification_banner_active: bool
    notification_banner_message: str
    notification_banner_type: str


class SystemSettingsUpdate(BaseModel):
    is_maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None
    notification_banner_active: Optional[bool] = None
    notification_banner_message: Optional[str] = None
    notification_banner_type: Optional[str] = None


class SystemSettingsResponse(SystemSettingsBase):
    id: int
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
