import type { UserRole } from '@/contexts/AuthContext';
import { normalizeUserRole } from '@/lib/roleUtils';

export const featureAccessMap: Record<string, UserRole[]> = {
  appointments: ['patient', 'doctor', 'physiotherapist'],
  prescriptions: ['patient', 'doctor', 'pharmacy'],
  'lab-results': ['patient'],
  'lab-referrals': ['doctor'],
  'test-requests': ['laboratory'],
  imaging: ['patient'],
  'imaging-referrals': ['doctor', 'imaging'],
  'scan-requests': ['imaging'],
  ambulance: ['patient', 'ambulance', 'hospital', 'doctor'],
  requests: ['ambulance', 'hospital', 'doctor'],
  timeline: ['patient', 'doctor', 'physiotherapist'],
  inventory: ['pharmacy'],
  vehicles: ['ambulance'],
  users: ['admin', 'super_admin'],
  profile: ['patient', 'doctor', 'hospital', 'laboratory', 'imaging', 'pharmacy', 'ambulance', 'admin', 'super_admin', 'physiotherapist'],
  verifications: ['admin', 'super_admin'],
  analytics: ['doctor', 'admin', 'super_admin', 'physiotherapist'],
  patients: ['doctor', 'hospital', 'admin', 'super_admin', 'physiotherapist'],
  doctors: ['patient', 'hospital', 'admin', 'super_admin'],
  referrals: ['doctor', 'hospital', 'physiotherapist'],
  'pharmacy-referrals': ['doctor', 'pharmacy'],
  results: ['laboratory', 'imaging'],
  messages: ['patient', 'doctor', 'hospital', 'laboratory', 'imaging', 'pharmacy', 'ambulance', 'physiotherapist'],
  'health-metrics': ['patient'],
  notifications: ['admin', 'super_admin'],
  'appointment-reminders': ['patient', 'doctor', 'physiotherapist'],
  allergies: ['patient', 'doctor', 'physiotherapist'],
  'prescription-refills': ['patient'],
  'medical-history': ['patient', 'doctor', 'hospital', 'admin', 'physiotherapist'],
  consent: ['patient'],
  'clinical-notes': ['patient', 'doctor', 'physiotherapist'],
  'problem-list': ['patient'],
  'medication-adherence': ['patient'],
  'lab-results-management': ['laboratory', 'admin', 'super_admin'],
  'smart-appointment-reminders': ['patient', 'doctor', 'physiotherapist'],
  'pricing-settings': ['doctor', 'physiotherapist'],
  billing: ['patient'],
  'admin-billing': ['admin', 'super_admin'],
  audit: ['super_admin'],
  'admin/create': ['super_admin'],
  'system-management': ['super_admin'],
};

export const canAccessFeature = (page: string, role?: UserRole | string) => {
  const normalized = normalizeUserRole(role);
  if (normalized === 'super_admin') return true;
  return Boolean(normalized && featureAccessMap[page]?.includes(normalized));
};
