import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  MapPin,
  MessageSquare,
  Package,
  Pill,
  Radio,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  Users,
  Video,
  Database,
  Terminal
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getVisibleReferrals } from '@/lib/referralUtils';
import type { Appointment, Referral } from '@/data/mockData';

type RoleKey =
  | 'patient'
  | 'doctor'
  | 'physiotherapist'
  | 'hospital'
  | 'laboratory'
  | 'imaging'
  | 'pharmacy'
  | 'ambulance'
  | 'admin'
  | 'super_admin';

type Tone = 'primary' | 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'emergency';

type Metric = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  tone: Tone;
  href: string;
};

type WorkItem = {
  title: string;
  meta: string;
  status: string;
  href: string;
  tone?: Tone;
};

type Action = {
  label: string;
  href: string;
  icon: React.ReactNode;
  emphasis?: 'primary' | 'danger';
};

const roleCopy: Record<RoleKey, { eyebrow: string; title: string; summary: string; focus: string; icon: React.ReactNode }> = {
  patient: {
    eyebrow: 'Your care',
    title: 'Your care',
    summary: 'Appointments, results, and prescriptions in one place.',
    focus: 'Access care resources, review medical records, and message your providers.',
    icon: <HeartPulse className="h-4 w-4 text-cyan-400" />,
  },
  doctor: {
    eyebrow: 'Your clinic',
    title: 'Your clinic',
    summary: 'Visits, prescriptions, and referrals for today.',
    focus: 'Review active records, draft prescriptions, and send referrals.',
    icon: <Stethoscope className="h-4 w-4 text-cyan-400" />,
  },
  physiotherapist: {
    eyebrow: 'Rehabilitation',
    title: 'Rehabilitation',
    summary: 'Therapy plans and recovery progress.',
    focus: 'Build therapy plans and monitor recovery progress.',
    icon: <Activity className="h-4 w-4 text-cyan-400" />,
  },
  hospital: {
    eyebrow: 'Hospital coordination',
    title: 'Hospital coordination',
    summary: 'Admissions, transfers, and incoming referrals.',
    focus: 'Coordinate transfers across departments and teams.',
    icon: <Hospital className="h-4 w-4 text-amber-400" />,
  },
  laboratory: {
    eyebrow: 'Lab work',
    title: 'Lab work',
    summary: 'Incoming requests and results to publish.',
    focus: 'Confirm results and send them directly into the care record.',
    icon: <FlaskConical className="h-4 w-4 text-cyan-400" />,
  },
  imaging: {
    eyebrow: 'Imaging',
    title: 'Imaging',
    summary: 'Scan requests and reports.',
    focus: 'Coordinate scans and share findings with the right clinician.',
    icon: <ScanLine className="h-4 w-4 text-cyan-400" />,
  },
  pharmacy: {
    eyebrow: 'Pharmacy',
    title: 'Pharmacy',
    summary: 'Prescriptions to dispense and stock to watch.',
    focus: 'Dispense medication safely and keep stock updated.',
    icon: <Pill className="h-4 w-4 text-cyan-400" />,
  },
  ambulance: {
    eyebrow: 'Emergency dispatch',
    title: 'Emergency dispatch',
    summary: 'Active calls and vehicle status.',
    focus: 'Send responders and keep hospital teams informed.',
    icon: <Ambulance className="h-4 w-4 text-red-400" />,
  },
  admin: {
    eyebrow: 'Platform overview',
    title: 'Platform overview',
    summary: 'Users, verifications, and activity.',
    focus: 'Confirm access requests and audit platform activity.',
    icon: <ShieldCheck className="h-4 w-4 text-cyan-400" />,
  },
  super_admin: {
    eyebrow: 'System overview',
    title: 'System overview',
    summary: 'Organizations, admins, and system activity.',
    focus: 'Manage admin access and review system activity.',
    icon: <BadgeCheck className="h-4 w-4 text-cyan-400" />,
  },
};

const toneClasses: Record<Tone, string> = {
  primary: 'border-[#0b3d62]/20 bg-[#0b3d62]/5 text-[#0b3d62]',
  success: 'border-[#4a785c]/25 bg-[#8fd0af]/20 text-[#2f6b4f] font-semibold',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 font-semibold',
  critical: 'border-red-200 bg-red-50 text-red-700 font-semibold',
  emergency: 'border-red-300 bg-red-100 text-red-800 font-bold',
  info: 'border-sky-200 bg-sky-50 text-[#0b3d62] font-semibold',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

const statusTone = (status: string): Tone => {
  if (['completed', 'approved', 'dispensed', 'available', 'active', 'verified', 'signed'].includes(status)) return 'success';
  if (['critical', 'high', 'cancelled', 'rejected', 'out-of-stock', 'life-threatening'].includes(status)) return 'critical';
  if (['requested', 'pending', 'scheduled', 'low-stock', 'in-progress', 'processing'].includes(status)) return 'warning';
  if (['dispatched', 'en-route', 'accepted', 'confirmed-by-doctor'].includes(status)) return 'info';
  return 'neutral';
};

const displayDate = (value?: string) => {
  if (!value) return 'Date pending';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const isOpenAppointment = (appointment: Appointment) =>
  ['scheduled', 'confirmed-by-doctor', 'in-progress', 'rescheduled'].includes(appointment.status);

const sortByDateDesc = <T extends { date?: string }>(items: T[]) =>
  [...items].sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''));

const DashboardShell = ({
  role,
  metrics,
  workItems,
  actions,
  signal,
  secondaryTitle,
  secondaryItems,
}: {
  role: RoleKey;
  metrics: Metric[];
  workItems: WorkItem[];
  actions: Action[];
  signal: { label: string; value: string; detail: string; tone: Tone };
  secondaryTitle: string;
  secondaryItems: WorkItem[];
}) => {
  const { user } = useAuth();
  const copy = roleCopy[role];

  return (
    <div className="space-y-6 text-slate-800">
      {/* Workspace header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#8fd0af]/25 px-3 py-1 text-xs font-semibold text-[#2f6b4f]">
              {copy.icon}
              <span>{copy.eyebrow}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0b3d62] sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
              {copy.summary}
            </p>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">What’s next</p>
            <h2 className="mt-0.5 text-sm font-semibold text-[#0b3d62]">{signal.value}</h2>
            <p className="mt-0.5 text-xs text-slate-600">{signal.detail}</p>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
              <span className="text-slate-500">Status</span>
              <span className={`px-1.5 py-0.5 rounded-[2px] border ${toneClasses[signal.tone]}`}>{signal.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            to={metric.href}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-[#8fd0af]"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-slate-600">{metric.label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${toneClasses[metric.tone]}`}>
                {metric.icon}
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-[#0b3d62]">
                {metric.value}
              </span>
              <p className="mt-0.5 text-xs text-slate-500">{metric.helper}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Task Queue and Actions */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Core Task Queue List */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-medium text-slate-500">What needs attention</p>
              <h2 className="mt-0.5 text-base font-semibold text-[#0b3d62]">
                {role === 'patient' ? 'Your care' : 'Tasks'}
              </h2>
            </div>
            <Link to={actions[0]?.href ?? '/dashboard'} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0b3d62] hover:text-[#2f6b4f]">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {workItems.length > 0 ? (
              workItems.slice(0, 6).map((item, idx) => (
                <Link
                  key={`${item.title}-${item.meta}-${idx}`}
                  to={item.href}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-[#8fd0af]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400">{idx + 1}</span>
                    <div>
                      <strong className="block text-sm font-semibold text-slate-800 transition-colors group-hover:text-[#0b3d62]">
                        {item.title}
                      </strong>
                      <span className="mt-0.5 block text-xs text-slate-500">{item.meta}</span>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${toneClasses[item.tone ?? statusTone(item.status)]}`}>
                    {item.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-[#4a785c]" />
                <strong className="mt-2 block text-sm text-slate-800">Everything is up to date</strong>
                <span className="mt-0.5 max-w-sm text-xs text-slate-500">No outstanding items need action right now.</span>
              </div>
            )}
          </div>
        </section>

        {/* Action Gateways */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 border-b border-slate-200 pb-2">
              <p className="text-xs font-medium text-slate-500">Quick actions</p>
              <h2 className="mt-0.5 text-base font-semibold text-[#0b3d62]">Common actions</h2>
            </div>

            <div className="grid gap-1.5">
              {actions.map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className={`flex items-center justify-between rounded-xl border p-2.5 text-sm font-semibold transition-colors ${
                    action.emphasis === 'danger'
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    : action.emphasis === 'primary'
                      ? 'border-[#0b3d62] bg-[#0b3d62] text-white hover:bg-[#0a3454]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#8fd0af]/15 hover:text-[#0b3d62]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {action.icon}
                    <span>{action.label}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </section>

          {/* Activity Logs */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 border-b border-slate-200 pb-2">
              <p className="text-xs font-medium text-slate-500">Recent updates</p>
              <h2 className="mt-0.5 text-base font-semibold text-[#0b3d62]">{secondaryTitle}</h2>
            </div>

            <div className="space-y-1.5">
              {secondaryItems.length > 0 ? (
                secondaryItems.slice(0, 4).map((item, idx) => (
                  <Link
                    key={`${item.title}-${item.meta}-${idx}`}
                    to={item.href}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 transition-colors hover:border-[#8fd0af]"
                  >
                    <div>
                      <strong className="block text-sm font-semibold text-slate-800">{item.title}</strong>
                      <span className="mt-0.5 block text-xs text-slate-500">{item.meta}</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${
                      item.tone === 'success' || statusTone(item.status) === 'success' ? 'bg-emerald-400' :
                      item.tone === 'critical' || statusTone(item.status) === 'critical' ? 'bg-red-400' :
                      'bg-slate-500'
                    }`} />
                  </Link>
                ))
              ) : (
                  <div className="py-4 text-center text-xs text-slate-500">
                  No recent updates found.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Security and access notes */}
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm md:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-[#0b3d62]" />
          <div>
            <p className="font-semibold text-slate-800">Access and audit</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Clinician workspaces are reviewed regularly to keep care access secure and accountable.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#0b3d62]" />
          <div>
            <p className="font-semibold text-slate-800">Account activity</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Signed in as {user?.name ?? 'Guest'}. Activity is recorded in the platform audit log.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default function AleraCommandCenter({ role: roleOverride }: { role?: RoleKey }) {
  const { user, getUsers } = useAuth();
  const data = useAppData();
  const role = (roleOverride ?? normalizeUserRole(user?.role ?? '') ?? 'patient') as RoleKey;
  const today = new Date().toISOString().split('T')[0];
  const users = getUsers();
  const appointments = data.appointments ?? [];
  const prescriptions = data.prescriptions ?? [];
  const labTests = data.labTests ?? [];
  const imagingScans = data.imagingScans ?? [];
  const ambulanceRequests = data.ambulanceRequests ?? [];
  const inventoryItems = data.inventoryItems ?? [];
  const ambulances = data.ambulances ?? [];
  const referrals = data.referrals ?? [];
  const providerVerifications = data.providerVerifications ?? [];
  const clinicalNotes = data.clinicalNotes ?? [];
  const billingRecords = data.billingRecords ?? [];
  const invoices = data.invoices ?? [];

  const patientAppointments = appointments.filter((item) => item.patientId === user?.id);
  const doctorAppointments = appointments.filter((item) => item.doctorId === user?.id);
  const openAppointments = appointments.filter(isOpenAppointment);
  const visibleReferrals = getVisibleReferrals(referrals, user);
  const activeEmergency = ambulanceRequests.filter((item) => !['completed', 'cancelled'].includes(item.status));
  const criticalEmergency = activeEmergency.filter((item) => item.priority === 'critical' || item.priority === 'high');
  const pendingLabs = labTests.filter((item) => ['requested', 'in-progress'].includes(item.status));
  const pendingImaging = imagingScans.filter((item) => ['requested', 'in-progress'].includes(item.status));
  const activePrescriptions = prescriptions.filter((item) => item.status === 'active');
  const lowStock = inventoryItems.filter((item) => item.status === 'low-stock' || item.status === 'out-of-stock');
  const pendingVerifications = providerVerifications.filter((item) => item.status === 'pending');
  const verifiedDoctors = users.filter((item) => normalizeUserRole(item.role) === 'doctor' && item.isVerified !== false && item.isActive !== false);

  const appointmentItems = (items: Appointment[], href = '/dashboard/appointments'): WorkItem[] =>
    sortByDateDesc(items).map((item) => ({
      title: role === 'patient' ? `${item.type} with ${item.doctorName}` : `${item.patientName} - ${item.type}`,
      meta: `${displayDate(item.date)} at ${item.time} · ${item.appointmentMode === 'telemedicine' ? 'Video Consultation' : 'In Person Clinic'}`,
      status: item.status,
      href,
    }));

  const referralItems = (items: Referral[], href = '/dashboard/referrals'): WorkItem[] =>
    sortByDateDesc(items).map((item) => ({
      title: `${item.patientName} · ${item.toDepartment}`,
      meta: `${item.fromDoctorName} · ${displayDate(item.date)}`,
      status: item.status,
      href,
    }));

  const patientConfig = {
    metrics: [
      { label: 'Upcoming appointments', value: patientAppointments.filter(isOpenAppointment).length, helper: 'Scheduled or confirmed', icon: <Calendar className="h-4 w-4" />, tone: 'primary' as Tone, href: '/dashboard/appointments' },
      { label: 'Prescriptions', value: prescriptions.filter((item) => item.patientId === user?.id && item.status === 'active').length, helper: 'Active medications', icon: <Pill className="h-4 w-4" />, tone: 'success' as Tone, href: '/dashboard/prescriptions' },
      { label: 'Lab results', value: labTests.filter((item) => item.patientId === user?.id).length, helper: 'Available tests and results', icon: <FlaskConical className="h-4 w-4" />, tone: 'info' as Tone, href: '/dashboard/lab-results' },
      { label: 'Active Alerts', value: ambulanceRequests.filter((item) => item.patientId === user?.id && !['completed', 'cancelled'].includes(item.status)).length, helper: 'Dispatched emergency units', icon: <Ambulance className="h-4 w-4" />, tone: 'critical' as Tone, href: '/dashboard/ambulance' },
    ],
    workItems: [
      ...appointmentItems(patientAppointments.filter(isOpenAppointment)),
      ...prescriptions.filter((item) => item.patientId === user?.id && item.status === 'active').map((item) => ({
        title: item.medications[0]?.name ?? 'Medication plan',
        meta: `${item.doctorName} · ${item.medications.length} registered item${item.medications.length === 1 ? '' : 's'}`,
        status: 'active',
        href: '/dashboard/prescriptions',
      })),
    ],
    actions: [
      { label: 'Schedule appointment', href: '/dashboard/appointments', icon: <Calendar className="h-4 w-4" />, emphasis: 'primary' as const },
      { label: 'Request Emergency Help', href: '/dashboard/ambulance', icon: <Ambulance className="h-4 w-4" />, emphasis: 'danger' as const },
      { label: 'Message Primary', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      { label: 'Timeline', href: '/dashboard/timeline', icon: <Clock3 className="h-4 w-4" /> },
    ],
    signal: { label: 'Care status', value: 'Your care is up to date', detail: 'Review your upcoming appointments and available results.', tone: 'success' as Tone },
    secondaryTitle: 'Recent results',
    secondaryItems: [
      ...labTests.filter((item) => item.patientId === user?.id).map((item) => ({ title: item.testName, meta: `${displayDate(item.date)} · ${item.patientName}`, status: item.status, href: '/dashboard/lab-results' })),
      ...imagingScans.filter((item) => item.patientId === user?.id).map((item) => ({ title: item.scanType, meta: `${displayDate(item.date)} · ${item.bodyPart ?? 'Imaging'}`, status: item.status, href: '/dashboard/imaging' })),
    ],
  };

  const configs: Record<RoleKey, Parameters<typeof DashboardShell>[0]> = {
    patient: { role: 'patient', ...patientConfig },
    doctor: {
      role: 'doctor',
      metrics: [
        { label: "Today's appointments", value: doctorAppointments.filter((item) => item.date === today && isOpenAppointment(item)).length, helper: 'Visits scheduled for today', icon: <Calendar className="h-4 w-4" />, tone: 'primary', href: '/dashboard/appointments' },
        { label: 'Patients in your care', value: new Set(doctorAppointments.map((item) => item.patientId)).size, helper: 'Patients with appointments', icon: <Users className="h-4 w-4" />, tone: 'info', href: '/dashboard/patients' },
        { label: 'Awaiting review', value: pendingLabs.length + pendingImaging.length, helper: 'Lab and imaging results in progress', icon: <TestTube2 className="h-4 w-4" />, tone: 'warning', href: '/dashboard/lab-referrals' },
        { label: 'Open referrals', value: referrals.filter((item) => item.fromDoctorId === user?.id && item.status === 'pending').length, helper: 'Referrals awaiting action', icon: <FileText className="h-4 w-4" />, tone: 'neutral', href: '/dashboard/referrals' },
      ],
      workItems: appointmentItems(doctorAppointments.filter(isOpenAppointment)),
      actions: [
        { label: 'Open Consultation Room', href: '/dashboard/appointments', icon: <Video className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Record Clinical Note', href: '/dashboard/clinical-notes', icon: <FileText className="h-4 w-4" /> },
        { label: 'Order lab test', href: '/dashboard/lab-referrals', icon: <FlaskConical className="h-4 w-4" /> },
        { label: 'Draft Prescription', href: '/dashboard/prescriptions', icon: <Pill className="h-4 w-4" /> },
      ],
      signal: { label: 'Today', value: `${doctorAppointments.filter((item) => item.date === today && isOpenAppointment(item)).length} appointments scheduled`, detail: 'Review visits and items waiting for your action.', tone: 'primary' },
      secondaryTitle: 'Pending Diagnostics',
      secondaryItems: [
        ...pendingLabs.map((item) => ({ title: item.testName, meta: `${item.patientName} · ${item.destinationProviderName ?? 'Laboratory'}`, status: item.status, href: '/dashboard/lab-referrals' })),
        ...pendingImaging.map((item) => ({ title: item.scanType, meta: `${item.patientName} · ${item.destinationProviderName ?? 'Imaging Center'}`, status: item.status, href: '/dashboard/imaging-referrals' })),
      ],
    },
    physiotherapist: {
      role: 'physiotherapist',
      metrics: [
        { label: 'Therapy Sessions', value: doctorAppointments.filter(isOpenAppointment).length, helper: 'Scheduled regimes', icon: <Activity className="h-4 w-4" />, tone: 'primary', href: '/dashboard/appointments' },
        { label: 'Active Recoveries', value: new Set(doctorAppointments.map((item) => item.patientId)).size, helper: 'Active rehabilitation panels', icon: <Users className="h-4 w-4" />, tone: 'info', href: '/dashboard/patients' },
        { label: 'Care Templates', value: clinicalNotes.filter((item) => item.doctorId === user?.id).length, helper: 'Structured physical regimes', icon: <FileText className="h-4 w-4" />, tone: 'success', href: '/dashboard/clinical-notes' },
        { label: 'Clinical Referrals', value: visibleReferrals.length, helper: 'Department transitions', icon: <ArrowRight className="h-4 w-4" />, tone: 'warning', href: '/dashboard/referrals' },
      ],
      workItems: appointmentItems(doctorAppointments.filter(isOpenAppointment)),
      actions: [
        { label: 'View sessions', href: '/dashboard/appointments', icon: <Calendar className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Add clinical note', href: '/dashboard/clinical-notes', icon: <FileText className="h-4 w-4" /> },
        { label: 'Care timeline', href: '/dashboard/timeline', icon: <Clock3 className="h-4 w-4" /> },
        { label: 'Messages', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: 'Recovery plans', value: `${doctorAppointments.filter(isOpenAppointment).length} sessions scheduled`, detail: 'Review therapy plans and recovery notes.', tone: 'success' },
      secondaryTitle: 'Active Specialist Handoffs',
      secondaryItems: referralItems(visibleReferrals),
    },
    hospital: {
      role: 'hospital',
      metrics: [
        { label: 'Inbound Referrals', value: new Set(visibleReferrals.map((item) => item.patientId)).size, helper: 'Handoff medical archives', icon: <Users className="h-4 w-4" />, tone: 'primary', href: '/dashboard/patients' },
        { label: 'Verified Doctors', value: verifiedDoctors.length, helper: 'Active clinic providers', icon: <Stethoscope className="h-4 w-4" />, tone: 'success', href: '/dashboard/doctors' },
        { label: 'Pending Admissions', value: visibleReferrals.filter((item) => item.status === 'pending').length, helper: 'Department admissions', icon: <FileText className="h-4 w-4" />, tone: 'warning', href: '/dashboard/referrals' },
        { label: 'Active Alerts', value: activeEmergency.length, helper: 'Emergency dispatch tracking', icon: <Ambulance className="h-4 w-4" />, tone: activeEmergency.length ? 'critical' : 'neutral', href: '/dashboard/requests' },
      ],
      workItems: referralItems(visibleReferrals),
      actions: [
        { label: 'Authorize Referrals', href: '/dashboard/referrals', icon: <FileText className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Live Emergency Feed', href: '/dashboard/requests', icon: <Ambulance className="h-4 w-4" />, emphasis: activeEmergency.length ? 'danger' : undefined },
        { label: 'Clinician Roster', href: '/dashboard/doctors', icon: <Stethoscope className="h-4 w-4" /> },
        { label: 'Security Terminal', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: activeEmergency.length ? 'Emergency alert' : 'Admissions', value: `${visibleReferrals.filter((item) => item.status === 'pending').length} referrals awaiting review`, detail: 'Coordinate incoming referrals and transfers.', tone: activeEmergency.length ? 'critical' : 'primary' },
      secondaryTitle: 'Emergency requests',
      secondaryItems: activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · Priority Code`, status: item.status, href: '/dashboard/requests' })),
    },
    laboratory: {
      role: 'laboratory',
      metrics: [
        { label: 'Diagnostic Orders', value: labTests.filter((item) => item.status === 'requested').length, helper: 'Awaiting sample registration', icon: <FlaskConical className="h-4 w-4" />, tone: 'warning', href: '/dashboard/test-requests' },
        { label: 'Assays Active', value: labTests.filter((item) => item.status === 'in-progress').length, helper: 'Biological assays active', icon: <Activity className="h-4 w-4" />, tone: 'info', href: '/dashboard/test-requests' },
        { label: 'Verified Reports', value: labTests.filter((item) => item.status === 'completed').length, helper: 'Diagnostics returned to EMR', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'success', href: '/dashboard/results' },
        { label: 'Critical Alert', value: labTests.filter((item) => item.notes?.toLowerCase().includes('critical')).length, helper: 'Out-of-range biological values', icon: <AlertTriangle className="h-4 w-4" />, tone: 'critical', href: '/dashboard/lab-results-management' },
      ],
      workItems: pendingLabs.map((item) => ({ title: item.testName, meta: `${item.patientName} · ordered by ${item.doctorName}`, status: item.status, href: '/dashboard/test-requests' })),
      actions: [
        { label: 'Review test queue', href: '/dashboard/test-requests', icon: <FlaskConical className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Share results', href: '/dashboard/lab-results-management', icon: <FileText className="h-4 w-4" /> },
        { label: 'Review result summary', href: '/dashboard/results', icon: <BadgeCheck className="h-4 w-4" /> },
        { label: 'Messages', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: 'Lab requests', value: `${pendingLabs.length} results awaiting review`, detail: 'Review incoming requests and publish completed results.', tone: pendingLabs.length ? 'warning' : 'success' },
      secondaryTitle: 'Recent lab results',
      secondaryItems: sortByDateDesc(labTests).map((item) => ({ title: item.testName, meta: `${item.patientName} · ${displayDate(item.date)}`, status: item.status, href: '/dashboard/results' })),
    },
    imaging: {
      role: 'imaging',
      metrics: [
        { label: 'Study Requests', value: imagingScans.filter((item) => item.status === 'requested').length, helper: 'Awaiting equipment scheduling', icon: <ScanLine className="h-4 w-4" />, tone: 'warning', href: '/dashboard/scan-requests' },
        { label: 'Scans in progress', value: imagingScans.filter((item) => item.status === 'in-progress').length, helper: 'Scans being processed', icon: <Activity className="h-4 w-4" />, tone: 'info', href: '/dashboard/imaging-referrals' },
        { label: 'Completed Studies', value: imagingScans.filter((item) => item.status === 'completed').length, helper: 'Findings published to EMR', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'success', href: '/dashboard/results' },
        { label: 'Clinical Referrals', value: visibleReferrals.filter((item) => item.referralType === 'imaging').length, helper: 'Referral diagnostics queued', icon: <FileText className="h-4 w-4" />, tone: 'neutral', href: '/dashboard/imaging-referrals' },
      ],
      workItems: pendingImaging.map((item) => ({ title: `${item.scanType}${item.bodyPart ? ` · ${item.bodyPart}` : ''}`, meta: `${item.patientName} · ${item.clinicalIndication ?? item.doctorName}`, status: item.status, href: '/dashboard/scan-requests' })),
      actions: [
        { label: 'Schedule imaging', href: '/dashboard/scan-requests', icon: <Calendar className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Open referral queue', href: '/dashboard/imaging-referrals', icon: <ScanLine className="h-4 w-4" /> },
        { label: 'Publish study results', href: '/dashboard/results', icon: <FileText className="h-4 w-4" /> },
        { label: 'Messages', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: 'Imaging queue', value: `${pendingImaging.length} studies scheduled`, detail: 'Equipment timetables and imaging pathways are secured.', tone: pendingImaging.length ? 'warning' : 'success' },
      secondaryTitle: 'Historical Radiology',
      secondaryItems: sortByDateDesc(imagingScans).map((item) => ({ title: item.scanType, meta: `${item.patientName} · ${displayDate(item.date)}`, status: item.status, href: '/dashboard/results' })),
    },
    pharmacy: {
      role: 'pharmacy',
      metrics: [
        { label: 'Fulfillment Queue', value: activePrescriptions.length, helper: 'Awaiting clinician verification', icon: <Pill className="h-4 w-4" />, tone: 'warning', href: '/dashboard/prescriptions' },
        { label: 'Dispensed Orders', value: prescriptions.filter((item) => item.status === 'dispensed').length, helper: 'Completed fulfillments', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'success', href: '/dashboard/prescriptions' },
        { label: 'Inventory Warning', value: lowStock.length, helper: 'Below safe-stock metrics', icon: <Package className="h-4 w-4" />, tone: lowStock.length ? 'critical' : 'success', href: '/dashboard/inventory' },
        { label: 'Refill Requests', value: prescriptions.flatMap((item) => item.refillRequests ?? []).filter((item) => item.status === 'pending').length, helper: 'Pharmacist validation pending', icon: <Clock3 className="h-4 w-4" />, tone: 'info', href: '/dashboard/prescriptions' },
      ],
      workItems: activePrescriptions.map((item) => ({ title: item.patientName, meta: `${item.medications[0]?.name ?? 'Medication'}${item.medications.length > 1 ? ` +${item.medications.length - 1}` : ''} · ${item.doctorName}`, status: item.status, href: '/dashboard/prescriptions' })),
      actions: [
        { label: 'Verify prescription sign-off', href: '/dashboard/prescriptions', icon: <Pill className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Replenish stock', href: '/dashboard/inventory', icon: <Package className="h-4 w-4" />, emphasis: lowStock.length ? 'danger' : undefined },
        { label: 'Referral requests', href: '/dashboard/pharmacy-referrals', icon: <FileText className="h-4 w-4" /> },
        { label: 'Messages', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: lowStock.length ? 'Replenish Alert' : 'Drug Safety Clear', value: `${activePrescriptions.length} Refills Queued`, detail: 'Dosage limits and clinician credentials validated.', tone: lowStock.length ? 'critical' : 'primary' },
      secondaryTitle: 'Stock Warning Logs',
      secondaryItems: lowStock.map((item) => ({ title: item.name, meta: `${item.stock} ${item.unit} remaining · reorder at ${item.reorderLevel}`, status: item.status, href: '/dashboard/inventory' })),
    },
    ambulance: {
      role: 'ambulance',
      metrics: [
        { label: 'Active Alerts', value: activeEmergency.length, helper: 'Trauma response cases', icon: <Radio className="h-4 w-4" />, tone: activeEmergency.length ? 'critical' : 'success', href: '/dashboard/requests' },
        { label: 'Critical Incidents', value: criticalEmergency.length, helper: 'Life-threatening dispatches', icon: <AlertTriangle className="h-4 w-4" />, tone: criticalEmergency.length ? 'critical' : 'neutral', href: '/dashboard/requests' },
        { label: 'Available units', value: ambulances.filter((item) => item.status === 'available').length, helper: 'Units ready for dispatch', icon: <Ambulance className="h-4 w-4" />, tone: 'success', href: '/dashboard/vehicles' },
        { label: 'Dispatched Units', value: ambulances.filter((item) => ['dispatched', 'in-transit', 'on-scene'].includes(item.status)).length, helper: 'Active emergency transit', icon: <MapPin className="h-4 w-4" />, tone: 'info', href: '/dashboard/vehicles' },
      ],
      workItems: activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · ${item.time} · ${item.priority} Priority`, status: item.status, href: '/dashboard/requests', tone: item.priority === 'critical' || item.priority === 'high' ? 'critical' : statusTone(item.status) })),
      actions: [
        { label: 'Deploy incident unit', href: '/dashboard/requests', icon: <Radio className="h-4 w-4" />, emphasis: activeEmergency.length ? 'danger' : 'primary' },
        { label: 'Track fleet', href: '/dashboard/vehicles', icon: <Ambulance className="h-4 w-4" /> },
        { label: 'Message trauma team', href: '/dashboard/messages', icon: <Hospital className="h-4 w-4" /> },
        { label: 'Care map', href: '/dashboard/requests', icon: <MapPin className="h-4 w-4" /> },
      ],
      signal: { label: criticalEmergency.length ? 'Priority call' : 'Dispatch status', value: `${activeEmergency.length} active calls`, detail: 'Review active requests and available units.', tone: criticalEmergency.length ? 'critical' : 'success' },
      secondaryTitle: 'Vehicle status',
      secondaryItems: ambulances.map((item) => ({ title: item.callSign, meta: `${item.plateNumber} · Fuel ${item.fuel}%`, status: item.status, href: '/dashboard/vehicles' })),
    },
    admin: {
      role: 'admin',
      metrics: [
        { label: 'Users', value: users.length, helper: 'Registered user accounts', icon: <Users className="h-4 w-4" />, tone: 'primary', href: '/dashboard/users' },
        { label: 'Credential Reviews', value: pendingVerifications.length, helper: 'Providers seeking registration review', icon: <ShieldCheck className="h-4 w-4" />, tone: pendingVerifications.length ? 'warning' : 'success', href: '/dashboard/verifications' },
        { label: 'Clinical Session Vol', value: openAppointments.length, helper: 'Active consultations', icon: <Activity className="h-4 w-4" />, tone: 'info', href: '/dashboard/analytics' },
        { label: 'Active Alerts', value: activeEmergency.length, helper: 'Trauma incidents active', icon: <Ambulance className="h-4 w-4" />, tone: activeEmergency.length ? 'critical' : 'neutral', href: '/dashboard/notifications' },
      ],
      workItems: pendingVerifications.map((item) => ({ title: item.name, meta: `${item.role} · ${item.email}`, status: item.status, href: '/dashboard/verifications' })),
      actions: [
        { label: 'Audit credentials', href: '/dashboard/verifications', icon: <ShieldCheck className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Register active users', href: '/dashboard/users', icon: <Users className="h-4 w-4" /> },
        { label: 'Care analytics', href: '/dashboard/analytics', icon: <Activity className="h-4 w-4" /> },
        { label: 'Global alerts', href: '/dashboard/notifications', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: 'Verifications', value: `${pendingVerifications.length} pending`, detail: 'Review access requests and recent activity.', tone: pendingVerifications.length ? 'warning' : 'success' },
      secondaryTitle: 'Recent activity',
      secondaryItems: [
        ...appointmentItems(openAppointments, '/dashboard/appointments'),
        ...activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · Emergency`, status: item.status, href: '/dashboard/requests' })),
      ],
    },
    super_admin: {
      role: 'super_admin',
      metrics: [
        { label: 'Global Platform Users', value: users.length, helper: 'Active registered patients and specialists', icon: <Users className="h-4 w-4" />, tone: 'primary', href: '/dashboard/users' },
        { label: 'Organizations', value: users.filter((item) => ['hospital', 'laboratory', 'imaging', 'pharmacy', 'ambulance'].includes(normalizeUserRole(item.role) ?? '')).length, helper: 'Registered care organizations', icon: <Building2 className="h-4 w-4" />, tone: 'info', href: '/dashboard/users' },
        { label: 'Outstanding Alerts', value: pendingVerifications.length + activeEmergency.length + lowStock.length, helper: 'Critical system warnings pending', icon: <AlertTriangle className="h-4 w-4" />, tone: pendingVerifications.length + activeEmergency.length + lowStock.length ? 'warning' : 'success', href: '/dashboard/audit' },
        { label: 'Ecosystem Payments', value: billingRecords.length + invoices.length, helper: 'Active financial records', icon: <FileText className="h-4 w-4" />, tone: 'neutral', href: '/dashboard/admin-billing' },
      ],
      workItems: [
        ...pendingVerifications.map((item) => ({ title: item.name, meta: `${item.role} verification · ${item.email}`, status: item.status, href: '/dashboard/verifications' })),
        ...activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · ${item.priority} Priority`, status: item.status, href: '/dashboard/requests', tone: item.priority === 'critical' || item.priority === 'high' ? 'critical' : statusTone(item.status) })),
        ...lowStock.map((item) => ({ title: item.name, meta: `${item.stock} ${item.unit} remaining`, status: item.status, href: '/dashboard/inventory' })),
      ],
      actions: [
        { label: 'View analytics', href: '/dashboard/analytics', icon: <Activity className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'View audit log', href: '/dashboard/audit', icon: <ShieldCheck className="h-4 w-4" /> },
        { label: 'View billing', href: '/dashboard/admin-billing', icon: <FileText className="h-4 w-4" /> },
        { label: 'Register Secondary Admin', href: '/dashboard/admin/create', icon: <BadgeCheck className="h-4 w-4" /> },
      ],
      signal: { label: 'System overview', value: `${users.length} registered users`, detail: 'Review organizations, access requests, and recent activity.', tone: 'primary' },
      secondaryTitle: 'Care activity flow',
      secondaryItems: appointmentItems(openAppointments, '/dashboard/appointments'),
    },
  };

  return <DashboardShell {...(configs[role] ?? configs.patient)} />;
}
