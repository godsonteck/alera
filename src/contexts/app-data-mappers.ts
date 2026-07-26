import type {
  AmbulanceRequest,
  Appointment,
  AppointmentReminder,
  AmbulanceVehicle,
  BillingRecord,
  ClinicalNote,
  HealthMetric,
  ImagingScan,
  InventoryItem,
  Invoice,
  LabTest,
  MedicationAdherence,
  PatientAllergy,
  PatientConsent,
  PatientMedicalHistory,
  PatientProblem,
  Prescription,
  ProviderPricing,
  ProviderVerification,
  Referral,
  ServiceCharge,
  VitalSigns,
} from '@/data/mockData';
import type { ImagingFileAsset } from '@/lib/apiService';
import { getReferralDepartmentId } from '@/lib/referralUtils';

export type BackendAppointment = {
  id: string | number;
  patient_id: string | number;
  provider_id: string | number;
  title: string;
  description?: string;
  scheduled_time: string;
  appointment_type?: string;
  status?: string;
  notes?: string;
  patient_name?: string | null;
  provider_name?: string | null;
};

export type BackendPrescription = {
  id: string | number;
  medication_name: string;
  dosage: string;
  dosage_unit?: string;
  frequency: string;
  route?: string;
  instructions?: string | null;
  quantity?: number | null;
  provider_id: string | number;
  pharmacy_id?: string | number | null;
  patient_id: string | number;
  status?: string;
  refills?: number;
  refills_remaining?: number;
  prescribed_date?: string;
  created_at?: string;
  patient_name?: string | null;
  provider_name?: string | null;
  pharmacy_name?: string | null;
};

export type BackendAllergy = {
  id: string | number;
  patient_id: string | number;
  allergen: string;
  allergen_type: string;
  severity: string;
  reaction_description: string;
  treatment?: string;
  onset_date?: string;
  created_at?: string;
  patient_name?: string | null;
};

export interface StoredAppData {
  appointments: Appointment[];
  prescriptions: Prescription[];
  labTests: LabTest[];
  imagingScans: ImagingScan[];
  ambulanceRequests: AmbulanceRequest[];
  vitalSigns: VitalSigns[];
  healthMetrics: HealthMetric[];
  inventoryItems: InventoryItem[];
  ambulances: AmbulanceVehicle[];
  referrals: Referral[];
  providerVerifications: ProviderVerification[];
  patientAllergies: PatientAllergy[];
  medicalHistories: PatientMedicalHistory[];
  patientConsents: PatientConsent[];
  clinicalNotes: ClinicalNote[];
  patientProblems: PatientProblem[];
  medicationAdherence: MedicationAdherence[];
  providerPricing: ProviderPricing[];
  serviceCharges: ServiceCharge[];
  invoices: Invoice[];
  billingRecords: BillingRecord[];
  appointmentReminders: AppointmentReminder[];
}

export const emptyData: StoredAppData = {
  appointments: [],
  prescriptions: [],
  labTests: [],
  imagingScans: [],
  ambulanceRequests: [],
  vitalSigns: [],
  healthMetrics: [],
  inventoryItems: [],
  ambulances: [],
  referrals: [],
  providerVerifications: [],
  patientAllergies: [],
  medicalHistories: [],
  patientConsents: [],
  clinicalNotes: [],
  patientProblems: [],
  medicationAdherence: [],
  providerPricing: [],
  serviceCharges: [],
  invoices: [],
  billingRecords: [],
  appointmentReminders: [],
};

export type BackendLabTest = {
  id: number;
  test_name: string;
  test_code?: string;
  description?: string;
  status: string;
  result_value?: string;
  result_unit?: string;
  reference_range?: string;
  result_notes?: string;
  result_file_url?: string;
  ordered_at: string;
  collected_at?: string;
  completed_at?: string;
  patient_id: number;
  ordered_by: number;
  destination_provider_id?: number | null;
  destination_provider_name?: string | null;
  patient_name?: string | null;
  ordered_by_name?: string | null;
};

export type BackendImagingScan = {
  id: number;
  scan_type: string;
  body_part?: string;
  clinical_indication?: string;
  status: string;
  findings?: string;
  impression?: string;
  report_url?: string;
  image_url?: string;
  ordered_at: string;
  scheduled_at?: string;
  completed_at?: string;
  patient_id: number;
  ordered_by: number;
  destination_provider_id?: number | null;
  destination_provider_name?: string | null;
  patient_name?: string | null;
  ordered_by_name?: string | null;
  report_file?: ImagingFileAsset | null;
  image_files?: ImagingFileAsset[];
};

export type BackendReferral = {
  id: number;
  patient_id: number;
  from_doctor_id: number;
  referral_type?: string | null;
  destination_provider_id?: number | null;
  destination_provider_name?: string | null;
  destination_provider_role?: string | null;
  to_department: string;
  to_department_id?: string | null;
  reason: string;
  notes?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  patient_name?: string | null;
  from_doctor_name?: string | null;
};

export type BackendAmbulanceRequest = {
  id: number;
  patient_id?: number | null;
  assigned_ambulance_id?: number | null;
  location_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  status: string;
  priority: string;
  requested_at: string;
  accepted_at?: string | null;
  dispatched_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
};

export const getListPayload = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }

  return [];
};

const mapBackendStatus = (raw?: string): Appointment['status'] => {
  const status = (raw || 'scheduled').toLowerCase().replace(/_/g, '-');
  if (status === 'in-progress') return 'in-progress';
  if (status === 'confirmed') return 'confirmed-by-doctor';
  if (status === 'rescheduled') return 'rescheduled';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'scheduled';
};

export const mapBackendAppointment = (appointment: BackendAppointment): Appointment => {
  const appointmentType = (appointment.appointment_type || 'telehealth').toLowerCase();
  const telemedicine = appointmentType === 'telehealth' || appointmentType === 'phone';
  const scheduledAt = new Date(appointment.scheduled_time);
  const status = mapBackendStatus(appointment.status);

  return {
    id: String(appointment.id),
    patientId: String(appointment.patient_id),
    patientName: appointment.patient_name?.trim() || `Patient #${appointment.patient_id}`,
    doctorId: String(appointment.provider_id),
    doctorName: appointment.provider_name?.trim() || `Provider #${appointment.provider_id}`,
    date: scheduledAt.toISOString().slice(0, 10),
    time: scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: appointment.title || (telemedicine ? 'Telehealth' : 'In-Person'),
    appointmentMode: telemedicine ? 'telemedicine' : 'in-person',
    status,
    notes: appointment.notes || appointment.description || appointment.title,
    doctorConfirmed: status === 'confirmed-by-doctor',
  };
};

const mapBackendPrescriptionStatus = (raw?: string): Prescription['status'] => {
  const status = (raw || 'active').toLowerCase();
  if (status === 'dispensed') return 'dispensed';
  if (status === 'expired' || status === 'discontinued') return 'expired';
  return 'active';
};

export const mapBackendPrescription = (prescription: BackendPrescription): Prescription => {
  const totalRefills = prescription.refills ?? 0;
  const remainingRefills = prescription.refills_remaining ?? totalRefills;
  const refillsUsed = Math.max(0, totalRefills - remainingRefills);
  const duration =
    prescription.quantity != null && prescription.quantity > 0
      ? `${prescription.quantity} units`
      : prescription.instructions?.trim()
        ? prescription.instructions
        : 'As directed';
  const dosageLabel =
    [prescription.dosage, prescription.dosage_unit].filter(Boolean).join(' ').trim() || prescription.dosage;

  return {
    id: String(prescription.id),
    patientName: prescription.patient_name?.trim() || `Patient #${prescription.patient_id}`,
    patientId: String(prescription.patient_id),
    doctorName: prescription.provider_name?.trim() || `Provider #${prescription.provider_id}`,
    doctorId: String(prescription.provider_id),
    pharmacyId: prescription.pharmacy_id ? String(prescription.pharmacy_id) : undefined,
    pharmacyName: prescription.pharmacy_name?.trim() || undefined,
    date: prescription.prescribed_date
      ? prescription.prescribed_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    medications: [{
      name: prescription.medication_name,
      dosage: dosageLabel,
      frequency: prescription.frequency,
      duration,
    }],
    status: mapBackendPrescriptionStatus(prescription.status),
    refillsAllowed: totalRefills,
    refillsUsed,
  };
};

export const mapBackendAllergy = (allergy: BackendAllergy): PatientAllergy => ({
  id: String(allergy.id),
  patientId: String(allergy.patient_id),
  patientName: allergy.patient_name?.trim() || undefined,
  allergen: allergy.allergen,
  allergyType: (allergy.allergen_type.toLowerCase() || 'other') as PatientAllergy['allergyType'],
  severity: (() => {
    const level = (allergy.severity || 'mild').toLowerCase();
    if (level === 'life-threatening') return 'life-threatening' as const;
    if (level === 'severe') return 'severe' as const;
    if (level === 'moderate') return 'moderate' as const;
    return 'mild' as const;
  })(),
  reaction: allergy.reaction_description,
  dateIdentified: allergy.onset_date || allergy.created_at,
  addedDate: allergy.created_at,
  status: 'active',
  notes: allergy.treatment || '',
});

const mapBackendLabStatus = (raw: string): LabTest['status'] => {
  const status = raw.toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'processing' || status === 'sample_collected') return 'in-progress';
  return 'requested';
};

const mapBackendImagingStatus = (raw: string): ImagingScan['status'] => {
  const status = raw.toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'in_progress' || status === 'scheduled') return 'in-progress';
  return 'requested';
};

export const mapBackendLabTest = (test: BackendLabTest): LabTest => ({
  id: String(test.id),
  patientId: String(test.patient_id),
  patientName: test.patient_name?.trim() || `Patient #${test.patient_id}`,
  doctorId: String(test.ordered_by),
  doctorName: test.ordered_by_name?.trim() || `Provider #${test.ordered_by}`,
  labId: test.destination_provider_id ? String(test.destination_provider_id) : undefined,
  destinationProviderName: test.destination_provider_name?.trim() || undefined,
  testName: test.test_name,
  date: test.ordered_at.slice(0, 10),
  status: mapBackendLabStatus(test.status),
  results:
    test.result_value && test.result_unit
      ? `${test.result_value} ${test.result_unit}`
      : test.result_notes || undefined,
  referenceRange: test.reference_range,
  notes: test.result_notes,
  documentUrl: test.result_file_url || undefined,
});

export const mapBackendImagingScan = (scan: BackendImagingScan): ImagingScan => ({
  id: String(scan.id),
  patientId: String(scan.patient_id),
  patientName: scan.patient_name?.trim() || `Patient #${scan.patient_id}`,
  doctorId: String(scan.ordered_by),
  doctorName: scan.ordered_by_name?.trim() || `Provider #${scan.ordered_by}`,
  centerId: scan.destination_provider_id ? String(scan.destination_provider_id) : undefined,
  destinationProviderName: scan.destination_provider_name?.trim() || undefined,
  scanType: scan.scan_type as ImagingScan['scanType'],
  bodyPart: scan.body_part || undefined,
  clinicalIndication: scan.clinical_indication || undefined,
  date: scan.ordered_at.slice(0, 10),
  status: mapBackendImagingStatus(scan.status),
  results: scan.findings || undefined,
  impression: scan.impression || undefined,
  reportUrl: scan.report_url || undefined,
  imageUrl: scan.image_url || undefined,
  reportFile: scan.report_file
    ? {
        fileId: scan.report_file.file_id,
        filename: scan.report_file.filename,
        mimeType: scan.report_file.mime_type,
        fileSize: scan.report_file.file_size,
        uploadTime: scan.report_file.upload_time || undefined,
        downloadUrl: scan.report_file.download_url || undefined,
      }
    : undefined,
  imageFiles: (scan.image_files || []).map((file) => ({
    fileId: file.file_id,
    filename: file.filename,
    mimeType: file.mime_type,
    fileSize: file.file_size,
    uploadTime: file.upload_time || undefined,
    downloadUrl: file.download_url || undefined,
  })),
  postdicomStudyId: scan.postdicom_study_id || undefined,
  postdicomStudyUrl: scan.postdicom_study_url || undefined,
  scheduledAt: scan.scheduled_at || undefined,
  completedAt: scan.completed_at || undefined,
});

export const mapBackendReferral = (referral: BackendReferral): Referral => {
  const referralTypeRaw = (referral.referral_type || 'hospital').toLowerCase();
  const referralType: Referral['referralType'] =
    referralTypeRaw === 'laboratory' || referralTypeRaw === 'imaging' || referralTypeRaw === 'pharmacy'
      ? referralTypeRaw
      : 'hospital';

  return {
    id: String(referral.id),
    referralType,
    patientId: String(referral.patient_id),
    patientName: referral.patient_name?.trim() || `Patient #${referral.patient_id}`,
    fromDoctorId: String(referral.from_doctor_id),
    fromDoctorName: referral.from_doctor_name?.trim() || `Provider #${referral.from_doctor_id}`,
    destinationProviderId: referral.destination_provider_id ? String(referral.destination_provider_id) : undefined,
    destinationProviderName: referral.destination_provider_name?.trim() || undefined,
    destinationProviderRole: (() => {
      const role = (referral.destination_provider_role || '').toLowerCase();
      if (role === 'hospital' || role === 'laboratory' || role === 'imaging') return role;
      if (role === 'pharmacist' || role === 'pharmacy') return 'pharmacy';
      if (role === 'physiotherapist') return 'physiotherapist';
      return undefined;
    })(),
    toDepartmentId: referral.to_department_id || getReferralDepartmentId(referral.to_department),
    toDepartment: referral.to_department,
    reason: referral.reason,
    date: (referral.created_at || '').slice(0, 10),
    status: referral.status as Referral['status'],
    lastUpdated: (referral.updated_at || referral.created_at || '').slice(0, 10),
    notes: referral.notes || undefined,
  };
};

export const mapBackendAmbulanceRequest = (
  request: BackendAmbulanceRequest,
  fallbackPatientName?: string,
): AmbulanceRequest => ({
  id: String(request.id),
  patientName: fallbackPatientName || `Patient #${request.patient_id ?? 'unknown'}`,
  patientId: String(request.patient_id ?? ''),
  location: request.location_name || request.address || 'Unknown location',
  address: request.address || undefined,
  latitude: request.latitude ?? undefined,
  longitude: request.longitude ?? undefined,
  date: (request.requested_at || '').slice(0, 10),
  time: (request.requested_at || '').slice(11, 16),
  status: (() => {
    const status = (request.status || 'requested').toLowerCase();
    if (status === 'pending') return 'requested';
    if (status === 'accepted') return 'accepted';
    if (status === 'dispatched') return 'dispatched';
    if (status === 'arrived') return 'arrived';
    if (status === 'cancelled') return 'cancelled';
    if (status === 'completed') return 'completed';
    if (status === 'en_route') return 'en-route';
    return 'requested';
  })(),
  priority: (() => {
    const priority = (request.priority || 'medium').toLowerCase();
    if (priority === 'critical') return 'critical';
    if (priority === 'high') return 'high';
    if (priority === 'low') return 'low';
    return 'medium';
  })(),
  vehicleId: undefined,
  assignedAmbulanceId: request.assigned_ambulance_id ? String(request.assigned_ambulance_id) : undefined,
  acceptedAt: request.accepted_at || undefined,
  dispatchedAt: request.dispatched_at || undefined,
  arrivedAt: request.arrived_at || undefined,
  completedAt: request.completed_at || undefined,
});
