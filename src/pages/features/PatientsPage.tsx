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
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { getAccessiblePatients } from '@/lib/patientDirectory';

const PatientsPage = () => {
  const { user, getUsers } = useAuth();
  const { appointments, prescriptions, labTests } = useAppData();
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

  const canMessagePatient = user?.role === 'doctor' || user?.role === 'physiotherapist';
  const canViewHistory =
    user?.role === 'doctor' || user?.role === 'physiotherapist' || user?.role === 'hospital' || user?.role === 'admin' || user?.role === 'super_admin';

  if (user?.role !== 'doctor' && user?.role !== 'physiotherapist' && user?.role !== 'admin' && user?.role !== 'hospital' && user?.role !== 'super_admin') {
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
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Clinical Patient Register</span>
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
                {filteredPatients.length} patients found
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Review patients connected to your clinical workflow, cross-correlate medical histories, and initiate direct communication.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#0F1218] border border-[#252A35] px-3 py-1.5 rounded-[2px] text-xs">
            <div>
              <span className="text-slate-500">APPOINTMENTS: </span>
              <span className="font-bold text-[#ECEEF2]">{totalAppointments}</span>
            </div>
            <div className="border-l border-[#2F3542] pl-3">
              <span className="text-slate-500">DIAGNOSTICS: </span>
              <span className="font-bold text-cyan-400">{totalLabTests + totalPrescriptions}</span>
            </div>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active patient register by name or record ID..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] pl-9 pr-3 py-2 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Patient Cards Grid */}
      {filteredPatients.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500">
          No patient records matched the search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPatients.map((pt) => (
            <div
              key={pt.id}
              className="p-3 bg-[#090D14] border border-[#252A35] hover:border-cyan-500/50 rounded-[2px] space-y-3 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-xs text-[#ECEEF2] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{pt.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{pt.email}</div>
                </div>
                <span className="text-[9px] bg-[#151922] border border-[#2F3542] px-1.5 py-0.5 rounded text-slate-300">
                  ID: #{pt.id.slice(0, 6)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[#0F1218] p-2 rounded-[2px] text-center text-[10px] border border-[#252A35]">
                <div>
                  <span className="text-slate-500 block">VISITS</span>
                  <span className="font-bold text-[#ECEEF2]">{pt.appointmentCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">LABS</span>
                  <span className="font-bold text-cyan-400">{pt.labTestCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">MEDS</span>
                  <span className="font-bold text-purple-400">{pt.prescriptionCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {canViewHistory && (
                  <button
                    onClick={() => navigate(`/dashboard/timeline?patient=${pt.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-xs text-slate-200 rounded-[2px] transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>TIMELINE</span>
                  </button>
                )}

                {canMessagePatient && (
                  <button
                    onClick={() => navigate(`/dashboard/messages?recipient=${pt.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-600/60 text-xs text-cyan-300 rounded-[2px] transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>MESSAGE</span>
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
