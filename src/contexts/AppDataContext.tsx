import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AmbulanceRequest, Appointment, ImagingScan, LabTest, Prescription, VitalSigns, HealthMetric, InventoryItem, AmbulanceVehicle, Referral, ProviderVerification, PatientAllergy, PatientMedicalHistory, PatientConsent, DrugInteraction, ClinicalNote, PatientProblem, MedicationAdherence, ProviderPricing, ServiceCharge, Invoice, BillingRecord, AppointmentReminder } from '@/data/mockData';
import { drugInteractionDatabase } from '@/data/drugInteractionReference';
import { AppDataContext, type AppDataContextType } from './app-data-context';
import { appointmentsApi, prescriptionsApi, allergiesApi, api, referralsApi, recordsApi, ambulanceApi, type ImagingFileAsset } from '@/lib/apiService';
import { useAuth } from './useAuth';
import { buildScheduledIso } from '@/lib/appointmentUtils';
import {
  type BackendAllergy,
  type BackendAmbulanceRequest,
  type BackendAppointment,
  type BackendImagingScan,
  type BackendLabTest,
  type BackendPrescription,
  type BackendReferral,
  type StoredAppData,
  emptyData,
  getListPayload,
  mapBackendAllergy,
  mapBackendAmbulanceRequest,
  mapBackendAppointment,
  mapBackendImagingScan,
  mapBackendLabTest,
  mapBackendPrescription,
  mapBackendReferral,
} from './app-data-mappers';

type StructuredRecordRow<T> = {
  id: string;
  record_type: string;
  patient_id?: number | null;
  provider_id?: number | null;
  created_by?: number | null;
  appointment_id?: number | null;
  status?: string | null;
  payload: T;
  created_at: string;
  updated_at: string;
};

type PrescriptionRefillRequest = {
  id: string;
  prescriptionId: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'dispensed';
  dispensedDate?: string;
};


const labStatusToApi = (s: LabTest['status']): string => {
  if (s === 'requested') return 'ordered';
  if (s === 'in-progress') return 'processing';
  if (s === 'completed') return 'completed';
  return 'cancelled';
};

const imagingStatusToApi = (s: ImagingScan['status']): string => {
  if (s === 'requested') return 'ordered';
  if (s === 'in-progress') return 'in_progress';
  if (s === 'completed') return 'completed';
  return 'cancelled';
};

const labPayloadFromDelta = (prev: LabTest, next: LabTest): Record<string, unknown> => {
  const p: Record<string, unknown> = {};
  if (prev.status !== next.status) p.status = labStatusToApi(next.status);
  if (prev.results !== next.results) {
    if (next.results != null && next.results !== '') p.result_notes = next.results;
  }
  if (prev.referenceRange !== next.referenceRange) p.reference_range = next.referenceRange ?? null;
  if (prev.notes !== next.notes) p.result_notes = next.notes ?? null;
  if (prev.documentUrl !== next.documentUrl) p.result_file_url = next.documentUrl ?? null;
  if (next.status === 'completed' && prev.status !== 'completed') {
    p.completed_at = new Date().toISOString();
  }
  return p;
};

const imagingPayloadFromDelta = (prev: ImagingScan, next: ImagingScan): Record<string, unknown> => {
  const p: Record<string, unknown> = {};
  if (prev.status !== next.status) p.status = imagingStatusToApi(next.status);
  if (prev.results !== next.results && next.results != null && next.results !== '') p.findings = next.results;
  if (next.status === 'completed' && prev.status !== 'completed') {
    p.completed_at = new Date().toISOString();
  }
  return p;
};

const toOptionalNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const INITIAL_API_PAGE_SIZE = 100;
const STRUCTURED_RECORD_PAGE_SIZE = 100;

const loadStructuredPayloads = async <T extends { id?: string }>(recordType: string): Promise<T[]> => {
  try {
    const response = await recordsApi.listRecords<T>(recordType, { skip: 0, limit: STRUCTURED_RECORD_PAGE_SIZE });
    return getListPayload<StructuredRecordRow<T>>(response).map((record) => {
      const payload = record.payload;
      if (payload && typeof payload === 'object') {
        return {
          ...payload,
          id: String((payload as { id?: string }).id ?? record.id),
        } as T;
      }
      return payload;
    });
  } catch (error) {
    console.error(`Failed to load structured records for ${recordType}:`, error);
    return [];
  }
};

const createReminderFlags = (appointments: Appointment[], reminders: AppointmentReminder[]): Appointment[] => {
  const reminderMap = new Map<string, AppointmentReminder[]>();
  reminders.forEach((reminder) => {
    const bucket = reminderMap.get(reminder.appointmentId) ?? [];
    bucket.push(reminder);
    reminderMap.set(reminder.appointmentId, bucket);
  });

  return appointments.map((appointment) => {
    const appointmentReminders = reminderMap.get(appointment.id) ?? [];
    return {
      ...appointment,
      reminder24hSent: appointmentReminders.some((reminder) => reminder.reminderType === '24h' && reminder.status !== 'pending'),
      reminder1hSent: appointmentReminders.some((reminder) => reminder.reminderType === '1h' && reminder.status !== 'pending'),
      reminder15mSent: appointmentReminders.some((reminder) => reminder.reminderType === '15m' && reminder.status !== 'pending'),
    };
  });
};

const attachPrescriptionRefills = (
  prescriptions: Prescription[],
  refillRequests: PrescriptionRefillRequest[],
): Prescription[] => {
  const grouped = new Map<string, PrescriptionRefillRequest[]>();
  refillRequests.forEach((request) => {
    const bucket = grouped.get(request.prescriptionId) ?? [];
    bucket.push(request);
    grouped.set(request.prescriptionId, bucket);
  });

  return prescriptions.map((prescription) => {
    const total = prescription.refillsAllowed ?? prescription.refillsUsed ?? 0;
    const used = prescription.refillsUsed ?? Math.max(0, total - (prescription.refillsAllowed ?? total));
    return {
      ...prescription,
      refillsAllowed: total,
      refillsUsed: used,
      refillRequests: grouped.get(prescription.id) ?? [],
    };
  });
};

type StructuredRecordScope = {
  created_by?: number | null;
  patient_id?: number | null;
  provider_id?: number | null;
  appointment_id?: number | null;
  status?: string | null;
};

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, getUsers } = useAuth();

  const [data, setData] = useState<StoredAppData>(emptyData);
  const [isLoadingAPI, setIsLoadingAPI] = useState(true);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const loadAPIData = useCallback(async (isPolling = false) => {
    if (!user) {
      if (!isPolling) {
        setData(emptyData);
        setIsLoadingAPI(false);
      }
      return;
    }

    try {
      const [
        appointmentsRaw,
        prescriptionsRaw,
        allergiesRaw,
        labRaw,
        imagingRaw,
        referralsRaw,
        ambulanceRaw,
        vitalSigns,
        healthMetrics,
        inventoryItems,
        ambulances,
        patientConsents,
        medicalHistories,
        clinicalNotes,
        patientProblems,
        medicationAdherence,
        providerPricing,
        serviceCharges,
        invoices,
        billingRecords,
        appointmentReminders,
        prescriptionRefillRequests,
      ] = await Promise.all([
        appointmentsApi.listAppointments(0, INITIAL_API_PAGE_SIZE).catch(() => []),
        prescriptionsApi.listPrescriptions(0, INITIAL_API_PAGE_SIZE).catch(() => []),
        allergiesApi.listAllergies({ skip: 0, limit: INITIAL_API_PAGE_SIZE }).catch(() => []),
        api.labTests.listLabTests(0, INITIAL_API_PAGE_SIZE).catch(() => []),
        api.imaging.listImagingScans(0, INITIAL_API_PAGE_SIZE).catch(() => []),
        referralsApi.listReferrals(0, INITIAL_API_PAGE_SIZE).catch(() => []),
        ambulanceApi.listRequests(0, INITIAL_API_PAGE_SIZE).catch(() => []),
        loadStructuredPayloads<VitalSigns>('vital_sign'),
        loadStructuredPayloads<HealthMetric>('health_metric'),
        loadStructuredPayloads<InventoryItem>('inventory_item'),
        loadStructuredPayloads<AmbulanceVehicle>('ambulance_vehicle'),
        loadStructuredPayloads<PatientConsent>('patient_consent'),
        loadStructuredPayloads<PatientMedicalHistory>('medical_history'),
        loadStructuredPayloads<ClinicalNote>('clinical_note'),
        loadStructuredPayloads<PatientProblem>('patient_problem'),
        loadStructuredPayloads<MedicationAdherence>('medication_adherence'),
        loadStructuredPayloads<ProviderPricing>('provider_pricing'),
        loadStructuredPayloads<ServiceCharge>('service_charge'),
        loadStructuredPayloads<Invoice>('invoice'),
        loadStructuredPayloads<BillingRecord>('billing_record'),
        loadStructuredPayloads<AppointmentReminder>('appointment_reminder'),
        loadStructuredPayloads<PrescriptionRefillRequest>('prescription_refill_request'),
      ]);

      const appointments = createReminderFlags(
        getListPayload<BackendAppointment>(appointmentsRaw).map(mapBackendAppointment),
        appointmentReminders,
      );

      const prescriptions = attachPrescriptionRefills(
        getListPayload<BackendPrescription>(prescriptionsRaw).map(mapBackendPrescription),
        prescriptionRefillRequests,
      );

      const patientAllergies = getListPayload<BackendAllergy>(allergiesRaw).map(mapBackendAllergy);
      const labTests = getListPayload<BackendLabTest>(labRaw).map(mapBackendLabTest);
      const imagingScans = getListPayload<BackendImagingScan>(imagingRaw).map(mapBackendImagingScan);
      const referrals = getListPayload<BackendReferral>(referralsRaw).map(mapBackendReferral);
      const ambulanceRequests = getListPayload<BackendAmbulanceRequest>(ambulanceRaw).map((request) => {
        const patient = getUsers().find((account) => account.id === String(request.patient_id));
        return mapBackendAmbulanceRequest(request, patient?.name);
      });
      const providerVerifications = getUsers()
        .filter((account) => account.role !== 'patient' && account.role !== 'admin')
        .map((account): ProviderVerification => ({
          id: account.id,
          providerId: account.id,
          name: account.name,
          email: account.email,
          role: account.role as ProviderVerification['role'],
          documents: account.profile?.bio?.trim() || 'Professional credentials on file',
          appliedDate: account.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          status: account.isVerified ? 'approved' : account.isActive === false ? 'rejected' : 'pending',
          verificationDate: account.isVerified ? account.lastLogin?.slice(0, 10) : undefined,
          notes: account.profile?.bio || undefined,
        }));

      setData({
        ...emptyData,
        appointments,
        prescriptions,
        labTests,
        imagingScans,
        ambulanceRequests,
        vitalSigns,
        healthMetrics,
        inventoryItems,
        ambulances,
        referrals,
        patientAllergies,
        medicalHistories,
        patientConsents,
        clinicalNotes,
        patientProblems,
        medicationAdherence,
        providerPricing,
        serviceCharges,
        invoices,
        billingRecords,
        appointmentReminders,
        providerVerifications,
      });
    } catch (error) {
      if (!isPolling) console.error('Failed to load API data:', error);
    } finally {
      if (!isPolling) setIsLoadingAPI(false);
    }
  }, [getUsers, user]);

  const refreshAppData = useCallback(async () => {
    await loadAPIData(true);
  }, [loadAPIData]);

  const upsertStructuredRecord = useCallback(async <T extends { id: string }>(
    recordType: string,
    entity: T,
    collectionKey: keyof StoredAppData,
    scope: StructuredRecordScope = {},
  ) => {
    const collection = dataRef.current[collectionKey];
    const exists = Array.isArray(collection) && collection.some((item) => typeof item === 'object' && item !== null && String((item as { id?: string }).id) === entity.id);

    const createdBy = scope.created_by;
    const payload = {
      id: entity.id,
      record_type: recordType,
      ...(createdBy !== undefined ? { created_by: createdBy } : {}),
      patient_id: scope.patient_id ?? null,
      provider_id: scope.provider_id ?? null,
      appointment_id: scope.appointment_id ?? null,
      status: scope.status ?? null,
      payload: entity,
    };

    if (exists) {
      await recordsApi.updateRecord(entity.id, payload);
    } else {
      await recordsApi.createRecord(payload);
    }

    await loadAPIData(true);
  }, [loadAPIData]);

  const updateStructuredRecord = useCallback(async <T extends { id: string }>(
    recordType: string,
    entity: T,
    collectionKey: keyof StoredAppData,
    scope: StructuredRecordScope = {},
  ) => {
    const collection = dataRef.current[collectionKey];
    const exists = Array.isArray(collection) && collection.some((item) => typeof item === 'object' && item !== null && String((item as { id?: string }).id) === entity.id);

    const createdBy = scope.created_by;
    const payload = {
      ...(createdBy !== undefined ? { created_by: createdBy } : {}),
      patient_id: scope.patient_id ?? null,
      provider_id: scope.provider_id ?? null,
      appointment_id: scope.appointment_id ?? null,
      status: scope.status ?? null,
      payload: entity,
    };

    if (exists) {
      await recordsApi.updateRecord(entity.id, payload);
    } else {
      await recordsApi.createRecord({
        id: entity.id,
        record_type: recordType,
        ...payload,
      });
    }

    await loadAPIData(true);
  }, [loadAPIData]);

  const persistBillingRecord = useCallback(async (record: BillingRecord) => {
    await upsertStructuredRecord('billing_record', record, 'billingRecords', {
      created_by: toOptionalNumber(user?.id),
    });
  }, [upsertStructuredRecord, user?.id]);

  useEffect(() => {
    let active = true;
    void loadAPIData();

    const interval = window.setInterval(() => {
      if (active) {
        void loadAPIData(true);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (active && document.visibilityState === 'visible') {
        void loadAPIData(true);
      }
    };

    const handleOnline = () => {
      if (active) {
        void loadAPIData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [loadAPIData]);

  const contextValue = useMemo<AppDataContextType>(() => ({
    isLoading: isLoadingAPI,
    appointments: data.appointments,
    prescriptions: data.prescriptions,
    labTests: data.labTests,
    imagingScans: data.imagingScans,
    ambulanceRequests: data.ambulanceRequests,
    vitalSigns: data.vitalSigns,
    healthMetrics: data.healthMetrics,
    inventoryItems: data.inventoryItems,
    ambulances: data.ambulances,
    referrals: data.referrals,
    providerVerifications: data.providerVerifications,
    patientAllergies: data.patientAllergies,
    medicalHistories: data.medicalHistories,
    patientConsents: data.patientConsents,
    clinicalNotes: data.clinicalNotes,
    patientProblems: data.patientProblems,
    medicationAdherence: data.medicationAdherence,
    providerPricing: data.providerPricing,
    serviceCharges: data.serviceCharges,
    invoices: data.invoices,
    billingRecords: data.billingRecords,
    drugInteractionDatabase,
    
    addAppointment: (appointment) => {
      void (async () => {
        try {
          await appointmentsApi.createAppointment({
            provider_id: Number(appointment.doctorId),
            title: appointment.type,
            description: appointment.notes,
            appointment_type: appointment.appointmentMode === 'telemedicine' ? 'telehealth' : 'in_person',
            scheduled_time: buildScheduledIso(appointment.date, appointment.time),
            duration_minutes: 30,
            location: appointment.appointmentMode === 'in-person' ? appointment.notes : undefined,
            notes: appointment.notes,
          });
          await loadAPIData(true);
        } catch (error) {
          console.error('addAppointment failed:', error);
        }
      })();
    },
    updateAppointment: (id, update) => {
      void (async () => {
        const prev = dataRef.current.appointments.find((appointment) => appointment.id === id);
        if (!prev) return;
        const next = update(prev);

        const payload: Record<string, unknown> = {};
        if (next.type !== prev.type) payload.title = next.type;
        if (next.notes !== prev.notes) payload.notes = next.notes ?? null;
        if (next.date !== prev.date || next.time !== prev.time) {
          payload.scheduled_time = buildScheduledIso(next.date, next.time);
        }
        if (next.status !== prev.status) {
          payload.status = next.status === 'confirmed-by-doctor' ? 'confirmed' : next.status;
        }
        if (next.notes !== prev.notes) payload.description = next.notes ?? null;
        if (next.appointmentMode !== prev.appointmentMode) {
          payload.appointment_type = next.appointmentMode === 'telemedicine' ? 'telehealth' : 'in_person';
        }

        try {
          if (Object.keys(payload).length > 0) {
            await appointmentsApi.updateAppointment(id, payload as Parameters<typeof appointmentsApi.updateAppointment>[1]);
          }

          const reminderOps: Promise<unknown>[] = [];
          const reminderBase = {
            appointmentId: id,
            patientId: next.patientId,
            patientName: next.patientName,
            doctorId: next.doctorId,
            doctorName: next.doctorName,
            appointmentDate: next.date,
            appointmentTime: next.time,
            appointmentMode: next.appointmentMode,
            message: `Reminder: You have an appointment with ${next.doctorName} on ${next.date} at ${next.time}.`,
            notificationMethod: 'in-app' as const,
          };

          if (!prev.reminder24hSent && next.reminder24hSent) {
            reminderOps.push(recordsApi.createRecord<AppointmentReminder>({
              id: `reminder-${id}-24h`,
              record_type: 'appointment_reminder',
              patient_id: Number(next.patientId),
              provider_id: Number(next.doctorId),
              appointment_id: Number(id),
              status: 'sent',
              payload: {
                ...reminderBase,
                id: `reminder-${id}-24h`,
                reminderType: '24h',
                status: 'sent',
                sentAt: new Date().toISOString(),
              },
            }));
          }

          if (!prev.reminder1hSent && next.reminder1hSent) {
            reminderOps.push(recordsApi.createRecord<AppointmentReminder>({
              id: `reminder-${id}-1h`,
              record_type: 'appointment_reminder',
              patient_id: Number(next.patientId),
              provider_id: Number(next.doctorId),
              appointment_id: Number(id),
              status: 'sent',
              payload: {
                ...reminderBase,
                id: `reminder-${id}-1h`,
                reminderType: '1h',
                status: 'sent',
                sentAt: new Date().toISOString(),
              },
            }));
          }

          if (!prev.reminder15mSent && next.reminder15mSent) {
            reminderOps.push(recordsApi.createRecord<AppointmentReminder>({
              id: `reminder-${id}-15m`,
              record_type: 'appointment_reminder',
              patient_id: Number(next.patientId),
              provider_id: Number(next.doctorId),
              appointment_id: Number(id),
              status: 'sent',
              payload: {
                ...reminderBase,
                id: `reminder-${id}-15m`,
                reminderType: '15m',
                status: 'sent',
                sentAt: new Date().toISOString(),
              },
            }));
          }

          if (reminderOps.length > 0) {
            await Promise.all(reminderOps);
          }

          await loadAPIData(true);
        } catch (error) {
          console.error('updateAppointment failed:', error);
        }
      })();
    },
    cancelAppointment: (id, reason, cancelledBy) => {
      void (async () => {
        try {
          await appointmentsApi.updateAppointment(id, {
            status: 'cancelled',
            cancellation_reason: reason,
          });
          await loadAPIData(true);
        } catch (error) {
          console.error('cancelAppointment failed:', error);
        }
      })();
      void cancelledBy;
    },
    confirmAppointment: (id) => {
      void (async () => {
        try {
          await appointmentsApi.updateAppointment(id, { status: 'confirmed' });
          await loadAPIData(true);
        } catch (error) {
          console.error('confirmAppointment failed:', error);
        }
      })();
    },
    rescheduleAppointment: (id, newDate, newTime) => {
      void (async () => {
        try {
          const scheduled_time = buildScheduledIso(newDate, newTime);
          await appointmentsApi.updateAppointment(id, {
            scheduled_time,
            status: 'rescheduled',
          });
          await loadAPIData(true);
        } catch (error) {
          console.error('rescheduleAppointment failed:', error);
        }
      })();
    },
    refreshAppData,
    
    addPrescription: (prescription) => {
      void (async () => {
        try {
          await prescriptionsApi.createPrescription({
            patient_id: Number(prescription.patientId),
            pharmacy_id: Number(prescription.pharmacyId),
            medication_name: prescription.medications[0]?.name || 'Medication',
            dosage: prescription.medications[0]?.dosage || 'As directed',
            dosage_unit: prescription.medications[0]?.dosage.split(' ').slice(1).join(' ') || 'unit',
            frequency: prescription.medications[0]?.frequency || 'As directed',
            route: 'oral',
            instructions: prescription.medications[0]?.duration,
            quantity: undefined,
            refills: prescription.refillsAllowed ?? 0,
            start_date: new Date(`${prescription.date}T00:00:00Z`).toISOString(),
            end_date: undefined,
          });
          await loadAPIData(true);
        } catch (error) {
          console.error('addPrescription failed:', error);
        }
      })();
    },
    updatePrescription: (id, update) => {
      void (async () => {
        const prev = dataRef.current.prescriptions.find((prescription) => prescription.id === id);
        if (!prev) return;
        const next = update(prev);

        const firstMedication = next.medications[0] ?? prev.medications[0];
        const payload: Record<string, unknown> = {};
        if (firstMedication?.name && firstMedication.name !== prev.medications[0]?.name) {
          payload.medication_name = firstMedication.name;
        }
        if (firstMedication?.dosage && firstMedication.dosage !== prev.medications[0]?.dosage) {
          payload.dosage = firstMedication.dosage;
        }
        if (firstMedication?.frequency && firstMedication.frequency !== prev.medications[0]?.frequency) {
          payload.frequency = firstMedication.frequency;
        }
        if (firstMedication?.duration && firstMedication.duration !== prev.medications[0]?.duration) {
          payload.instructions = firstMedication.duration;
        }
        if (next.status !== prev.status) {
          payload.status = next.status;
        }

        const refillsAllowed = next.refillsAllowed ?? prev.refillsAllowed ?? 0;
        const refillsUsed = next.refillsUsed ?? prev.refillsUsed ?? 0;
        if (refillsAllowed !== (prev.refillsAllowed ?? 0)) payload.refills = refillsAllowed;
        if (refillsUsed !== (prev.refillsUsed ?? 0)) payload.refills_remaining = Math.max(0, refillsAllowed - refillsUsed);

        try {
          if (Object.keys(payload).length > 0) {
            await prescriptionsApi.updatePrescription(Number(id), payload);
          }

          const previousRefills = prev.refillRequests ?? [];
          const nextRefills = next.refillRequests ?? [];
          const refillUpdates = nextRefills.filter((refill) => {
            const prior = previousRefills.find((item) => item.id === refill.id);
            return !prior || prior.status !== refill.status || prior.dispensedDate !== refill.dispensedDate;
          });

          if (refillUpdates.length > 0) {
            await Promise.all(refillUpdates.map((refill) => recordsApi.updateRecord(refill.id, {
              payload: {
                ...refill,
                prescriptionId: id,
              },
            })));
          }

          await loadAPIData(true);
        } catch (error) {
          console.error('updatePrescription failed:', error);
        }
      })();
    },
    requestPrescriptionRefill: (prescriptionId) => {
      void (async () => {
        const prescription = dataRef.current.prescriptions.find((item) => item.id === prescriptionId);
        if (!prescription) return;
        const newRefill: PrescriptionRefillRequest = {
          id: `refill-${Date.now()}`,
          prescriptionId,
          requestDate: new Date().toISOString().split('T')[0],
          status: 'pending',
        };
        try {
          await recordsApi.createRecord<PrescriptionRefillRequest>({
            id: newRefill.id,
            record_type: 'prescription_refill_request',
            patient_id: Number(prescription.patientId),
            provider_id: Number(prescription.doctorId),
            payload: {
              ...newRefill,
              prescriptionId,
            },
          });
          await loadAPIData(true);
        } catch (error) {
          console.error('requestPrescriptionRefill failed:', error);
        }
      })();
    },
    
    addLabTest: (test) => {
      void (async () => {
        try {
          await api.labTests.createLabTest({
            patient_id: Number(test.patientId),
            destination_provider_id: Number(test.labId),
            test_name: test.testName,
            test_code: test.testName,
          });
          await loadAPIData(true);
        } catch (e) {
          console.error('addLabTest failed:', e);
        }
      })();
    },
    updateLabTest: (id, update) => {
      void (async () => {
        const prev = dataRef.current.labTests.find((t) => t.id === id);
        if (!prev) return;
        const next = update(prev);
        const payload = labPayloadFromDelta(prev, next);
        try {
          if (Object.keys(payload).length > 0) {
            await api.labTests.updateLabTest(Number(id), payload);
          }
          await loadAPIData(true);
        } catch (e) {
          console.error('updateLabTest failed:', e);
        }
      })();
    },
    addImagingScan: (scan) => {
      void (async () => {
        try {
          await api.imaging.orderImagingScan({
            patient_id: Number(scan.patientId),
            destination_provider_id: Number(scan.centerId),
            scan_type: scan.scanType,
            body_part: scan.bodyPart || undefined,
            clinical_indication: scan.clinicalIndication || undefined,
          });
          await loadAPIData(true);
        } catch (e) {
          console.error('addImagingScan failed:', e);
        }
      })();
    },
    updateImagingScan: (id, update) => {
      void (async () => {
        const prev = dataRef.current.imagingScans.find((s) => s.id === id);
        if (!prev) return;
        const next = update(prev);
        const payload = imagingPayloadFromDelta(prev, next);
        try {
          if (Object.keys(payload).length > 0) {
            await api.imaging.updateImagingScan(Number(id), payload);
          }
          await loadAPIData(true);
        } catch (e) {
          console.error('updateImagingScan failed:', e);
        }
      })();
    },
    addAmbulanceRequest: (request) => {
      void (async () => {
        try {
          await ambulanceApi.createRequest({
            patient_id: toOptionalNumber(request.patientId) ?? undefined,
            location_name: request.location,
            address: request.address,
            latitude: request.latitude,
            longitude: request.longitude,
            description: request.location,
            priority: request.priority,
          });
          await loadAPIData(true);
        } catch (error) {
          console.error('addAmbulanceRequest failed:', error);
        }
      })();
    },
    updateAmbulanceRequest: (id, update) => {
      void (async () => {
        const prev = dataRef.current.ambulanceRequests.find((request) => request.id === id);
        if (!prev) return;
        const next = update(prev);
        const payload: Record<string, unknown> = {};
        if (next.status !== prev.status) {
          payload.status = next.status === 'requested'
            ? 'pending'
            : next.status === 'en-route'
              ? 'en_route'
              : next.status;
        }
        if (next.priority !== prev.priority) payload.priority = next.priority;
        if (next.location !== prev.location) payload.location_name = next.location;
        if (next.address !== prev.address) payload.address = next.address;
        if (next.latitude !== prev.latitude) payload.latitude = next.latitude;
        if (next.longitude !== prev.longitude) payload.longitude = next.longitude;
        if (next.assignedAmbulanceId !== prev.assignedAmbulanceId) {
          payload.assigned_ambulance_id = toOptionalNumber(next.assignedAmbulanceId);
        }
        try {
          if (Object.keys(payload).length > 0) {
            await ambulanceApi.updateRequest(id, payload);
          }
          await loadAPIData(true);
        } catch (error) {
          console.error('updateAmbulanceRequest failed:', error);
        }
      })();
    },
    addVitalSigns: (vital) => {
      void (async () => {
        try {
          await upsertStructuredRecord('vital_sign', vital, 'vitalSigns', {
            patient_id: toOptionalNumber(vital.patientId),
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addVitalSigns failed:', error);
        }
      })();
    },
    addHealthMetric: (metric) => {
      void (async () => {
        try {
          await upsertStructuredRecord('health_metric', metric, 'healthMetrics', {
            patient_id: toOptionalNumber(metric.patientId),
            status: metric.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addHealthMetric failed:', error);
        }
      })();
    },
    addInventoryItem: (item) => {
      void (async () => {
        try {
          await upsertStructuredRecord('inventory_item', item, 'inventoryItems', {
            provider_id: toOptionalNumber(user?.id),
            status: item.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addInventoryItem failed:', error);
        }
      })();
    },
    updateInventoryItem: (id, update) => {
      void (async () => {
        const prev = dataRef.current.inventoryItems.find((item) => item.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('inventory_item', next, 'inventoryItems', {
            provider_id: toOptionalNumber(user?.id),
            status: next.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('updateInventoryItem failed:', error);
        }
      })();
    },
    deleteInventoryItem: (id) => {
      void (async () => {
        try {
          await recordsApi.deleteRecord(id);
          await loadAPIData(true);
        } catch (error) {
          console.error('deleteInventoryItem failed:', error);
        }
      })();
    },
    addAmbulance: (ambulance) => {
      void (async () => {
        try {
          await upsertStructuredRecord('ambulance_vehicle', ambulance, 'ambulances', {
            provider_id: toOptionalNumber(user?.id),
            status: ambulance.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addAmbulance failed:', error);
        }
      })();
    },
    updateAmbulance: (id, update) => {
      void (async () => {
        const prev = dataRef.current.ambulances.find((ambulance) => ambulance.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('ambulance_vehicle', next, 'ambulances', {
            provider_id: toOptionalNumber(user?.id),
            status: next.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('updateAmbulance failed:', error);
        }
      })();
    },
    deleteAmbulance: (id) => {
      void (async () => {
        try {
          await recordsApi.deleteRecord(id);
          await loadAPIData(true);
        } catch (error) {
          console.error('deleteAmbulance failed:', error);
        }
      })();
    },
    addProviderVerification: (verification) => {
      void (async () => {
        try {
          const providerId = toOptionalNumber(verification.providerId);
          if (providerId !== null) {
            if (verification.status === 'approved') {
              await api.admin.verifyProvider(providerId);
            } else if (verification.status === 'rejected') {
              await api.admin.rejectProvider(providerId, verification.notes || 'Invalid credentials');
            }
          }
          await loadAPIData(true);
        } catch (error) {
          console.error('addProviderVerification failed:', error);
        }
      })();
    },
    updateProviderVerification: (id, update) => {
      void (async () => {
        const prev = dataRef.current.providerVerifications.find((verification) => verification.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          const providerId = toOptionalNumber(next.providerId);
          if (providerId !== null && next.status !== prev.status) {
            if (next.status === 'approved') {
              await api.admin.verifyProvider(providerId);
            } else if (next.status === 'rejected') {
              await api.admin.rejectProvider(providerId, next.notes || 'Invalid credentials');
            }
          }
          await loadAPIData(true);
        } catch (error) {
          console.error('updateProviderVerification failed:', error);
        }
      })();
    },
    addReferral: async (referral) => {
      try {
        const response = await referralsApi.createReferral({
          patient_id: Number(referral.patientId),
          referral_type: referral.referralType,
          destination_provider_id: Number(referral.destinationProviderId),
          to_department: referral.toDepartment,
          to_department_id: referral.toDepartmentId || undefined,
          reason: referral.reason,
          notes: referral.notes,
        });

        setData((current) => ({
          ...current,
          referrals: [...current.referrals, mapBackendReferral(response)],
        }));

        await loadAPIData(true);
      } catch (e) {
        console.error('addReferral failed:', e);
        throw e;
      }
    },
    updateReferral: (id, update) => {
      void (async () => {
        const prev = dataRef.current.referrals.find((r) => r.id === id);
        if (!prev) return;
        const next = update(prev);
        const payload: { status?: string; notes?: string } = {};
        if (next.status !== prev.status) payload.status = next.status;
        if (next.notes !== prev.notes) payload.notes = next.notes;
        try {
          if (Object.keys(payload).length > 0) {
            await referralsApi.updateReferral(Number(id), payload);
          }
          await loadAPIData(true);
        } catch (e) {
          console.error('updateReferral failed:', e);
        }
      })();
    },
    // Allergy and drug interaction management
    addAllergy: (allergy) => {
      void (async () => {
        try {
          const severity =
            allergy.severity === 'life-threatening' ? 'severe' : allergy.severity;
          await allergiesApi.createAllergy({
            ...(user && user.role !== 'patient' ? { patient_id: Number(allergy.patientId) } : {}),
            allergen: allergy.allergen,
            allergen_type: allergy.allergyType,
            reaction_description: allergy.reaction,
            severity,
            treatment: allergy.notes,
          });
          await loadAPIData(true);
        } catch (e) {
          console.error('addAllergy failed:', e);
        }
      })();
    },
    removeAllergy: (allergyId) => {
      void (async () => {
        try {
          await allergiesApi.deleteAllergy(allergyId);
          await loadAPIData(true);
        } catch (e) {
          console.error('removeAllergy failed:', e);
        }
      })();
    },
    addMedicalHistory: (history) => {
      void (async () => {
        try {
          await upsertStructuredRecord('medical_history', history, 'medicalHistories', {
            patient_id: toOptionalNumber(history.patientId),
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addMedicalHistory failed:', error);
        }
      })();
    },
    updateMedicalHistory: (id, update) => {
      void (async () => {
        const prev = dataRef.current.medicalHistories.find((history) => history.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('medical_history', next, 'medicalHistories', {
            patient_id: toOptionalNumber(next.patientId),
          });
        } catch (error) {
          console.error('updateMedicalHistory failed:', error);
        }
      })();
    },
    addPatientConsent: (consent) => {
      void (async () => {
        try {
          await upsertStructuredRecord('patient_consent', consent, 'patientConsents', {
            patient_id: toOptionalNumber(consent.patientId),
            status: consent.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addPatientConsent failed:', error);
        }
      })();
    },
    updatePatientConsent: (id, update) => {
      void (async () => {
        const prev = dataRef.current.patientConsents.find((consent) => consent.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('patient_consent', next, 'patientConsents', {
            patient_id: toOptionalNumber(next.patientId),
            status: next.status,
          });
        } catch (error) {
          console.error('updatePatientConsent failed:', error);
        }
      })();
    },
    checkDrugInteractions: (medications) => {
      const interactions: DrugInteraction[] = [];
      for (let i = 0; i < medications.length; i++) {
        for (let j = i + 1; j < medications.length; j++) {
          const interaction = drugInteractionDatabase.find(
            (di) =>
              (di.drug1.toLowerCase() === medications[i].toLowerCase() && di.drug2.toLowerCase() === medications[j].toLowerCase()) ||
              (di.drug1.toLowerCase() === medications[j].toLowerCase() && di.drug2.toLowerCase() === medications[i].toLowerCase()),
          );
          if (interaction) interactions.push(interaction);
        }
      }
      return interactions;
    },
    getPatientAllergies: (patientId) => data.patientAllergies.filter((allergy) => allergy.patientId === patientId),
    
    // Clinical Notes Management (P2)
    addClinicalNote: (note) => {
      void (async () => {
        try {
          await upsertStructuredRecord('clinical_note', note, 'clinicalNotes', {
            patient_id: toOptionalNumber(note.patientId),
            provider_id: toOptionalNumber(note.doctorId),
            status: note.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addClinicalNote failed:', error);
        }
      })();
    },
    updateClinicalNote: (id, update) => {
      void (async () => {
        const prev = dataRef.current.clinicalNotes.find((note) => note.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('clinical_note', next, 'clinicalNotes', {
            patient_id: toOptionalNumber(next.patientId),
            provider_id: toOptionalNumber(next.doctorId),
            status: next.status,
          });
        } catch (error) {
          console.error('updateClinicalNote failed:', error);
        }
      })();
    },
    
    // Patient Problem List Management (P2)
    addPatientProblem: (problem) => {
      void (async () => {
        try {
          await upsertStructuredRecord('patient_problem', problem, 'patientProblems', {
            patient_id: toOptionalNumber(problem.patientId),
            status: problem.status,
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addPatientProblem failed:', error);
        }
      })();
    },
    updatePatientProblem: (id, update) => {
      void (async () => {
        const prev = dataRef.current.patientProblems.find((problem) => problem.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('patient_problem', next, 'patientProblems', {
            patient_id: toOptionalNumber(next.patientId),
            status: next.status,
          });
        } catch (error) {
          console.error('updatePatientProblem failed:', error);
        }
      })();
    },
    
    // Medication Adherence Tracking (P2)
    updateMedicationAdherence: (id, update) => {
      void (async () => {
        const prev = dataRef.current.medicationAdherence.find((adherence) => adherence.id === id);
        if (!prev) return;
        const next = update(prev);
        try {
          await updateStructuredRecord('medication_adherence', next, 'medicationAdherence', {
            patient_id: toOptionalNumber(next.patientId),
          });
        } catch (error) {
          console.error('updateMedicationAdherence failed:', error);
        }
      })();
    },
    recordMedicationAdherence: (adherence) => {
      void (async () => {
        try {
          await upsertStructuredRecord('medication_adherence', adherence, 'medicationAdherence', {
            patient_id: toOptionalNumber(adherence.patientId),
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('recordMedicationAdherence failed:', error);
        }
      })();
    },
    
    // Billing & Payment System (Ghana-specific)
    setProviderPricing: (pricing) => {
      void (async () => {
        try {
          const existing = dataRef.current.providerPricing.find((p) => p.id === pricing.id);
          await upsertStructuredRecord('provider_pricing', pricing, 'providerPricing', {
            provider_id: toOptionalNumber(pricing.providerId),
            created_by: toOptionalNumber(user?.id),
          });

          await persistBillingRecord({
            id: `br-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: existing ? 'pricing-updated' : 'pricing-created',
            actionBy: pricing.providerId,
            actionByName: pricing.providerName,
            affectedProviderId: pricing.providerId,
            details: `${existing ? 'Updated' : 'Created'} pricing for ${pricing.serviceDescription}: GHS ${pricing.priceGHS}`,
          });
        } catch (error) {
          console.error('setProviderPricing failed:', error);
        }
      })();
    },
    deleteProviderPricing: (pricingId) => {
      void (async () => {
        try {
          const existing = dataRef.current.providerPricing.find((pricing) => pricing.id === pricingId);
          if (!existing) return;
          await recordsApi.deleteRecord(pricingId);
          await loadAPIData(true);
          await persistBillingRecord({
            id: `br-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'pricing-deleted',
            actionBy: existing.providerId,
            actionByName: existing.providerName,
            affectedProviderId: existing.providerId,
            details: `Deleted pricing for ${existing.serviceDescription}: GHS ${existing.priceGHS}`,
          });
        } catch (error) {
          console.error('deleteProviderPricing failed:', error);
        }
      })();
    },
    getProviderPricing: (providerId) => data.providerPricing.filter((p) => p.providerId === providerId),
    
    createServiceCharge: (charge) => {
      void (async () => {
        try {
          await upsertStructuredRecord('service_charge', charge, 'serviceCharges', {
            patient_id: toOptionalNumber(charge.patientId),
            provider_id: toOptionalNumber(charge.providerId),
            appointment_id: toOptionalNumber(charge.appointmentId),
            status: charge.status,
            created_by: toOptionalNumber(user?.id),
          });
          await persistBillingRecord({
            id: `br-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'charge-created',
            actionBy: charge.providerId,
            actionByName: charge.providerName,
            affectedPatientId: charge.patientId,
            affectedProviderId: charge.providerId,
            amountGHS: charge.amountGHS,
            details: `Service charge created: ${charge.serviceDescription} (GHS ${charge.amountGHS}) for patient ${charge.patientId}`,
          });
        } catch (error) {
          console.error('createServiceCharge failed:', error);
        }
      })();
    },
    
    createInvoice: (invoice) => {
      void (async () => {
        try {
          await upsertStructuredRecord('invoice', invoice, 'invoices', {
            patient_id: toOptionalNumber(invoice.patientId),
            status: invoice.status,
            created_by: toOptionalNumber(user?.id),
          });
          await persistBillingRecord({
            id: `br-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'invoice-created',
            actionBy: user?.id || 'system',
            actionByName: user?.name || 'System',
            affectedPatientId: invoice.patientId,
            relatedInvoiceId: invoice.id,
            amountGHS: invoice.totalAmountGHS,
            details: `Invoice ${invoice.id} created for patient ${invoice.patientName}: GHS ${invoice.totalAmountGHS}`,
          });
        } catch (error) {
          console.error('createInvoice failed:', error);
        }
      })();
    },
    
    recordPayment: (invoiceId, paymentMethod, amountGHS) => {
      void (async () => {
        const invoice = dataRef.current.invoices.find((inv) => inv.id === invoiceId);
        if (!invoice) return;
        const newPaymentMethods = [...(invoice.paymentMethods || []), {
          method: paymentMethod,
          amountGHS,
          date: new Date().toISOString().split('T')[0],
          transactionId: `tx-${Date.now()}`,
        }];
        const totalPaid = newPaymentMethods.reduce((sum, p) => sum + p.amountGHS, 0);
        const outstanding = Math.max(0, invoice.totalAmountGHS - totalPaid);
        const updatedInvoice: Invoice = {
          ...invoice,
          amountPaidGHS: totalPaid,
          outstandingAmountGHS: outstanding,
          paymentMethods: newPaymentMethods,
          status: outstanding === 0 ? 'paid' : totalPaid > 0 ? 'partially-paid' : invoice.status,
        };
        try {
          await updateStructuredRecord('invoice', updatedInvoice, 'invoices', {
            patient_id: toOptionalNumber(updatedInvoice.patientId),
            status: updatedInvoice.status,
          });
          await persistBillingRecord({
            id: `br-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'payment-recorded',
            actionBy: user?.id || 'system',
            actionByName: user?.name || 'System',
            affectedPatientId: invoice.patientId,
            relatedInvoiceId: invoiceId,
            amountGHS,
            details: `Payment of GHS ${amountGHS} recorded via ${paymentMethod} for invoice ${invoiceId}`,
          });
        } catch (error) {
          console.error('recordPayment failed:', error);
        }
      })();
    },
    
    getPatientBalance: (patientId) => {
      const patientInvoices = data.invoices.filter((inv) => inv.patientId === patientId);
      return patientInvoices.reduce((sum, inv) => sum + inv.outstandingAmountGHS, 0);
    },
    
    addBillingRecord: (record) => {
      void (async () => {
        try {
          await upsertStructuredRecord('billing_record', record, 'billingRecords', {
            created_by: toOptionalNumber(user?.id),
          });
        } catch (error) {
          console.error('addBillingRecord failed:', error);
        }
      })();
    },
    getClinicalNotes: (patientId) => data.clinicalNotes.filter((note) => note.patientId === patientId),
    getPatientProblems: (patientId) => data.patientProblems.filter((problem) => problem.patientId === patientId),
    getAllBillingRecords: () => data.billingRecords,
    getInvoices: (patientId) => data.invoices.filter((inv) => inv.patientId === patientId),
    
    // Smart Appointment Reminders
    appointmentReminders: data.appointmentReminders,
    generateAppointmentReminders: (appointmentId, reminderTypes) => {
      void (async () => {
        const appointment = dataRef.current.appointments.find((apt) => apt.id === appointmentId);
        if (!appointment) return;

        try {
          await Promise.all(reminderTypes.map((reminderType) => {
            const reminderId = `reminder-${appointmentId}-${reminderType}`;
            const reminder: AppointmentReminder = {
              id: reminderId,
              appointmentId,
              patientId: appointment.patientId,
              patientName: appointment.patientName,
              doctorId: appointment.doctorId,
              doctorName: appointment.doctorName,
              reminderType,
              notificationMethod: 'in-app',
              status: 'pending',
              appointmentDate: appointment.date,
              appointmentTime: appointment.time,
              message: `Reminder: You have an appointment with ${appointment.doctorName} on ${appointment.date} at ${appointment.time}.`,
              appointmentMode: appointment.appointmentMode,
              sentAt: undefined,
              acknowledgedAt: undefined,
            };

            const scope = {
              patient_id: toOptionalNumber(appointment.patientId),
              provider_id: toOptionalNumber(appointment.doctorId),
              appointment_id: toOptionalNumber(appointmentId),
              status: 'pending',
              created_by: toOptionalNumber(user?.id),
            };

            const exists = dataRef.current.appointmentReminders.some((item) => item.id === reminderId);
            if (exists) {
              return recordsApi.updateRecord(reminderId, {
                ...scope,
                payload: reminder,
              });
            }

            return recordsApi.createRecord<AppointmentReminder>({
              id: reminderId,
              record_type: 'appointment_reminder',
              ...scope,
              payload: reminder,
            });
          }));
          await loadAPIData(true);
        } catch (error) {
          console.error('generateAppointmentReminders failed:', error);
        }
      })();
    },
    
    sendReminder: (reminderId, method) => {
      void (async () => {
        const reminder = dataRef.current.appointmentReminders.find((item) => item.id === reminderId);
        if (!reminder) return;
        const next: AppointmentReminder = {
          ...reminder,
          notificationMethod: method,
          status: 'sent',
          sentAt: new Date().toISOString(),
        };
        try {
          await updateStructuredRecord('appointment_reminder', next, 'appointmentReminders', {
            patient_id: toOptionalNumber(next.patientId),
            provider_id: toOptionalNumber(next.doctorId),
            appointment_id: toOptionalNumber(next.appointmentId),
            status: next.status,
          });
        } catch (error) {
          console.error('sendReminder failed:', error);
        }
      })();
    },
    
    acknowledgeReminder: (reminderId, patientId) => {
      void (async () => {
        const reminder = dataRef.current.appointmentReminders.find((item) => item.id === reminderId && item.patientId === patientId);
        if (!reminder) return;
        const next: AppointmentReminder = {
          ...reminder,
          status: 'acknowledged',
          acknowledgedAt: new Date().toISOString(),
        };
        try {
          await updateStructuredRecord('appointment_reminder', next, 'appointmentReminders', {
            patient_id: toOptionalNumber(next.patientId),
            provider_id: toOptionalNumber(next.doctorId),
            appointment_id: toOptionalNumber(next.appointmentId),
            status: next.status,
          });
        } catch (error) {
          console.error('acknowledgeReminder failed:', error);
        }
      })();
    },
    
    getPatientReminders: (patientId) => data.appointmentReminders.filter((reminder) => reminder.patientId === patientId),
    
    getReminderByAppointment: (appointmentId) => data.appointmentReminders.filter((reminder) => reminder.appointmentId === appointmentId),
    
    updateReminderStatus: (reminderId, status) => {
      void (async () => {
        const reminder = dataRef.current.appointmentReminders.find((item) => item.id === reminderId);
        if (!reminder) return;
        const next: AppointmentReminder = { ...reminder, status };
        try {
          await updateStructuredRecord('appointment_reminder', next, 'appointmentReminders', {
            patient_id: toOptionalNumber(next.patientId),
            provider_id: toOptionalNumber(next.doctorId),
            appointment_id: toOptionalNumber(next.appointmentId),
            status: next.status,
          });
        } catch (error) {
          console.error('updateReminderStatus failed:', error);
        }
      })();
    },
  }), [data, user, loadAPIData, refreshAppData, upsertStructuredRecord, updateStructuredRecord, persistBillingRecord, isLoadingAPI]);

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
};
