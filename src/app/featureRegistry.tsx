import { lazy } from 'react';

import type { ReferralKind } from '@/lib/referralUtils';

const AppointmentsPage = lazy(() => import('@/pages/features/AppointmentsPage'));
const PrescriptionsPage = lazy(() => import('@/pages/features/PrescriptionsPage'));
const LabResultsPage = lazy(() => import('@/pages/features/LabResultsPage'));
const ImagingPage = lazy(() => import('@/pages/features/ImagingPage'));
const AmbulancePage = lazy(() => import('@/pages/features/AmbulancePage'));
const TimelinePage = lazy(() => import('@/pages/features/TimelinePage'));
const InventoryPage = lazy(() => import('@/pages/features/InventoryPage'));
const VehiclesPage = lazy(() => import('@/pages/features/VehiclesPage'));
const UsersPage = lazy(() => import('@/pages/features/UsersPage'));
const ProfilePage = lazy(() => import('@/pages/features/ProfilePage'));
const ContinuityPage = lazy(() => import('@/pages/features/ContinuityPageImpl'));
const VerificationsPage = lazy(() => import('@/pages/features/VerificationsPage'));
const AnalyticsPage = lazy(() => import('@/pages/features/AnalyticsPage'));
const PatientsPage = lazy(() => import('@/pages/features/PatientsPage'));
const DoctorsPage = lazy(() => import('@/pages/features/DoctorsPage'));
const ReferralsPage = lazy(() => import('@/pages/features/ReferralsPage'));
const MessagesPage = lazy(() => import('@/pages/features/MessagesPage'));
const HealthMetricsPage = lazy(() => import('@/pages/features/HealthMetricsPage'));
const NotificationCenterPage = lazy(() => import('@/pages/features/NotificationCenterPage'));
const AppointmentRemindersPage = lazy(() => import('@/pages/features/AppointmentRemindersPage'));
const AllergyManagementPage = lazy(() => import('@/pages/features/AllergyManagementPage'));
const PrescriptionRefillPage = lazy(() => import('@/pages/features/PrescriptionRefillPage'));
const MedicalHistoryPage = lazy(() => import('@/pages/features/MedicalHistoryPage'));
const PatientConsentPage = lazy(() => import('@/pages/features/PatientConsentPage'));
const ClinicalNotesPage = lazy(() => import('@/pages/features/ClinicalNotesPage'));
const PatientProblemListPage = lazy(() => import('@/pages/features/PatientProblemListPage'));
const MedicationAdherencePage = lazy(() => import('@/pages/features/MedicationAdherencePage'));
const LabResultsManagementPage = lazy(() => import('@/pages/features/LabResultsManagementPage'));
const PricingSettingsPage = lazy(() => import('@/pages/features/PricingSettingsPage'));
const BillingPage = lazy(() => import('@/pages/features/BillingPage'));
const AdminBillingDashboard = lazy(() => import('@/pages/features/AdminBillingDashboard'));
const AuditLogsPage = lazy(() => import('@/pages/features/AuditLogsPage'));
const CreateAdminPage = lazy(() => import('@/pages/features/CreateAdminPage'));
const SystemManagement = lazy(() => import('@/pages/admin/SystemManagement'));

export interface FeatureConfig {
  component: React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
}

export const featurePageMap: Record<string, FeatureConfig> = {
  appointments: { component: AppointmentsPage },
  prescriptions: { component: PrescriptionsPage },
  'lab-results': { component: LabResultsPage, props: { page: 'lab-results' } },
  'lab-referrals': { component: ReferralsPage, props: { referralKind: 'laboratory' as ReferralKind } },
  'test-requests': { component: LabResultsPage, props: { page: 'test-requests' } },
  imaging: { component: ImagingPage, props: { page: 'imaging' } },
  'imaging-referrals': { component: ImagingPage, props: { page: 'imaging-referrals' } },
  'scan-requests': { component: ImagingPage, props: { page: 'scan-requests' } },
  ambulance: { component: AmbulancePage },
  requests: { component: AmbulancePage },
  timeline: { component: TimelinePage },
  inventory: { component: InventoryPage },
  vehicles: { component: VehiclesPage },
  users: { component: UsersPage },
  profile: { component: ProfilePage },
  verifications: { component: VerificationsPage },
  analytics: { component: AnalyticsPage },
  patients: { component: PatientsPage },
  doctors: { component: DoctorsPage },
  referrals: { component: ReferralsPage, props: { referralKind: 'hospital' as ReferralKind } },
  'pharmacy-referrals': { component: ReferralsPage, props: { referralKind: 'pharmacy' as ReferralKind } },
  results: { component: LabResultsPage, props: { page: 'results' } },
  messages: { component: MessagesPage },
  'health-metrics': { component: HealthMetricsPage },
  notifications: { component: NotificationCenterPage },
  'appointment-reminders': { component: AppointmentRemindersPage },
  allergies: { component: AllergyManagementPage },
  'prescription-refills': { component: PrescriptionRefillPage },
  'medical-history': { component: MedicalHistoryPage },
  consent: { component: PatientConsentPage },
  'clinical-notes': { component: ClinicalNotesPage },
  'problem-list': { component: PatientProblemListPage },
  'medication-adherence': { component: MedicationAdherencePage },
  'lab-results-management': { component: LabResultsManagementPage },
  'pricing-settings': { component: PricingSettingsPage },
  continuity: { component: ContinuityPage },
  billing: { component: BillingPage },
  'admin-billing': { component: AdminBillingDashboard },
  audit: { component: AuditLogsPage },
  'admin/create': { component: CreateAdminPage },
  'system-management': { component: SystemManagement },
};

export const featureRouteKeys = Object.keys(featurePageMap);
