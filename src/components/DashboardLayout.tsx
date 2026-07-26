import { useState, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useNotifications } from '@/contexts/useNotifications';
import NotificationCenter from '@/components/NotificationCenter';
import ChatWidget from '@/components/ChatWidget';
import { ThemeSelector } from '@/components/ThemeSelector';
import { normalizeUserRole } from '@/lib/roleUtils';
import {
  getProfessionalVerificationStatus,
  getVerificationStatusLabel,
} from '@/lib/verificationStatus';
import {
  Heart, LayoutDashboard, Calendar, FileText, FlaskConical, ScanLine,
  Pill, Ambulance, Users, Building2, ShieldCheck, Activity, Bell, AlertCircle,
  LogOut, Menu, X, Clock, MessageSquare, Settings, HeartPulse, Mail, Terminal,
  UserCheck, ShieldAlert
} from 'lucide-react';
import { ContextDock } from '@/components/ContextDock';

const roleNavItems: Record<string, { label: string; icon: React.ReactNode; path: string }[]> = {
  patient: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Visits Calendar', icon: <Calendar className="w-4 h-4" />, path: '/dashboard/appointments' },
    { label: 'Node Alerts', icon: <Bell className="w-4 h-4" />, path: '/dashboard/appointment-reminders' },
    { label: 'Biometrics Feed', icon: <HeartPulse className="w-4 h-4" />, path: '/dashboard/health-metrics' },
    { label: 'Prescriptions Node', icon: <Pill className="w-4 h-4" />, path: '/dashboard/prescriptions' },
    { label: 'Lab Telemetry', icon: <FlaskConical className="w-4 h-4" />, path: '/dashboard/lab-results' },
    { label: 'Scan Modality', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/imaging' },
    { label: 'Ambulance Dispatch', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/ambulance' },
    { label: 'Ecosystem Trace', icon: <Clock className="w-4 h-4" />, path: '/dashboard/timeline' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  doctor: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Visits Calendar', icon: <Calendar className="w-4 h-4" />, path: '/dashboard/appointments' },
    { label: 'Node Alerts', icon: <Bell className="w-4 h-4" />, path: '/dashboard/appointment-reminders' },
    { label: 'Patient Register', icon: <Users className="w-4 h-4" />, path: '/dashboard/patients' },
    { label: 'Prescriptions Node', icon: <FileText className="w-4 h-4" />, path: '/dashboard/prescriptions' },
    { label: 'Lab Dispatch', icon: <FlaskConical className="w-4 h-4" />, path: '/dashboard/lab-referrals' },
    { label: 'Scan Dispatch', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/imaging-referrals' },
    { label: 'Pharmacy Dispatch', icon: <Pill className="w-4 h-4" />, path: '/dashboard/pharmacy-referrals' },
    { label: 'Outbound Referrals', icon: <FileText className="w-4 h-4" />, path: '/dashboard/referrals' },
    { label: 'Ambulance Tracking', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/requests' },
    { label: 'Ecosystem Trace', icon: <Clock className="w-4 h-4" />, path: '/dashboard/timeline' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  physiotherapist: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Visits Calendar', icon: <Calendar className="w-4 h-4" />, path: '/dashboard/appointments' },
    { label: 'Patient Register', icon: <Users className="w-4 h-4" />, path: '/dashboard/patients' },
    { label: 'Therapy Regimes', icon: <FileText className="w-4 h-4" />, path: '/dashboard/clinical-notes' },
    { label: 'Specialist Referrals', icon: <Activity className="w-4 h-4" />, path: '/dashboard/referrals' },
    { label: 'Ecosystem Trace', icon: <Clock className="w-4 h-4" />, path: '/dashboard/timeline' },
    { label: 'Pricing Matrix', icon: <Pill className="w-4 h-4" />, path: '/dashboard/pricing-settings' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  hospital: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Patient Register', icon: <Users className="w-4 h-4" />, path: '/dashboard/patients' },
    { label: 'Ambulance Tracking', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/requests' },
    { label: 'Outbound Referrals', icon: <FileText className="w-4 h-4" />, path: '/dashboard/referrals' },
    { label: 'Clinical Roster', icon: <Heart className="w-4 h-4" />, path: '/dashboard/doctors' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  laboratory: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Assay Backlog', icon: <FlaskConical className="w-4 h-4" />, path: '/dashboard/test-requests' },
    { label: 'Assay Results', icon: <FileText className="w-4 h-4" />, path: '/dashboard/results' },
    { label: 'Upload Module', icon: <FileText className="w-4 h-4" />, path: '/dashboard/lab-results-management' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  imaging: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'DICOM Requests', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/scan-requests' },
    { label: 'Inbound Referrals', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/imaging-referrals' },
    { label: 'Scan Results', icon: <FileText className="w-4 h-4" />, path: '/dashboard/results' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  pharmacy: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Dispense Queue', icon: <Pill className="w-4 h-4" />, path: '/dashboard/prescriptions' },
    { label: 'Outbound Referrals', icon: <FileText className="w-4 h-4" />, path: '/dashboard/pharmacy-referrals' },
    { label: 'Safe Inventory', icon: <Activity className="w-4 h-4" />, path: '/dashboard/inventory' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  ambulance: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Trauma Alerts', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/requests' },
    { label: 'Fleet Telemetry', icon: <Activity className="w-4 h-4" />, path: '/dashboard/vehicles' },
    { label: 'Secure Terminal', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  admin: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Identity Nodes', icon: <Users className="w-4 h-4" />, path: '/dashboard/users' },
    { label: 'Credential Audit', icon: <ShieldCheck className="w-4 h-4" />, path: '/dashboard/verifications' },
    { label: 'Ecosystem Analytics', icon: <Activity className="w-4 h-4" />, path: '/dashboard/analytics' },
    { label: 'Node Alerts', icon: <Bell className="w-4 h-4" />, path: '/dashboard/notifications' },
    { label: 'Global Billing', icon: <FileText className="w-4 h-4" />, path: '/dashboard/admin-billing' },
  ],
  super_admin: [
    { label: 'Dashboard Console', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Identity Nodes', icon: <Users className="w-4 h-4" />, path: '/dashboard/users' },
    { label: 'Credential Audit', icon: <ShieldCheck className="w-4 h-4" />, path: '/dashboard/verifications' },
    { label: 'Ecosystem Analytics', icon: <Activity className="w-4 h-4" />, path: '/dashboard/analytics' },
    { label: 'Node Alerts', icon: <Bell className="w-4 h-4" />, path: '/dashboard/notifications' },
    { label: 'Global Billing', icon: <FileText className="w-4 h-4" />, path: '/dashboard/admin-billing' },
    { label: 'Immutable Logs', icon: <AlertCircle className="w-4 h-4" />, path: '/dashboard/audit' },
    { label: 'System Controls', icon: <Settings className="w-4 h-4" />, path: '/dashboard/system-management' },
  ],
};

const roleLabels: Record<string, string> = {
  patient: 'Patient', doctor: 'Clinician', hospital: 'Hospital team', laboratory: 'Lab team',
  imaging: 'Imaging team', pharmacy: 'Pharmacy team', ambulance: 'Emergency unit', physiotherapist: 'Therapist', admin: 'Admin', super_admin: 'System admin',
};

const friendlyNavLabels: Record<string, string> = {
  'Dashboard Console': 'Home',
  'Visits Calendar': 'Appointments',
  'Node Alerts': 'Reminders',
  'Biometrics Feed': 'Health updates',
  'Prescriptions Node': 'Prescriptions',
  'Lab Telemetry': 'Lab results',
  'Scan Modality': 'Scans',
  'Ambulance Dispatch': 'Emergency help',
  'Ecosystem Trace': 'Care timeline',
  'Secure Terminal': 'Messages',
  'Patient Register': 'Patient list',
  'Therapy Regimes': 'Care plans',
  'Specialist Referrals': 'Referrals',
  'Pricing Matrix': 'Billing',
  'Assay Backlog': 'Lab queue',
  'Assay Results': 'Results',
  'Upload Module': 'Upload results',
  'DICOM Requests': 'Scan requests',
  'Inbound Referrals': 'Incoming referrals',
  'Scan Results': 'Scan results',
  'Dispense Queue': 'Medication queue',
  'Safe Inventory': 'Inventory',
  'Trauma Alerts': 'Urgent alerts',
  'Fleet Telemetry': 'Vehicle updates',
  'Identity Nodes': 'People',
  'Credential Audit': 'Verification',
  'Ecosystem Analytics': 'Insights',
  'Global Billing': 'Billing',
  'Immutable Logs': 'Activity log',
};

const roleIcons: Record<string, React.ReactNode> = {
  patient: <Users className="w-4 h-4" />, doctor: <Heart className="w-4 h-4" />,
  hospital: <Building2 className="w-4 h-4" />, laboratory: <FlaskConical className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />, pharmacy: <Pill className="w-4 h-4" />,
  ambulance: <Ambulance className="w-4 h-4" />, physiotherapist: <Activity className="w-4 h-4" />, admin: <ShieldCheck className="w-4 h-4" />, super_admin: <ShieldCheck className="w-4 h-4" />,
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = memo(({ children }: DashboardLayoutProps) => {
  const { user, logout, resendEmailVerification } = useAuth();
  const { unreadCount, feedLabel, isLive } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);

  if (!user) return null;

  const roleKey = normalizeUserRole(user.role) ?? user.role;
  const navItems = roleNavItems[roleKey] || [];
  const professionalVerificationStatus = getProfessionalVerificationStatus(user.isVerified, user.isActive ?? true);
  const isPendingVerification = professionalVerificationStatus === 'pending';
  const isEmailUnverified = user.role !== 'admin' && user.emailVerified === false;

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleResendVerification = async () => {
    setVerificationNotice('');
    setSendingVerification(true);
    try {
      await resendEmailVerification();
      setVerificationNotice('A fresh verification token has been generated & delivered.');
    } catch (error) {
      setVerificationNotice(error instanceof Error ? error.message : 'Failed to generate token');
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="alera-care-backdrop min-h-screen flex text-[#223127] font-sans">
      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#dfe8e0] bg-white text-[#223127] shadow-[0_12px_35px_rgba(20,30,24,0.08)] transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Header / Brand */}
            <div className="flex h-16 items-center justify-between border-b border-[#e7efe9] px-5">
              <Link to="/dashboard" className="flex items-center gap-2.5 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d7e4da] bg-[#f4faf4] text-xs font-bold text-[#4a785c]">
                  A
                </div>
                <span className="text-sm font-semibold text-[#223127] transition-colors group-hover:text-[#4a785c]">Alera</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Signpost */}
            <div className="border-b border-[#e7efe9] bg-[#f8fcf8] px-4 py-3">
              <div className="flex items-center gap-3 border border-slate-200 bg-white p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0b3d62] text-white">
                  {roleIcons[roleKey]}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-[#223127]">{user.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#6e7d71]">{roleLabels[roleKey]} account</div>
                </div>
              </div>
            </div>

            {/* Navigation Deck */}
            <nav className="px-3 py-3 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)]">
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-[#0b3d62] bg-slate-100 font-semibold text-[#0b3d62]'
                        : 'border-transparent text-[#4f6154] hover:bg-slate-50 hover:text-[#223127]'
                    }`}
                  >
                    {item.icon}
                    <span>{friendlyNavLabels[item.label] ?? item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sign-out Action */}
          <div className="border-t border-[#e7efe9] bg-white p-3">
            <button
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-3 border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-[#b34b4b] transition-colors hover:bg-red-100"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay backdrop */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Console Deck */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Control Header with FIXED PATIENT ANCHOR BAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e7efe9] bg-white/90 px-4 backdrop-blur-sm sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[#4f6154] hover:text-[#223127]">
            <Menu className="w-5 h-5" />
          </button>

          {/* FIXED PATIENT ANCHOR BAR */}
          <div className="flex items-center gap-3 border-l-2 border-[#0b3d62] bg-slate-50 px-3 py-1.5 text-xs">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#4a785c]" />
            <div>
              <span className="text-[#6e7d71]">Today: </span>
              <span className="font-semibold text-[#223127]">Eleanor Vance</span>
            </div>
            <span className="border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0b3d62]">
              Care update
            </span>
            <div className="hidden md:flex items-center gap-2 border-l border-[#e7efe9] pl-3 text-[11px] text-[#6e7d71]">
              <span>HR <strong className="text-[#223127]">118</strong></span>
              <span>SpO2 <strong className="text-[#223127]">91%</strong></span>
              <span>eGFR <strong className="text-[#223127]">28</strong></span>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            <ThemeSelector variant="dropdown" />
            <Link
              to="/dashboard/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e7efe9] bg-[#f8fcf8] text-[#4f6154] transition-colors hover:bg-[#f3f7f2] hover:text-[#223127]"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* Notifications Terminal */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#e7efe9] bg-[#f8fcf8] text-[#4f6154] transition-colors hover:bg-[#f3f7f2] hover:text-[#223127]"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#4a785c] text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
          </div>
        </header>

        {/* Notices */}
        <div className="mx-6 mt-4 space-y-3 font-mono">
          {isEmailUnverified && (
            <div className="rounded-[var(--radius-sm)] border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs text-[var(--text-high)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-bold text-[var(--state-warning)]">A quick step is still needed</p>
                    <p className="text-[11px] text-[var(--text-medium)]">Please verify your email to keep your account secure.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={sendingVerification}
                  className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[var(--surface-secondary)] px-3 py-1 text-xs text-[var(--state-warning)] transition-colors hover:border-[color:var(--state-warning)]"
                >
                  {sendingVerification ? 'Sending...' : 'Send again'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Workspace Core Area */}
        <main className="flex-1 p-4 sm:p-6 relative">
          {children}
        </main>
      </div>

      {/* Floating Chat Widget */}
      <ChatWidget />

      {/* Instrument-Grade Contextual Dock */}
      <ContextDock />
    </div>
  );
});

export default memo(DashboardLayout);
