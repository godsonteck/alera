import { useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  ChevronRight,
  Inbox,
  MessageSquare,
  Search,
  Users,
  UserCheck,
  FileText,
  Clock,
  Video
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useChat } from '@/contexts/useChat';
import { getAccessiblePatients } from '@/lib/patientDirectory';

const PatientsPage = () => {
  const { user, getUsers } = useAuth();
  const { appointments, prescriptions, labTests } = useAppData();
  const { startVideoCall } = useChat();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const patientsList = useMemo(
    () => getAccessiblePatients(getUsers(), appointments, prescriptions, labTests, user),
    [appointments, getUsers, labTests, prescriptions, user],
  );

  const filteredPatients = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return patientsList;
    return patientsList.filter((patient) => patient.name.toLowerCase().includes(normalizedQuery));
  }, [patientsList, search]);

  const canMessagePatient = user?.role === 'doctor' || user?.role === 'physiotherapist' || user?.role === 'provider';
  const canViewHistory =
    user?.role === 'doctor' || user?.role === 'provider' || user?.role === 'physiotherapist' || user?.role === 'hospital' || user?.role === 'admin' || user?.role === 'super_admin';

  if (!canViewHistory) {
    return (
      <div className="p-6 bg-[#090D14] border border-[#252A35] rounded-[4px] font-mono text-[#ECEEF2] text-center space-y-3">
        <Users className="mx-auto h-8 w-8 text-slate-500" />
        <h1 className="text-sm font-bold uppercase">Restricted Patient Directory Access</h1>
        <p className="text-xs text-slate-400">Your clinical role credentials do not possess access permissions for patient roster management.</p>
      </div>
    );
  }

  const totalAppointments = filteredPatients.reduce((sum, patient) => sum + patient.appointmentCount, 0);
  const totalPrescriptions = filteredPatients.reduce((sum, patient) => sum + patient.prescriptionCount, 0);
  const totalLabTests = filteredPatients.reduce((sum, patient) => sum + patient.labTestCount, 0);

  return (
    <div className="alera-feature space-y-4 text-slate-700">
      {/* Header Bar */}
      <div className="p-4 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-[16px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--text-high)]">Patients</span>
              <span className="text-[10px] bg-[var(--surface-elevated)] text-[var(--brand-primary)] border border-[var(--border)] px-2 py-0.5 rounded-full font-semibold">
                {filteredPatients.length} patients found
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-medium)] mt-0.5">
              Review patients connected to your clinical workflow, cross-correlate medical histories, and initiate direct communication.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[var(--surface-elevated)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs">
            <div>
              <span className="text-[var(--text-medium)]">APPOINTMENTS: </span>
              <span className="font-bold text-[var(--text-high)]">{totalAppointments}</span>
            </div>
            <div className="border-l border-[var(--border)] pl-3">
              <span className="text-[var(--text-medium)]">DIAGNOSTICS: </span>
              <span className="font-bold text-[var(--brand-primary)]">{totalLabTests + totalPrescriptions}</span>
            </div>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-medium)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active patient register by name or record ID..."
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[var(--brand-primary)] rounded-[12px] pl-9 pr-3 py-2 text-xs text-[var(--text-high)] placeholder:text-[var(--text-medium)] focus:outline-none"
          />
        </div>
      </div>

      {/* Patient Cards Grid */}
      {filteredPatients.length === 0 ? (
        <div className="p-8 text-center bg-[var(--surface-secondary)] border border-[var(--border)] rounded-[16px] text-xs text-[var(--text-medium)]">
          No patient records matched the search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPatients.map((pt) => (
            <div
              key={pt.id}
              className="p-4 bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--brand-primary)] rounded-[16px] space-y-3 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold text-xs border border-[var(--border)]">
                    {pt.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[var(--text-high)]">{pt.name}</div>
                    <div className="text-[11px] text-[var(--text-medium)]">ID: #{pt.id} • {pt.gender || 'Patient'}</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[var(--surface-elevated)] p-2 rounded-[12px] text-center text-[10px] border border-[var(--border)]">
                <div>
                  <span className="text-[var(--text-medium)] block">VISITS</span>
                  <span className="font-bold text-[var(--text-high)]">{pt.appointmentCount}</span>
                </div>
                <div>
                  <span className="text-[var(--text-medium)] block">LABS</span>
                  <span className="font-bold text-[var(--brand-primary)]">{pt.labTestCount}</span>
                </div>
                <div>
                  <span className="text-[var(--text-medium)] block">MEDS</span>
                  <span className="font-bold text-purple-400">{pt.prescriptionCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => startVideoCall(pt.id, pt.name, 'patient')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Call</span>
                </button>

                {canMessagePatient && (
                  <button
                    onClick={() => navigate(`/dashboard/messages?recipient=${pt.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-high)] rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
