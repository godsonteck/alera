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
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Appointments', icon: <Calendar className="w-4 h-4" />, path: '/dashboard/appointments' },
    { label: 'Reminders', icon: <Bell className="w-4 h-4" />, path: '/dashboard/appointment-reminders' },
    { label: 'Health Metrics', icon: <HeartPulse className="w-4 h-4" />, path: '/dashboard/health-metrics' },
    { label: 'Prescriptions', icon: <Pill className="w-4 h-4" />, path: '/dashboard/prescriptions' },
    { label: 'Lab Results', icon: <FlaskConical className="w-4 h-4" />, path: '/dashboard/lab-results' },
    { label: 'Imaging', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/imaging' },
    { label: 'Emergency Help', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/ambulance' },
    { label: 'Timeline', icon: <Clock className="w-4 h-4" />, path: '/dashboard/timeline' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  doctor: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Appointments', icon: <Calendar className="w-4 h-4" />, path: '/dashboard/appointments' },
    { label: 'Reminders', icon: <Bell className="w-4 h-4" />, path: '/dashboard/appointment-reminders' },
    { label: 'Patient List', icon: <Users className="w-4 h-4" />, path: '/dashboard/patients' },
    { label: 'Prescriptions', icon: <FileText className="w-4 h-4" />, path: '/dashboard/prescriptions' },
    { label: 'Lab Referrals', icon: <FlaskConical className="w-4 h-4" />, path: '/dashboard/lab-referrals' },
    { label: 'Imaging Referrals', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/imaging-referrals' },
    { label: 'Pharmacy Referrals', icon: <Pill className="w-4 h-4" />, path: '/dashboard/pharmacy-referrals' },
    { label: 'Referrals', icon: <FileText className="w-4 h-4" />, path: '/dashboard/referrals' },
    { label: 'Emergency Requests', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/requests' },
    { label: 'Timeline', icon: <Clock className="w-4 h-4" />, path: '/dashboard/timeline' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  physiotherapist: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Appointments', icon: <Calendar className="w-4 h-4" />, path: '/dashboard/appointments' },
    { label: 'Patient List', icon: <Users className="w-4 h-4" />, path: '/dashboard/patients' },
    { label: 'Care Plans', icon: <FileText className="w-4 h-4" />, path: '/dashboard/clinical-notes' },
    { label: 'Referrals', icon: <Activity className="w-4 h-4" />, path: '/dashboard/referrals' },
    { label: 'Timeline', icon: <Clock className="w-4 h-4" />, path: '/dashboard/timeline' },
    { label: 'Billing', icon: <Pill className="w-4 h-4" />, path: '/dashboard/pricing-settings' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  hospital: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Patient List', icon: <Users className="w-4 h-4" />, path: '/dashboard/patients' },
    { label: 'Emergency Requests', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/requests' },
    { label: 'Referrals', icon: <FileText className="w-4 h-4" />, path: '/dashboard/referrals' },
    { label: 'Care Team', icon: <Heart className="w-4 h-4" />, path: '/dashboard/doctors' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  laboratory: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Lab Queue', icon: <FlaskConical className="w-4 h-4" />, path: '/dashboard/test-requests' },
    { label: 'Results', icon: <FileText className="w-4 h-4" />, path: '/dashboard/results' },
    { label: 'Upload Results', icon: <FileText className="w-4 h-4" />, path: '/dashboard/lab-results-management' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  imaging: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Scan Requests', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/scan-requests' },
    { label: 'Incoming Referrals', icon: <ScanLine className="w-4 h-4" />, path: '/dashboard/imaging-referrals' },
    { label: 'Scan Results', icon: <FileText className="w-4 h-4" />, path: '/dashboard/results' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  pharmacy: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Medication Queue', icon: <Pill className="w-4 h-4" />, path: '/dashboard/prescriptions' },
    { label: 'Referrals', icon: <FileText className="w-4 h-4" />, path: '/dashboard/pharmacy-referrals' },
    { label: 'Inventory', icon: <Activity className="w-4 h-4" />, path: '/dashboard/inventory' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  ambulance: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'Urgent Alerts', icon: <Ambulance className="w-4 h-4" />, path: '/dashboard/requests' },
    { label: 'Vehicle Updates', icon: <Activity className="w-4 h-4" />, path: '/dashboard/vehicles' },
    { label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, path: '/dashboard/messages' },
  ],
  admin: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'People', icon: <Users className="w-4 h-4" />, path: '/dashboard/users' },
    { label: 'Verification', icon: <ShieldCheck className="w-4 h-4" />, path: '/dashboard/verifications' },
    { label: 'Insights', icon: <Activity className="w-4 h-4" />, path: '/dashboard/analytics' },
    { label: 'Notifications', icon: <Bell className="w-4 h-4" />, path: '/dashboard/notifications' },
    { label: 'Billing', icon: <FileText className="w-4 h-4" />, path: '/dashboard/admin-billing' },
  ],
  super_admin: [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/dashboard' },
    { label: 'People', icon: <Users className="w-4 h-4" />, path: '/dashboard/users' },
    { label: 'Verification', icon: <ShieldCheck className="w-4 h-4" />, path: '/dashboard/verifications' },
    { label: 'Insights', icon: <Activity className="w-4 h-4" />, path: '/dashboard/analytics' },
    { label: 'Notifications', icon: <Bell className="w-4 h-4" />, path: '/dashboard/notifications' },
    { label: 'Billing', icon: <FileText className="w-4 h-4" />, path: '/dashboard/admin-billing' },
    { label: 'Activity Log', icon: <AlertCircle className="w-4 h-4" />, path: '/dashboard/audit' },
    { label: 'System settings', icon: <Settings className="w-4 h-4" />, path: '/dashboard/system-management' },
  ],
};

const roleLabels: Record<string, string> = {
  patient: 'Patient', doctor: 'Clinician', hospital: 'Hospital team', laboratory: 'Lab team',
  imaging: 'Imaging team', pharmacy: 'Pharmacy team', ambulance: 'Emergency unit', physiotherapist: 'Therapist', admin: 'Admin', super_admin: 'System admin',
};

const friendlyNavLabels: Record<string, string> = {
  'Dashboard': 'Home',
  'Appointments': 'Appointments',
  'Reminders': 'Reminders',
  'Health Metrics': 'Health metrics',
  'Prescriptions': 'Prescriptions',
  'Lab Results': 'Lab results',
  'Imaging': 'Imaging',
  'Emergency Help': 'Emergency help',
  'Timeline': 'Timeline',
  'Messages': 'Messages',
  'Patient List': 'Patient list',
  'Care Plans': 'Care plans',
  'Referrals': 'Referrals',
  'Billing': 'Billing',
  'Lab Queue': 'Lab queue',
  'Results': 'Results',
  'Upload Results': 'Upload results',
  'Scan Requests': 'Scan requests',
  'Incoming Referrals': 'Incoming referrals',
  'Scan Results': 'Scan results',
  'Medication Queue': 'Medication queue',
  'Inventory': 'Inventory',
  'Urgent Alerts': 'Urgent alerts',
  'Vehicle Updates': 'Vehicle updates',
  'People': 'People',
  'Verification': 'Verification',
  'Insights': 'Insights',
  'Notifications': 'Notifications',
  'Activity Log': 'Activity log',
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

      {/* Main dashboard area */}
      <div className="alera-dashboard flex-1 lg:ml-64 flex flex-col min-h-screen bg-[var(--surface-base)] text-[var(--text-high)] transition-colors">
        {/* Top navigation header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-700/30 bg-[var(--surface-elevated)]/90 px-4 backdrop-blur-md transition-colors sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[var(--text-medium)] hover:text-[var(--text-high)]">
            <Menu className="w-5 h-5" />
          </button>

          {/* Care workspace status */}
          <div className="flex items-center gap-3 border-l-2 border-sky-500 bg-[var(--surface-secondary)] px-3 py-1.5 text-xs rounded-r-md">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#4a785c]" />
            <div>
              <span className="font-semibold text-[#223127]">Care workspace</span>
            </div>
            <span className="border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0b3d62]">
              Ready
            </span>
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
