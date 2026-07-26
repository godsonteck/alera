import { describe, expect, it } from 'vitest';
import type { User } from '@/contexts/AuthContext';
import type { Appointment } from '@/data/mockData';
import { canAccessFeature } from '@/lib/featureAccess';
import { getAvailableAppointmentSlots, getAppointmentTimeUntilLabel, getVisibleAppointments, isWithinNext24Hours, isWithinNextHour } from '@/lib/appointmentUtils';
import { getAccessiblePatients, getDoctorPatients } from '@/lib/patientDirectory';
import { createStoredNotification, matchesNotificationRecipient } from '@/lib/notificationUtils';
import { canAcceptReferral, canCancelReferral, canCompleteReferral, getReferralDepartmentId, getReferralDepartments, getReferralDestinationProviders, getVisibleReferrals, isReferralDestinationValid } from '@/lib/referralUtils';
import { getVisibleImagingScans, getVisibleLabTests, getVisiblePrescriptions } from '@/lib/recordVisibility';
import { clearAleraStorage, getNotificationStorageKey, storageKeys } from '@/lib/storageKeys';
import type { Doctor, LabTest, Prescription, Referral } from '@/data/mockData';

describe('feature access', () => {
  it('allows only configured roles for sensitive routes', () => {
    expect(canAccessFeature('users', 'admin')).toBe(true);
    expect(canAccessFeature('users', 'doctor')).toBe(false);
    expect(canAccessFeature('health-metrics', 'patient')).toBe(true);
    expect(canAccessFeature('health-metrics', 'doctor')).toBe(false);
    expect(canAccessFeature('scan-requests', 'imaging')).toBe(true);
    expect(canAccessFeature('scan-requests', 'patient')).toBe(false);
    expect(canAccessFeature('health-metrics', 'super_admin')).toBe(true);
    expect(canAccessFeature('pricing-settings', 'super_admin')).toBe(true);
    expect(canAccessFeature('billing', 'super_admin')).toBe(true);
  });
});

describe('referral helpers', () => {
  const hospitalReferral: Referral = {
    id: 'ref-hospital',
    patientName: 'Jane Roe',
    patientId: 'patient-1',
    fromDoctorId: 'doctor-1',
    fromDoctorName: 'Dr. Alice',
    toDepartment: 'City General Hospital',
    toDepartmentId: 'hospital-dept-1',
    date: '2026-04-08',
    reason: 'Escalated care',
    status: 'pending',
    lastUpdated: '2026-04-08',
    referralType: 'hospital',
    destinationProviderId: 'hospital-1',
  };

  const pharmacyReferral: Referral = {
    ...hospitalReferral,
    id: 'ref-pharmacy',
    toDepartment: 'CarePlus Pharmacy',
    referralType: 'pharmacy',
    destinationProviderId: 'pharmacy-1',
  };

  it('lets hospital users act only on hospital referrals assigned to them', () => {
    expect(getVisibleReferrals([hospitalReferral, pharmacyReferral], { id: 'hospital-1', role: 'hospital' })).toEqual([hospitalReferral]);
    expect(canAcceptReferral(hospitalReferral, 'hospital')).toBe(true);
    expect(canAcceptReferral(pharmacyReferral, 'hospital')).toBe(false);
    expect(canCompleteReferral({ ...hospitalReferral, status: 'accepted' }, 'hospital')).toBe(true);
    expect(canCompleteReferral({ ...pharmacyReferral, status: 'accepted' }, 'hospital')).toBe(false);
  });
});

describe('doctor patient directory', () => {
  const users: User[] = [
    { id: 'doctor-1', email: 'doctor@alera.local', name: 'Dr. Alice', role: 'doctor' },
    { id: 'patient-1', email: 'patient1@alera.local', name: 'Jane Roe', role: 'patient' },
    { id: 'patient-2', email: 'patient2@alera.local', name: 'John Doe', role: 'patient' },
  ];

  const appointments: Appointment[] = [
    {
      id: 'apt-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      date: '2026-04-01',
      time: '09:00',
      status: 'scheduled',
      type: 'Follow-up',
      appointmentMode: 'telemedicine',
    },
  ];

  it('returns linked patients for the current doctor first', () => {
    expect(getDoctorPatients(users, appointments, 'doctor-1')).toEqual([
      { id: 'patient-1', name: 'Jane Roe', email: 'patient1@alera.local' },
    ]);
  });

  it('falls back to all patients when the doctor has no linked appointments yet', () => {
    expect(getDoctorPatients(users, appointments, 'doctor-2')).toEqual([
      { id: 'patient-1', name: 'Jane Roe', email: 'patient1@alera.local' },
      { id: 'patient-2', name: 'John Doe', email: 'patient2@alera.local' },
    ]);
  });

  it('builds scoped patient summaries for doctor and hospital views', () => {
    const prescriptions: Prescription[] = [
      {
        id: 'rx-1',
        patientName: 'Jane Roe',
        patientId: 'patient-1',
        doctorName: 'Dr. Alice',
        doctorId: 'doctor-1',
        date: '2026-04-02',
        medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'daily', duration: '7d' }],
        status: 'active',
      },
    ];
    const labTests: LabTest[] = [
      {
        id: 'lab-1',
        patientName: 'Jane Roe',
        patientId: 'patient-1',
        doctorName: 'Dr. Alice',
        doctorId: 'doctor-1',
        testName: 'CBC',
        date: '2026-04-03',
        status: 'requested',
      },
    ];

    expect(getAccessiblePatients(users, appointments, prescriptions, labTests, { id: 'doctor-1', role: 'doctor' })).toEqual([
      {
        id: 'patient-1',
        name: 'Jane Roe',
        email: 'patient1@alera.local',
        appointmentCount: 1,
        prescriptionCount: 1,
        labTestCount: 1,
        hasActive: true,
        lastVisit: '2026-04-01',
      },
    ]);

    expect(getAccessiblePatients(users, appointments, prescriptions, labTests, { id: 'hospital-1', role: 'hospital' })).toEqual([
      {
        id: 'patient-1',
        name: 'Jane Roe',
        email: 'patient1@alera.local',
        appointmentCount: 1,
        prescriptionCount: 1,
        labTestCount: 1,
        hasActive: true,
        lastVisit: '2026-04-01',
      },
      {
        id: 'patient-2',
        name: 'John Doe',
        email: 'patient2@alera.local',
        appointmentCount: 0,
        prescriptionCount: 0,
        labTestCount: 0,
        hasActive: false,
      },
    ]);
  });
});

describe('appointment workflow helpers', () => {
  const doctor: Doctor = {
    id: 'doctor-1',
    name: 'Dr. Alice',
    specialty: 'General Practice',
    qualifications: ['MD'],
    experience: 8,
    rating: 4.9,
    reviewCount: 12,
    consultationFee: 60,
    status: 'available',
    availableHours: [{ dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '11:00' }],
    slotDuration: 30,
  };

  const appointments: Appointment[] = [
    {
      id: 'apt-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      date: '2026-04-07',
      time: '09:30',
      status: 'scheduled',
      type: 'Follow-up',
      appointmentMode: 'telemedicine',
    },
    {
      id: 'apt-2',
      patientName: 'John Doe',
      patientId: 'patient-2',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      date: '2026-04-07',
      time: '10:00',
      status: 'cancelled',
      type: 'Check-up',
      appointmentMode: 'telemedicine',
    },
  ];

  it('scopes visible appointments to the signed-in patient or doctor', () => {
    expect(getVisibleAppointments(appointments, { id: 'patient-1', role: 'patient' })).toHaveLength(1);
    expect(getVisibleAppointments(appointments, { id: 'doctor-1', role: 'doctor' })).toHaveLength(2);
    expect(getVisibleAppointments(appointments, { id: 'patient-9', role: 'patient' })).toHaveLength(0);
  });

  it('excludes booked slots and past slots while keeping cancelled slots bookable', () => {
    expect(getAvailableAppointmentSlots(
      doctor,
      '2026-04-07',
      appointments,
      new Date('2026-04-07T09:15:00'),
    )).toEqual(['10:00', '10:30']);
  });

  it('calculates reminder windows and labels consistently', () => {
    const now = new Date('2026-04-07T08:30:00');

    expect(isWithinNext24Hours('2026-04-07', '09:15', now)).toBe(true);
    expect(isWithinNextHour('2026-04-07', '09:15', now)).toBe(true);
    expect(isWithinNextHour('2026-04-07', '11:00', now)).toBe(false);
    expect(getAppointmentTimeUntilLabel('2026-04-07', '09:15', now)).toBe('45m');
  });
});

describe('storage reset safety', () => {
  it('clears only alera-owned keys', () => {
    localStorage.setItem(storageKeys.authUser, 'user');
    localStorage.setItem(storageKeys.appData, 'data');
    localStorage.setItem(getNotificationStorageKey('patient@alera.local'), 'notifications');
    localStorage.setItem('external_app', 'keep-me');

    clearAleraStorage();

    expect(localStorage.getItem(storageKeys.authUser)).toBeNull();
    expect(localStorage.getItem(storageKeys.appData)).toBeNull();
    expect(localStorage.getItem(getNotificationStorageKey('patient@alera.local'))).toBeNull();
    expect(localStorage.getItem('external_app')).toBe('keep-me');
  });
});

describe('notification routing helpers', () => {
  it('matches recipients by role or email while honoring exclusions', () => {
    expect(matchesNotificationRecipient({
      title: 'Result ready',
      message: 'Your lab result is available.',
      type: 'result',
      audience: 'personal',
      targetRoles: ['patient'],
    }, 'patient@alera.local', 'patient')).toBe(true);

    expect(matchesNotificationRecipient({
      title: 'Result ready',
      message: 'Your lab result is available.',
      type: 'result',
      audience: 'personal',
      targetEmails: ['doctor@alera.local'],
      excludeEmails: ['doctor@alera.local'],
    }, 'doctor@alera.local', 'doctor')).toBe(false);
  });

  it('builds role-specific action URLs into stored notifications', () => {
    const notification = createStoredNotification({
      title: 'Dispatch update',
      message: 'An ambulance is on the way.',
      type: 'emergency',
      audience: 'personal',
      actionUrl: '/dashboard/ambulance',
      actionUrlByRole: {
        patient: '/dashboard/ambulance',
        ambulance: '/dashboard/requests',
      },
    }, 'ambulance');

    expect(notification.actionUrl).toBe('/dashboard/requests');
    expect(notification.read).toBe(false);
    expect(notification.archived).toBe(false);
  });
});

describe('referral workflow helpers', () => {
  const referrals: Referral[] = [
    {
      id: 'ref-1',
      referralType: 'hospital',
      patientId: 'patient-1',
      patientName: 'Jane Roe',
      fromDoctorId: 'doctor-1',
      fromDoctorName: 'Dr. Alice',
      destinationProviderId: 'hospital-1',
      destinationProviderName: 'City Hospital',
      destinationProviderRole: 'hospital',
      toDepartmentId: 'cardiology',
      toDepartment: 'City Hospital',
      reason: 'Chest pain',
      date: '2026-04-01',
      status: 'pending',
      lastUpdated: '2026-04-01',
    },
  ];

  it('shows doctor-owned referrals to doctors and all referrals to hospital staff', () => {
    expect(getVisibleReferrals(referrals, { id: 'doctor-1', role: 'doctor' })).toHaveLength(1);
    expect(getVisibleReferrals(referrals, { id: 'doctor-2', role: 'doctor' })).toHaveLength(0);
    expect(getVisibleReferrals(referrals, { id: 'hospital-1', role: 'hospital' })).toHaveLength(1);
    expect(getVisibleReferrals(referrals, { id: 'hospital-2', role: 'hospital' })).toHaveLength(0);
  });

  it('returns stable department lists and ids', () => {
    expect(getReferralDepartments(referrals)).toContain('Cardiology');
    expect(getReferralDepartments(referrals)).toContain('Neurology');
    expect(getReferralDepartmentId('Ear Nose & Throat')).toBe('ear-nose-throat');
  });

  it('rejects destinations that only repeat the rendered service', () => {
    expect(isReferralDestinationValid('laboratory', 'Lab')).toBe(false);
    expect(isReferralDestinationValid('imaging', 'Radiology')).toBe(false);
    expect(isReferralDestinationValid('pharmacy', 'Clinical pharmacy')).toBe(true);
    expect(isReferralDestinationValid('hospital', 'Cardiology')).toBe(true);
  });

  it('returns verified provider destinations for each referral type', () => {
    const users: User[] = [
      { id: 'hospital-1', email: 'hospital1@alera.local', name: 'City Hospital', role: 'hospital', isVerified: true, isActive: true },
      { id: 'hospital-2', email: 'hospital2@alera.local', name: 'County Hospital', role: 'hospital', isVerified: false, isActive: true },
      { id: 'img-1', email: 'imaging@alera.local', name: 'Precision Imaging', role: 'imaging', isVerified: true, isActive: true },
    ];

    expect(getReferralDestinationProviders(users, 'hospital').map((user) => user.id)).toEqual(['hospital-1']);
    expect(getReferralDestinationProviders(users, 'imaging').map((user) => user.id)).toEqual(['img-1']);
  });

  it('scopes lab, imaging, and pharmacy queues to the assigned provider', () => {
    const labReferral: LabTest = {
      id: 'lab-queue-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      labId: 'lab-1',
      destinationProviderName: 'Precision Lab',
      testName: 'CBC',
      date: '2026-04-02',
      status: 'requested',
    };
    const imagingReferral = {
      id: 'img-queue-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      centerId: 'img-1',
      destinationProviderName: 'Precision Imaging',
      scanType: 'MRI' as const,
      date: '2026-04-02',
      status: 'requested' as const,
    };
    const pharmacyPrescription: Prescription = {
      id: 'rx-queue-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      pharmacyId: 'pharm-1',
      pharmacyName: 'Care Pharmacy',
      date: '2026-04-02',
      medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'daily', duration: '7d' }],
      status: 'active',
    };

    expect(getVisibleLabTests([labReferral], { id: 'lab-1', role: 'laboratory' })).toHaveLength(1);
    expect(getVisibleLabTests([labReferral], { id: 'lab-2', role: 'laboratory' })).toHaveLength(0);
    expect(getVisibleImagingScans([imagingReferral], { id: 'img-1', role: 'imaging' })).toHaveLength(1);
    expect(getVisibleImagingScans([imagingReferral], { id: 'img-2', role: 'imaging' })).toHaveLength(0);
    expect(getVisiblePrescriptions([pharmacyPrescription], { id: 'pharm-1', role: 'pharmacy' })).toHaveLength(1);
    expect(getVisiblePrescriptions([pharmacyPrescription], { id: 'pharm-2', role: 'pharmacy' })).toHaveLength(0);
  });

  it('assigns referral actions to the correct roles and statuses', () => {
    expect(canAcceptReferral(referrals[0], 'hospital')).toBe(true);
    expect(canAcceptReferral(referrals[0], 'doctor')).toBe(false);
    expect(canCancelReferral(referrals[0], 'doctor')).toBe(true);
    expect(canCancelReferral(referrals[0], 'hospital')).toBe(false);
    expect(canCompleteReferral({ ...referrals[0], status: 'accepted' }, 'hospital')).toBe(true);
  });
});

describe('clinical record visibility helpers', () => {
  const prescriptions: Prescription[] = [
    {
      id: 'rx-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      pharmacyId: 'pharm-1',
      pharmacyName: 'Care Pharmacy',
      date: '2026-04-02',
      medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'daily', duration: '7d' }],
      status: 'active',
    },
  ];
  const labTests: LabTest[] = [
    {
      id: 'lab-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      labId: 'lab-1',
      destinationProviderName: 'Precision Lab',
      testName: 'CBC',
      date: '2026-04-03',
      status: 'requested',
    },
  ];
  const imagingScans = [
    {
      id: 'img-1',
      patientName: 'Jane Roe',
      patientId: 'patient-1',
      doctorName: 'Dr. Alice',
      doctorId: 'doctor-1',
      centerId: 'img-center',
      destinationProviderName: 'Precision Imaging',
      scanType: 'MRI',
      date: '2026-04-03',
      status: 'requested',
    },
  ] as const;

  it('shows only role-appropriate prescriptions, lab tests, and imaging scans', () => {
    expect(getVisiblePrescriptions(prescriptions, { id: 'doctor-1', role: 'doctor' })).toHaveLength(1);
    expect(getVisiblePrescriptions(prescriptions, { id: 'patient-1', role: 'patient' })).toHaveLength(1);
    expect(getVisiblePrescriptions(prescriptions, { id: 'pharm-1', role: 'pharmacy' })).toHaveLength(1);
    expect(getVisiblePrescriptions(prescriptions, { id: 'hospital-1', role: 'hospital' })).toHaveLength(0);

    expect(getVisibleLabTests(labTests, { id: 'doctor-1', role: 'doctor' })).toHaveLength(1);
    expect(getVisibleLabTests(labTests, { id: 'lab-1', role: 'laboratory' })).toHaveLength(1);
    expect(getVisibleLabTests(labTests, { id: 'hospital-1', role: 'hospital' })).toHaveLength(0);

    expect(getVisibleImagingScans([...imagingScans], { id: 'doctor-1', role: 'doctor' })).toHaveLength(1);
    expect(getVisibleImagingScans([...imagingScans], { id: 'img-center', role: 'imaging' })).toHaveLength(1);
    expect(getVisibleImagingScans([...imagingScans], { id: 'hospital-1', role: 'hospital' })).toHaveLength(0);
  });
});
