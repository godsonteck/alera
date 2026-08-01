import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Sparkles,
  Stethoscope,
  TestTube2,
  Users,
  Video,
  Database,
  Terminal,
  ActivitySquare
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { DiagnosticStream } from '@/components/DiagnosticStream';
import { PatientGenomeTimeline } from '@/components/PatientGenomeTimeline';
import { ClinicalRadar } from '@/components/ClinicalRadar';
import { PredictiveInsightLayer } from '@/components/PredictiveInsightLayer';
import { CareNetworkOrbit } from '@/components/CareNetworkOrbit';
import { SynchronousCareContinuum } from '@/components/canvas/SynchronousCareContinuum';
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
    eyebrow: 'Patient view',
    title: 'Your care pathway',
    summary: 'A clear overview of appointments, prescription plans, lab diagnostics, and discharge information.',
    focus: 'Access care resources, review medical records, and message your providers.',
    icon: <HeartPulse className="h-4 w-4 text-cyan-400" />,
  },
  doctor: {
    eyebrow: 'Clinician workspace',
    title: 'Care plan overview',
    summary: 'Visits, symptom history, previous lab findings, and quick access to referrals and next steps.',
    focus: 'Review active records, draft prescriptions, and send referrals.',
    icon: <Stethoscope className="h-4 w-4 text-cyan-400" />,
  },
  physiotherapist: {
    eyebrow: 'Recovery workspace',
    title: 'Rehabilitation plans',
    summary: 'Track therapy adherence, milestones, progress notes, and patient handoffs.',
    focus: 'Build therapy plans and monitor recovery progress.',
    icon: <Activity className="h-4 w-4 text-cyan-400" />,
  },
  hospital: {
    eyebrow: 'Hospital coordination',
    title: 'Admissions and transfers',
    summary: 'Manage incoming referrals, ambulance updates, bed availability, and staff coordination.',
    focus: 'Coordinate transfers across departments and teams.',
    icon: <Hospital className="h-4 w-4 text-amber-400" />,
  },
  laboratory: {
    eyebrow: 'Lab workflow',
    title: 'Lab results and sample tracking',
    summary: 'Track incoming samples, review test requests, and publish verified lab findings.',
    focus: 'Confirm results and send them directly into the care record.',
    icon: <FlaskConical className="h-4 w-4 text-cyan-400" />,
  },
  imaging: {
    eyebrow: 'Imaging workflow',
    title: 'Imaging requests and reports',
    summary: 'Manage scan requests, scheduling, imaging reports, and results distribution.',
    focus: 'Coordinate scans and share findings with the right clinician.',
    icon: <ScanLine className="h-4 w-4 text-cyan-400" />,
  },
  pharmacy: {
    eyebrow: 'Pharmacy workflow',
    title: 'Prescriptions and dispensing',
    summary: 'Review medication orders, verify clinician signatures, manage inventory, and track refill readiness.',
    focus: 'Dispense medication safely and keep stock updated.',
    icon: <Pill className="h-4 w-4 text-cyan-400" />,
  },
  ambulance: {
    eyebrow: 'Emergency dispatch',
    title: 'Emergency response and routing',
    summary: 'Track urgent dispatch queues, vehicle status, patient updates, and destination coordination.',
    focus: 'Send responders and keep hospital teams informed.',
    icon: <Ambulance className="h-4 w-4 text-red-400" />,
  },
  admin: {
    eyebrow: 'Admin oversight',
    title: 'Platform review and compliance',
    summary: 'Review clinician verification, user registrations, security logs, and platform activity.',
    focus: 'Confirm access requests and audit platform activity.',
    icon: <ShieldCheck className="h-4 w-4 text-cyan-400" />,
  },
  super_admin: {
    eyebrow: 'System administration',
    title: 'Operations and records',
    summary: 'Review active organizations, system-wide activity, and key administrative records.',
    focus: 'Manage admin access and review system activity.',
    icon: <BadgeCheck className="h-4 w-4 text-cyan-400" />,
  },
};

const toneClasses: Record<Tone, string> = {
  primary: 'border-[#252A35] bg-[#151922] text-[#ECEEF2]',
  success: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400 font-semibold',
  warning: 'border-amber-500/40 bg-amber-950/20 text-amber-400 font-semibold',
  critical: 'border-red-500/40 bg-red-950/20 text-red-400 font-semibold',
  emergency: 'border-red-500 bg-red-950 text-white font-bold animate-pulse',
  info: 'border-[#252A35] bg-[#0F1218] text-slate-300 font-semibold',
  neutral: 'border-[#252A35] bg-[#0F1218] text-slate-400',
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
    <div className="space-y-6 text-[#ECEEF2] font-mono">
      <SynchronousCareContinuum />

      {/* Workspace header */}
      <div className="relative overflow-hidden rounded-[4px] border border-[#252A35] bg-[#090D14] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-[2px] border border-[#252A35] bg-[#0F1218] px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
              {copy.icon}
              <span>{copy.eyebrow}</span>
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[#ECEEF2] font-mono">
              {copy.title}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-400 max-w-3xl">
              {copy.summary}
            </p>
          </div>

          <div className="rounded-[2px] border border-[#252A35] bg-[#0F1218] p-3 min-w-[220px]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Current focus</p>
            <h2 className="mt-0.5 text-sm font-bold text-[#ECEEF2]">{signal.value}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{signal.detail}</p>
            <div className="mt-2 pt-2 border-t border-[#252A35] flex justify-between items-center text-[10px]">
              <span className="text-slate-500 uppercase">Status</span>
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
            className="group relative flex flex-col justify-between rounded-[4px] border border-[#252A35] bg-[#090D14] p-4 hover:border-slate-600 transition-colors"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{metric.label}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-[2px] border ${toneClasses[metric.tone]}`}>
                {metric.icon}
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#ECEEF2] tracking-tight font-mono">
                {metric.value}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">{metric.helper}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Interactive Clinical Stream Modules */}
      <div className="space-y-6">
        {role === 'patient' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <PatientGenomeTimeline />
            </div>
            <div className="lg:col-span-4">
              <PredictiveInsightLayer />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6">
              <ClinicalRadar />
            </div>
            <div className="lg:col-span-6">
              <PredictiveInsightLayer />
            </div>
          </div>
        )}
      </div>

      {/* Task Queue and Actions */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Core Task Queue List */}
        <section className="rounded-[4px] border border-[#252A35] bg-[#090D14] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#252A35] pb-3 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Clinical Queue</p>
              <h2 className="text-sm font-bold text-[#ECEEF2] mt-0.5">
                {role === 'patient' ? 'Active Care Resources' : 'Task Queue'}
              </h2>
            </div>
            <Link to={actions[0]?.href ?? '/dashboard'} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-cyan-400 hover:text-cyan-300">
              Open Workspace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {workItems.length > 0 ? (
              workItems.slice(0, 6).map((item, idx) => (
                <Link
                  key={`${item.title}-${item.meta}-${idx}`}
                  to={item.href}
                  className="flex items-center justify-between gap-3 rounded-[2px] border border-[#252A35] bg-[#0F1218] p-3 hover:border-slate-600 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] text-slate-500 font-mono">0{idx + 1}</span>
                    <div>
                      <strong className="text-xs font-bold text-[#ECEEF2] group-hover:text-cyan-300 transition-colors block">
                        {item.title}
                      </strong>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{item.meta}</span>
                    </div>
                  </div>
                  <span className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${toneClasses[item.tone ?? statusTone(item.status)]}`}>
                    {item.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-[#252A35] rounded-[2px]">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <strong className="text-xs text-[#ECEEF2] mt-2 block">Everything is up to date</strong>
                <span className="text-[11px] text-slate-400 max-w-sm mt-0.5">No outstanding items need action right now.</span>
              </div>
            )}
          </div>
        </section>

        {/* Action Gateways */}
        <aside className="space-y-4">
          <section className="rounded-[4px] border border-[#252A35] bg-[#090D14] p-4 sm:p-5">
            <div className="border-b border-[#252A35] pb-2 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Quick access</p>
              <h2 className="text-xs font-bold text-[#ECEEF2] mt-0.5">Common actions</h2>
            </div>

            <div className="grid gap-1.5">
              {actions.map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className={`flex items-center justify-between rounded-[2px] border p-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    action.emphasis === 'danger'
                      ? 'border-red-600/60 bg-red-950/40 text-red-300 hover:bg-red-900/60'
                      : action.emphasis === 'primary'
                      ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60'
                      : 'border-[#252A35] bg-[#0F1218] text-slate-300 hover:bg-[#151922] hover:text-[#ECEEF2]'
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
          <section className="rounded-[4px] border border-[#252A35] bg-[#090D14] p-4 sm:p-5">
            <div className="border-b border-[#252A35] pb-2 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Recent activity</p>
              <h2 className="text-xs font-bold text-[#ECEEF2] mt-0.5">{secondaryTitle}</h2>
            </div>

            <div className="space-y-1.5">
              {secondaryItems.length > 0 ? (
                secondaryItems.slice(0, 4).map((item, idx) => (
                  <Link
                    key={`${item.title}-${item.meta}-${idx}`}
                    to={item.href}
                    className="flex items-center justify-between p-2.5 rounded-[2px] border border-[#252A35] bg-[#0F1218] hover:border-slate-600 transition-colors"
                  >
                    <div>
                      <strong className="block text-xs font-semibold text-[#ECEEF2]">{item.title}</strong>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{item.meta}</span>
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
                  No secondary logs found on this node.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Security and access notes */}
      <section className="grid gap-3 md:grid-cols-2 rounded-[4px] border border-[#252A35] bg-[#090D14] p-4 text-xs font-mono">
        <div className="flex items-start gap-2.5">
          <Terminal className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-[#ECEEF2]">Access and audit</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Clinician workspaces are reviewed regularly to keep care access secure and accountable.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Database className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-[#ECEEF2]">Security record</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identity signature: {user?.name ? `${user.name.toUpperCase()}` : 'GUEST'}. Audit records are kept in the platform log.
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
      { label: 'Upcoming Consultations', value: patientAppointments.filter(isOpenAppointment).length, helper: 'Scheduled or confirmed consults', icon: <Calendar className="h-4 w-4" />, tone: 'primary' as Tone, href: '/dashboard/appointments' },
      { label: 'Prescription Regimes', value: prescriptions.filter((item) => item.patientId === user?.id && item.status === 'active').length, helper: 'Active clinical regimes', icon: <Pill className="h-4 w-4" />, tone: 'success' as Tone, href: '/dashboard/prescriptions' },
      { label: 'Laboratory Diagnostics', value: labTests.filter((item) => item.patientId === user?.id).length, helper: 'Synchronized diagnostic tests', icon: <FlaskConical className="h-4 w-4" />, tone: 'info' as Tone, href: '/dashboard/lab-results' },
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
      { label: 'Schedule Consult', href: '/dashboard/appointments', icon: <Calendar className="h-4 w-4" />, emphasis: 'primary' as const },
      { label: 'Request Emergency Help', href: '/dashboard/ambulance', icon: <Ambulance className="h-4 w-4" />, emphasis: 'danger' as const },
      { label: 'Message Primary', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      { label: 'Timeline', href: '/dashboard/timeline', icon: <Clock3 className="h-4 w-4" /> },
    ],
    signal: { label: 'Care status', value: 'Care network synced', detail: 'Care pathways authorized. Credentials verified.', tone: 'success' as Tone },
    secondaryTitle: 'Secondary Trace',
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
        { label: "Visits Scheduled", value: doctorAppointments.filter((item) => item.date === today && isOpenAppointment(item)).length, helper: 'Active consult queues', icon: <Calendar className="h-4 w-4" />, tone: 'primary', href: '/dashboard/appointments' },
        { label: 'Assigned Patients', value: new Set(doctorAppointments.map((item) => item.patientId)).size, helper: 'Active clinic panel nodes', icon: <Users className="h-4 w-4" />, tone: 'info', href: '/dashboard/patients' },
        { label: 'Pending Diagnoses', value: pendingLabs.length + pendingImaging.length, helper: 'Awaiting laboratory diagnostics', icon: <TestTube2 className="h-4 w-4" />, tone: 'warning', href: '/dashboard/lab-referrals' },
        { label: 'Outbound Referrals', value: referrals.filter((item) => item.fromDoctorId === user?.id && item.status === 'pending').length, helper: 'Specialist transitions pending', icon: <FileText className="h-4 w-4" />, tone: 'neutral', href: '/dashboard/referrals' },
      ],
      workItems: appointmentItems(doctorAppointments.filter(isOpenAppointment)),
      actions: [
        { label: 'Open Consultation Room', href: '/dashboard/appointments', icon: <Video className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Record Clinical Note', href: '/dashboard/clinical-notes', icon: <FileText className="h-4 w-4" /> },
        { label: 'Order Diagnostic Assay', href: '/dashboard/lab-referrals', icon: <FlaskConical className="h-4 w-4" /> },
        { label: 'Draft Prescription', href: '/dashboard/prescriptions', icon: <Pill className="h-4 w-4" /> },
      ],
      signal: { label: 'Active session', value: `${doctorAppointments.filter((item) => item.date === today && isOpenAppointment(item)).length} scheduled today`, detail: 'Care timelines and references validated.', tone: 'primary' },
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
        { label: 'Open Therapy Console', href: '/dashboard/appointments', icon: <Calendar className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Edit Physical Regime', href: '/dashboard/clinical-notes', icon: <FileText className="h-4 w-4" /> },
        { label: 'Verify Patient Timeline', href: '/dashboard/timeline', icon: <Clock3 className="h-4 w-4" /> },
        { label: 'Secure Message Box', href: '/dashboard/messages', icon: <MessageSquare className="h-4 w-4" /> },
      ],
      signal: { label: 'Care verified', value: 'Rehabilitation hub synced', detail: 'Prescription timelines and exercise compliance are secured.', tone: 'success' },
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
      signal: { label: activeEmergency.length ? 'Emergency alert' : 'Admissions clear', value: `${visibleReferrals.filter((item) => item.status === 'pending').length} referrals mapped`, detail: 'Roster timelines and bed spaces are secured.', tone: activeEmergency.length ? 'critical' : 'primary' },
      secondaryTitle: 'Trauma Unit Fleet',
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
      signal: { label: 'Assay Syncing', value: `${pendingLabs.length} Samples Unverified`, detail: 'Verify critical biological bounds prior to dispatch.', tone: pendingLabs.length ? 'warning' : 'success' },
      secondaryTitle: 'Historical Diagnostics',
      secondaryItems: sortByDateDesc(labTests).map((item) => ({ title: item.testName, meta: `${item.patientName} · ${displayDate(item.date)}`, status: item.status, href: '/dashboard/results' })),
    },
    imaging: {
      role: 'imaging',
      metrics: [
        { label: 'Study Requests', value: imagingScans.filter((item) => item.status === 'requested').length, helper: 'Awaiting equipment scheduling', icon: <ScanLine className="h-4 w-4" />, tone: 'warning', href: '/dashboard/scan-requests' },
        { label: 'Active DICOM Studies', value: imagingScans.filter((item) => item.status === 'in-progress').length, helper: 'Active PACS study acquisitions', icon: <Activity className="h-4 w-4" />, tone: 'info', href: '/dashboard/imaging-referrals' },
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
        { label: 'Available Rigs', value: ambulances.filter((item) => item.status === 'available').length, helper: 'Rigs fueled & parked', icon: <Ambulance className="h-4 w-4" />, tone: 'success', href: '/dashboard/vehicles' },
        { label: 'Dispatched Units', value: ambulances.filter((item) => ['dispatched', 'in-transit', 'on-scene'].includes(item.status)).length, helper: 'Active emergency transit', icon: <MapPin className="h-4 w-4" />, tone: 'info', href: '/dashboard/vehicles' },
      ],
      workItems: activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · ${item.time} · ${item.priority} Priority`, status: item.status, href: '/dashboard/requests', tone: item.priority === 'critical' || item.priority === 'high' ? 'critical' : statusTone(item.status) })),
      actions: [
        { label: 'Deploy incident unit', href: '/dashboard/requests', icon: <Radio className="h-4 w-4" />, emphasis: activeEmergency.length ? 'danger' : 'primary' },
        { label: 'Track fleet', href: '/dashboard/vehicles', icon: <Ambulance className="h-4 w-4" /> },
        { label: 'Message trauma team', href: '/dashboard/messages', icon: <Hospital className="h-4 w-4" /> },
        { label: 'Care map', href: '/dashboard/requests', icon: <MapPin className="h-4 w-4" /> },
      ],
      signal: { label: criticalEmergency.length ? 'Priority Trauma' : 'Rig Standby', value: `${activeEmergency.length} Emergencies Active`, detail: 'Hospital bed schedules and fleet targets verified.', tone: criticalEmergency.length ? 'critical' : 'success' },
      secondaryTitle: 'Trauma Fleet Status',
      secondaryItems: ambulances.map((item) => ({ title: item.callSign, meta: `${item.plateNumber} · Fuel ${item.fuel}%`, status: item.status, href: '/dashboard/vehicles' })),
    },
    admin: {
      role: 'admin',
      metrics: [
        { label: 'Identity Nodes', value: users.length, helper: 'Active medical credentials', icon: <Users className="h-4 w-4" />, tone: 'primary', href: '/dashboard/users' },
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
      signal: { label: 'Compliance Lock', value: `${pendingVerifications.length} Verifications Pending`, detail: 'Global credentials verified. Database encryption verified.', tone: pendingVerifications.length ? 'warning' : 'success' },
      secondaryTitle: 'Platform Security Logs',
      secondaryItems: [
        ...appointmentItems(openAppointments, '/dashboard/appointments'),
        ...activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · Emergency`, status: item.status, href: '/dashboard/requests' })),
      ],
    },
    super_admin: {
      role: 'super_admin',
      metrics: [
        { label: 'Global Platform Users', value: users.length, helper: 'Active registered patients and specialists', icon: <Users className="h-4 w-4" />, tone: 'primary', href: '/dashboard/users' },
        { label: 'Clinical Organizations', value: users.filter((item) => ['hospital', 'laboratory', 'imaging', 'pharmacy', 'ambulance'].includes(normalizeUserRole(item.role) ?? '')).length, helper: 'Active corporate medical nodes', icon: <Building2 className="h-4 w-4" />, tone: 'info', href: '/dashboard/users' },
        { label: 'Outstanding Alerts', value: pendingVerifications.length + activeEmergency.length + lowStock.length, helper: 'Critical system warnings pending', icon: <AlertTriangle className="h-4 w-4" />, tone: pendingVerifications.length + activeEmergency.length + lowStock.length ? 'warning' : 'success', href: '/dashboard/audit' },
        { label: 'Ecosystem Payments', value: billingRecords.length + invoices.length, helper: 'Active financial records', icon: <FileText className="h-4 w-4" />, tone: 'neutral', href: '/dashboard/admin-billing' },
      ],
      workItems: [
        ...pendingVerifications.map((item) => ({ title: item.name, meta: `${item.role} verification · ${item.email}`, status: item.status, href: '/dashboard/verifications' })),
        ...activeEmergency.map((item) => ({ title: item.patientName, meta: `${item.location} · ${item.priority} Priority`, status: item.status, href: '/dashboard/requests', tone: item.priority === 'critical' || item.priority === 'high' ? 'critical' : statusTone(item.status) })),
        ...lowStock.map((item) => ({ title: item.name, meta: `${item.stock} ${item.unit} remaining`, status: item.status, href: '/dashboard/inventory' })),
      ],
      actions: [
        { label: 'Ecosystem Analytics', href: '/dashboard/analytics', icon: <Activity className="h-4 w-4" />, emphasis: 'primary' },
        { label: 'Immutable Audit Logs', href: '/dashboard/audit', icon: <ShieldCheck className="h-4 w-4" /> },
        { label: 'Ecosystem Payments Matrix', href: '/dashboard/admin-billing', icon: <FileText className="h-4 w-4" /> },
        { label: 'Register Secondary Admin', href: '/dashboard/admin/create', icon: <BadgeCheck className="h-4 w-4" /> },
      ],
      signal: { label: 'Care overview', value: `${users.length} active care nodes`, detail: 'Database replication verified. SOC2 metrics green.', tone: 'primary' },
      secondaryTitle: 'Care activity flow',
      secondaryItems: appointmentItems(openAppointments, '/dashboard/appointments'),
    },
  };

  return <DashboardShell {...(configs[role] ?? configs.patient)} />;
}
