import { createContext } from 'react';
import type { AmbulanceRequest, AmbulanceVehicle, Appointment, HealthMetric, ImagingScan, InventoryItem, LabTest, Prescription, ProviderVerification, Referral, VitalSigns, PatientAllergy, PatientMedicalHistory, PatientConsent, DrugInteraction, ClinicalNote, PatientProblem, MedicationAdherence, ProviderPricing, ServiceCharge, Invoice, BillingRecord, AppointmentReminder } from '@/data/mockData';

export interface AppDataContextType {
  // Loading state
  isLoading: boolean;
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
  // Critical new features
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
  drugInteractionDatabase: DrugInteraction[];
  
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, update: (appointment: Appointment) => Appointment) => void;
  cancelAppointment: (id: string, reason: string, cancelledBy: 'patient' | 'doctor' | 'admin') => void;
  confirmAppointment: (id: string) => void;
  rescheduleAppointment: (id: string, newDate: string, newTime: string) => void;
  /** Re-fetch appointments, prescriptions, allergies, labs, and imaging from the API (silent refresh). */
  refreshAppData: () => Promise<void>;
  
  addPrescription: (prescription: Prescription) => void;
  updatePrescription: (id: string, update: (prescription: Prescription) => Prescription) => void;
  requestPrescriptionRefill: (prescriptionId: string) => void;
  
  addLabTest: (test: LabTest) => void;
  updateLabTest: (id: string, update: (test: LabTest) => LabTest) => void;
  addImagingScan: (scan: ImagingScan) => void;
  updateImagingScan: (id: string, update: (scan: ImagingScan) => ImagingScan) => void;
  addAmbulanceRequest: (request: AmbulanceRequest) => void;
  updateAmbulanceRequest: (id: string, update: (request: AmbulanceRequest) => AmbulanceRequest) => void;
  addVitalSigns: (vital: VitalSigns) => void;
  addHealthMetric: (metric: HealthMetric) => void;
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (id: string, update: (item: InventoryItem) => InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
  addAmbulance: (ambulance: AmbulanceVehicle) => void;
  updateAmbulance: (id: string, update: (ambulance: AmbulanceVehicle) => AmbulanceVehicle) => void;
  deleteAmbulance: (id: string) => void;
  addReferral: (referral: Referral) => Promise<void>;
  updateReferral: (id: string, update: (referral: Referral) => Referral) => void;
  addProviderVerification: (verification: ProviderVerification) => void;
  updateProviderVerification: (id: string, update: (verification: ProviderVerification) => ProviderVerification) => void;
  
  // Allergy and drug interaction management
  addAllergy: (allergy: PatientAllergy) => void;
  removeAllergy: (allergyId: string) => void;
  addMedicalHistory: (history: PatientMedicalHistory) => void;
  updateMedicalHistory: (id: string, update: (history: PatientMedicalHistory) => PatientMedicalHistory) => void;
  addPatientConsent: (consent: PatientConsent) => void;
  updatePatientConsent: (id: string, update: (consent: PatientConsent) => PatientConsent) => void;
  checkDrugInteractions: (medications: string[]) => DrugInteraction[];
  getPatientAllergies: (patientId: string) => PatientAllergy[];
  
  // Clinical Notes Management (P2)
  addClinicalNote: (note: ClinicalNote) => void;
  updateClinicalNote: (id: string, update: (note: ClinicalNote) => ClinicalNote) => void;
  
  // Patient Problem List Management (P2)
  addPatientProblem: (problem: PatientProblem) => void;
  updatePatientProblem: (id: string, update: (problem: PatientProblem) => PatientProblem) => void;
  
  // Medication Adherence Tracking (P2)
  updateMedicationAdherence: (id: string, update: (adherence: MedicationAdherence) => MedicationAdherence) => void;
  recordMedicationAdherence: (adherence: MedicationAdherence) => void;
  
  // Billing & Payment System (Ghana-specific)
  setProviderPricing: (pricing: ProviderPricing) => void;
  deleteProviderPricing: (pricingId: string) => void;
  getProviderPricing: (providerId: string) => ProviderPricing[];
  createServiceCharge: (charge: ServiceCharge) => void;
  createInvoice: (invoice: Invoice) => void;
  recordPayment: (invoiceId: string, paymentMethod: 'mobile-money' | 'bank-transfer' | 'cash' | 'insurance', amountGHS: number) => void;
  getPatientBalance: (patientId: string) => number;
  addBillingRecord: (record: BillingRecord) => void;
  getClinicalNotes: (patientId: string) => ClinicalNote[];
  getPatientProblems: (patientId: string) => PatientProblem[];
  getAllBillingRecords: () => BillingRecord[];
  getInvoices: (patientId: string) => Invoice[];
  
  // Smart Appointment Reminders
  appointmentReminders: AppointmentReminder[];
  generateAppointmentReminders: (appointmentId: string, reminderTypes: ('24h' | '1h' | '15m')[]) => void;
  sendReminder: (reminderId: string, method: 'email' | 'sms' | 'in-app') => void;
  acknowledgeReminder: (reminderId: string, patientId: string) => void;
  getPatientReminders: (patientId: string) => AppointmentReminder[];
  getReminderByAppointment: (appointmentId: string) => AppointmentReminder[];
  updateReminderStatus: (reminderId: string, status: 'pending' | 'sent' | 'failed' | 'acknowledged') => void;
}

export const AppDataContext = createContext<AppDataContextType | null>(null);
