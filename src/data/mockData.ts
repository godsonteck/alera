// Shared domain types for the ALERA platform

export interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorId: string;
  date: string;
  time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'in-progress' | 'confirmed-by-doctor' | 'rescheduled';
  type: string;
  appointmentMode: 'telemedicine' | 'in-person';
  notes?: string;
  reminder24hSent?: boolean;
  reminder1hSent?: boolean;
  reminder15mSent?: boolean;
  // New fields for appointment management
  doctorConfirmed?: boolean;
  doctorConfirmationTime?: string;
  cancellationReason?: string;
  cancelledBy?: 'patient' | 'doctor' | 'admin';
  cancellationTime?: string;
  rescheduledFrom?: string; // ID of original appointment
  appointmentFile?: string; // Path to appointment document or notes
}

export interface Prescription {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorId: string;
  pharmacyName?: string;
  date: string;
  medications: { name: string; dosage: string; frequency: string; duration: string }[];
  status: 'active' | 'dispensed' | 'expired';
  pharmacyId?: string;
  // New fields for refill management
  refillsAllowed?: number;
  refillsUsed?: number;
  refillRequests?: Array<{ id: string; requestDate: string; status: 'pending' | 'approved' | 'dispensed'; dispensedDate?: string }>;
  expiryDate?: string;
}

// CRITICAL: Allergy Management System
export interface PatientAllergy {
  id: string;
  patientId: string;
  patientName?: string;
  allergen: string; // e.g. "Penicillin", "Shellfish", "Latex"
  allergyType: 'medication' | 'food' | 'environmental' | 'latex' | 'other';
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction: string; // e.g. "Rash", "Anaphylaxis", "Itching"
  dateIdentified: string;
  addedDate: string;
  status: 'active' | 'resolved' | 'suspected';
  notes?: string;
}

// Drug Interaction Database
export interface DrugInteraction {
  id: string;
  drug1: string;
  drug2: string;
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  management: string; // What to do about the interaction
  evidenceLevel: string; // Clinical evidence level
}

// Electronic Health Record (EHR)
export interface PatientMedicalHistory {
  id: string;
  patientId: string;
  conditions: Array<{
    id: string;
    name: string;
    dateOnset: string;
    status: 'active' | 'resolved' | 'chronic';
    notes?: string;
  }>;
  surgeries: Array<{
    id: string;
    name: string;
    date: string;
    surgeon: string;
    hospital: string;
    notes?: string;
  }>;
  familyHistory: Array<{
    id: string;
    relation: string; // "mother", "father", "sibling", etc
    condition: string;
  }>;
  socialHistory: {
    smoking: 'never' | 'former' | 'current';
    alcohol: string;
    drugs: string;
    occupation?: string;
    lastUpdated?: string;
  };
  vaccinations: Array<{
    id: string;
    name: string;
    date: string;
    nextDue?: string;
    provider?: string;
  }>;
  lastUpdated: string;
}

// Patient Consent and Compliance
export interface PatientConsent {
  id: string;
  patientId: string;
  consentType: 'hipaa' | 'research' | 'treatment' | 'medication' | 'procedure';
  consentedDate: string;
  expiryDate?: string;
  status: 'active' | 'expired' | 'revoked';
  consentText?: string;
  revokedDate?: string;
  revokedReason?: string;
}

// Clinical Notes for Doctor Visits
export interface ClinicalNote {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  type: 'visit' | 'consultation' | 'follow-up' | 'procedure';
  subjective: string; // Chief complaints and history
  objective: string; // Exam findings, vital signs, test results
  assessment: string; // Diagnosis and clinical impression
  plan: string; // Treatment plan and next steps
  problemIds?: string[]; // Links to problem list
  prescriptionIds?: string[]; // Associated prescriptions
  referralIds?: string[]; // Associated referrals
  status: 'draft' | 'completed' | 'signed';
}

// Patient Problem List (Active Health Issues)
export interface PatientProblem {
  id: string;
  patientId: string;
  problem: string; // e.g. "Type 2 Diabetes", "Hypertension"
  icd10Code?: string; // Medical code
  dateIdentified: string;
  status: 'active' | 'resolved';
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
  treatments?: string[]; // Related prescription IDs or treatment names
}

// Medication Adherence Tracking
export interface MedicationAdherence {
  id: string;
  patientId: string;
  prescriptionId: string;
  medicationName: string;
  startDate: string;
  dueDate?: string;
  adherencePercentage: number; // 0-100
  missedDoses: number;
  totalDoses: number;
  lastDoseDate?: string;
  notes?: string;
}

// BILLING & PAYMENT SYSTEM (Ghana-specific)

// Provider Pricing - Doctor sets their own rates
export interface ProviderPricing {
  id: string;
  providerId: string; // Doctor ID
  providerName: string;
  serviceType: 'consultation' | 'procedure' | 'test' | 'imaging' | 'follow-up' | 'other';
  serviceDescription: string; // e.g. "General Consultation"
  priceGHS: number; // Price in Ghana Cedis
  lastUpdated: string;
  currency: 'GHS'; // Ghana Cedi
  notes?: string; // Any special notes about pricing
}

// Service Charge - Charge applied to an appointment/service
export interface ServiceCharge {
  id: string;
  patientId: string;
  appointmentId?: string; // Link to appointment if applicable
  providerId: string;
  providerName: string;
  serviceType: 'consultation' | 'procedure' | 'test' | 'imaging' | 'follow-up' | 'other';
  serviceDescription: string;
  amountGHS: number; // Charge in GHS
  chargeDate: string;
  invoiceId?: string; // Link to invoice if billed
  status: 'pending' | 'invoiced' | 'paid' | 'written-off';
  notes?: string;
}

// Invoice - Patient bill
export interface Invoice {
  id: string; // Invoice number: INV-2026-0001
  patientId: string;
  patientName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmountGHS: number;
  amountPaidGHS: number;
  outstandingAmountGHS: number;
  currency: 'GHS';
  lineItems: Array<{
    id: string;
    description: string;
    amountGHS: number;
    serviceChargeId: string;
    quantity?: number;
  }>;
  paymentMethods?: Array<{
    method: 'mobile-money' | 'bank-transfer' | 'cash' | 'insurance';
    amountGHS: number;
    date: string;
    transactionId?: string;
  }>;
  status: 'draft' | 'issued' | 'partially-paid' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
}

// Appointment Reminders - Smart notification system
export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  doctorName: string;
  doctorId: string;
  reminderType: '24h' | '1h' | '15m'; // Hours/minutes before appointment
  notificationMethod: 'email' | 'sms' | 'in-app';
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  sentAt?: string;
  acknowledgedAt?: string;
  message: string;
  appointmentMode: 'telemedicine' | 'in-person';
  location?: string; // For in-person appointments
  notes?: string;
}

// Billing Record - Admin audit trail
export interface BillingRecord {
  id: string;
  timestamp: string;
  action: 'pricing-created' | 'pricing-updated' | 'pricing-deleted' | 'charge-created' | 'invoice-created' | 'payment-recorded' | 'invoice-cancelled';
  actionBy: string; // admin or provider id
  actionByName: string;
  affectedPatientId?: string;
  affectedProviderId?: string;
  relatedInvoiceId?: string;
  relatedChargeId?: string;
  amountGHS?: number;
  details: string; // Description of what happened
  ipAddress?: string;
}

export interface LabTest {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorId: string;
  destinationProviderName?: string;
  testName: string;
  date: string;
  status: 'requested' | 'in-progress' | 'completed' | 'cancelled';
  results?: string;
  labId?: string;
  // New fields for document management
  documentUrl?: string;
  referenceRange?: string;
  notes?: string;
}

export interface ImagingScan {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorId: string;
  destinationProviderName?: string;
  scanType: 'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound' | 'PET Scan' | 'DEXA Scan';
  date: string;
  status: 'requested' | 'in-progress' | 'completed' | 'cancelled';
  results?: string;
  centerId?: string;
  bodyPart?: string;
  clinicalIndication?: string;
  impression?: string;
  reportUrl?: string;
  imageUrl?: string;
  postdicomStudyId?: string;
  postdicomStudyUrl?: string;
  reportFile?: {
    fileId: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    uploadTime?: string;
    downloadUrl?: string;
  };
  imageFiles?: Array<{
    fileId: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    uploadTime?: string;
    downloadUrl?: string;
  }>;
  scheduledAt?: string;
  completedAt?: string;
}

export interface AmbulanceRequest {
  id: string;
  patientName: string;
  patientId: string;
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  date: string;
  time: string;
  status: 'requested' | 'accepted' | 'dispatched' | 'en-route' | 'arrived' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  vehicleId?: string;
  assignedAmbulanceId?: string;
  acceptedAt?: string;
  dispatchedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  type: 'appointment' | 'consultation' | 'lab_test' | 'lab_result' | 'imaging' | 'imaging_result' | 'prescription' | 'ambulance';
  title: string;
  description: string;
  date: string;
  time: string;
  provider?: string;
  status: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'appointment' | 'result' | 'prescription' | 'emergency' | 'system';
  read: boolean;
  date: string;
  time: string;
}

export interface PharmacyItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  unit: string;
  reorderLevel: number;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: string;
  status: 'available' | 'dispatched' | 'maintenance';
  crew: string;
  location: string;
}

// Doctor availability data for telemedicine platform
export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualifications: string[];
  experience: number; // years
  profileImage?: string;
  rating: number; // 1-5
  reviewCount: number;
  consultationFee: number;
  status: 'available' | 'busy' | 'offline';
  availableHours: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }[];
  slotDuration: number; // minutes, typically 30 or 60
}

export interface ImagingCenter {
  id: string;
  name: string;
  location: string;
  phone: string;
  availableScanTypes: string[];
  rating: number;
}

export interface Laboratory {
  id: string;
  name: string;
  location: string;
  phone: string;
  availableTests: string[];
  rating: number;
}

export interface Hospital {
  id: string;
  name: string;
  location: string;
  phone: string;
  bedCount: number;
  rating: number;
  specialties: string[];
}

// PHASE 2: Health Metrics & Vitals
export interface VitalSigns {
  id: string;
  patientId: string;
  timestamp: string;
  heartRate: number; // bpm
  systolicBP: number; // mm Hg (top number)
  diastolicBP: number; // mm Hg (bottom number)
  temperature: number; // Celsius
  oxygenLevel: number; // %
  weight: number; // kg
  notes?: string;
}

export interface HealthMetric {
  id: string;
  patientId: string;
  type: 'heart_rate' | 'blood_pressure' | 'temperature' | 'oxygen' | 'weight' | 'glucose' | 'sleep';
  date: string;
  value: number | string;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}

// PHASE 2: Pharmacy Inventory
export interface InventoryItem {
  id: string;
  name: string;
  category: 'medication' | 'supply' | 'equipment';
  stock: number;
  reorderLevel: number;
  price: number;
  unit: string;
  expiryDate?: string;
  supplier?: string;
  lastRestocked?: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

// PHASE 2: Ambulance Fleet Management
export interface AmbulanceVehicle {
  id: string;
  callSign: string;
  plateNumber: string;
  type: 'Type-A' | 'Type-B' | 'Type-C'; // different emergency levels
  status: 'available' | 'dispatched' | 'in-transit' | 'on-scene' | 'returning' | 'maintenance';
  latitude?: number;
  longitude?: number;
  crew: { name: string; role: 'driver' | 'paramedic' | 'emt' }[];
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  fuel: number; // percentage
  equipment: string[];
}

export type ReferralType = 'hospital' | 'laboratory' | 'imaging' | 'pharmacy';

// PHASE 2: Referrals — distinct queues (hospital/specialist, lab, imaging, pharmacy)
export interface Referral {
  id: string;
  referralType: ReferralType;
  patientId: string;
  patientName: string;
  fromDoctorId: string;
  fromDoctorName: string;
  destinationProviderId?: string;
  destinationProviderName?: string;
  destinationProviderRole?: 'hospital' | 'laboratory' | 'imaging' | 'pharmacy' | 'physiotherapist';
  toDepartmentId: string;
  toDepartment: string;
  reason: string;
  date: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  lastUpdated: string;
  notes?: string;
}

// PHASE 2: Provider verifications
export interface ProviderVerification {
  id: string;
  providerId: string;
  name: string;
  email: string;
  role: 'doctor' | 'hospital' | 'laboratory' | 'imaging' | 'pharmacy' | 'ambulance';
  documents: string;
  appliedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  verifiedBy?: string;
  verificationDate?: string;
  notes?: string;
}
