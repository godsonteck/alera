import { useMemo, useState, useEffect, useCallback } from 'react';
import { Users, Calendar, Activity, TrendingUp, Heart, FlaskConical, ScanLine } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { api } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';
import { normalizeUserRole } from '@/lib/roleUtils';

interface PlatformStats {
  users: { total: number; by_role: Record<string, number> };
  appointments: { total: number; today: number };
  prescriptions: { active: number };
  lab_tests: { pending: number };
  imaging: { pending: number };
}

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { appointments, prescriptions, labTests, imagingScans } = useAppData();
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;

  const scopedAppointments = useMemo(() => {
    if (effectiveRole === 'doctor') return appointments.filter((appointment) => appointment.doctorId === user?.id);
    if (effectiveRole === 'patient') return appointments.filter((appointment) => appointment.patientId === user?.id);
    return appointments;
  }, [appointments, user?.id, effectiveRole]);
  const scopedPrescriptions = useMemo(() => {
    if (effectiveRole === 'doctor') return prescriptions.filter((prescription) => prescription.doctorId === user?.id);
    if (effectiveRole === 'patient') return prescriptions.filter((prescription) => prescription.patientId === user?.id);
    return prescriptions;
  }, [prescriptions, user?.id, effectiveRole]);
  const scopedLabTests = useMemo(() => {
    if (effectiveRole === 'doctor') return labTests.filter((test) => test.doctorId === user?.id);
    if (effectiveRole === 'patient') return labTests.filter((test) => test.patientId === user?.id);
    return labTests;
  }, [labTests, user?.id, effectiveRole]);
  const scopedImagingScans = useMemo(() => {
    if (effectiveRole === 'doctor') return imagingScans.filter((scan) => scan.doctorId === user?.id);
    if (effectiveRole === 'patient') return imagingScans.filter((scan) => scan.patientId === user?.id);
    return imagingScans;
  }, [imagingScans, user?.id, effectiveRole]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

    return {
      totalAppointments: scopedAppointments.length,
      appointmentsTodayCount: scopedAppointments.filter(a => a.date === today).length,
      appointmentsThisWeek: scopedAppointments.filter(a => new Date(a.date) >= thisWeekStart).length,
      appointmentsScheduled: scopedAppointments.filter(a => a.status === 'scheduled').length,
      appointmentsCompleted: scopedAppointments.filter(a => a.status === 'completed').length,
      totalPrescriptions: scopedPrescriptions.length,
      prescriptionsActive: scopedPrescriptions.filter(p => p.status === 'active').length,
      prescriptionsDispensed: scopedPrescriptions.filter(p => p.status === 'dispensed').length,
      totalLabTests: scopedLabTests.length,
      labTestsCompleted: scopedLabTests.filter(t => t.status === 'completed').length,
      labTestsPending: scopedLabTests.filter(t => t.status === 'requested' || t.status === 'in-progress').length,
      totalImagingScans: scopedImagingScans.length,
      imagingScansCompleted: scopedImagingScans.filter(s => s.status === 'completed').length,
      imagingScansPending: scopedImagingScans.filter(s => s.status === 'requested' || s.status === 'in-progress').length,
    };
  }, [scopedAppointments, scopedPrescriptions, scopedLabTests, scopedImagingScans]);

  const isAdmin = effectiveRole === 'admin' || user?.role === 'super_admin';
  const isDoctor = effectiveRole === 'doctor';

  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [platformError, setPlatformError] = useState('');
  const [platformLoading, setPlatformLoading] = useState(false);

  const loadPlatform = useCallback(async () => {
    if (!isAdmin) return;
    setPlatformLoading(true);
    setPlatformError('');
    try {
      const data = await api.admin.getDashboardStats();
      setPlatformStats({
        users: data.users,
        appointments: data.appointments,
        prescriptions: data.prescriptions,
        lab_tests: data.lab_tests,
        imaging: data.imaging,
      });
    } catch (e) {
      setPlatformError(handleApiError(e));
      setPlatformStats(null);
    } finally {
      setPlatformLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadPlatform();
  }, [loadPlatform]);

  if (!isAdmin && !isDoctor) {
    return (
      <div className="space-y-4 font-mono text-[#ECEEF2]">
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Health Telemetry Matrix</span>
          <p className="text-[11px] text-slate-400 mt-0.5">High-level quantitative overview of local session medical records.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { icon: <Heart className="w-3.5 h-3.5" />, label: 'APPOINTMENTS', value: stats.totalAppointments, color: 'text-cyan-400' },
            { icon: <FlaskConical className="w-3.5 h-3.5" />, label: 'LAB ASSAYS', value: stats.totalLabTests, color: 'text-emerald-400' },
            { icon: <ScanLine className="w-3.5 h-3.5" />, label: 'DICOM SCANS', value: stats.totalImagingScans, color: 'text-amber-400' },
            { icon: <Activity className="w-3.5 h-3.5" />, label: 'PRESCRIPTIONS', value: stats.totalPrescriptions, color: 'text-purple-400' },
          ].map((s, i) => (
            <div key={i} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col items-center justify-center">
              <div className={`p-1.5 bg-[#151922] border border-[#2F3542] rounded-[2px] mb-2 ${s.color}`}>
                {s.icon}
              </div>
              <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Active Metric Snapshot</span>
          <div className="space-y-1">
            <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-xs">
              <span className="text-slate-400">Appointments (T=0)</span>
              <span className="font-bold font-mono text-cyan-400">{stats.appointmentsTodayCount}</span>
            </div>
            <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-xs">
              <span className="text-slate-400">Active Prescriptions</span>
              <span className="font-bold font-mono text-purple-400">{stats.prescriptionsActive}</span>
            </div>
            <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-xs">
              <span className="text-slate-400">Pending Lab Assays</span>
              <span className="font-bold font-mono text-emerald-400">{stats.labTestsPending}</span>
            </div>
            <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-xs">
              <span className="text-slate-400">Pending DICOM Resolves</span>
              <span className="font-bold font-mono text-amber-400">{stats.imagingScansPending}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const byRole = platformStats?.users.by_role ?? {};
  const adminKpis = isAdmin
    ? [
        {
          icon: <Users className="w-4 h-4" />,
          label: 'REGISTERED NODES',
          value: platformLoading ? 'SYNCING' : (platformStats?.users.total ?? 'N/A'),
          sub: platformError ? 'OFFLINE' : `CLI: ${byRole.provider ?? 0} | PAT: ${byRole.patient ?? 0}`,
          color: 'text-cyan-400',
        },
        {
          icon: <Calendar className="w-4 h-4" />,
          label: 'APPOINTMENTS (DB)',
          value: platformLoading ? 'SYNCING' : (platformStats?.appointments.total ?? 'N/A'),
          sub: platformStats ? `T=0: ${platformStats.appointments.today}` : '',
          color: 'text-purple-400',
        },
        {
          icon: <Activity className="w-4 h-4" />,
          label: 'PENDING RESOLVES',
          value: platformLoading
            ? 'SYNCING'
            : platformStats
              ? platformStats.lab_tests.pending + platformStats.imaging.pending
              : 'N/A',
          sub: platformStats ? `LAB: ${platformStats.lab_tests.pending} | IMG: ${platformStats.imaging.pending}` : '',
          color: 'text-emerald-400',
        },
        {
          icon: <TrendingUp className="w-4 h-4" />,
          label: 'ACTIVE PRESCRIPTIONS',
          value: platformLoading ? 'SYNCING' : (platformStats?.prescriptions.active ?? 'N/A'),
          sub: 'GLOBAL DATABASE',
          color: 'text-amber-400',
        },
      ]
    : [
        {
          icon: <Calendar className="w-4 h-4" />,
          label: 'APPOINTMENTS',
          value: stats.totalAppointments,
          sub: `W=0: ${stats.appointmentsThisWeek}`,
          color: 'text-cyan-400',
        },
        {
          icon: <Activity className="w-4 h-4" />,
          label: 'LAB ASSAYS',
          value: stats.totalLabTests,
          sub: `RSLV: ${stats.labTestsCompleted}`,
          color: 'text-emerald-400',
        },
        {
          icon: <ScanLine className="w-4 h-4" />,
          label: 'DICOM SCANS',
          value: stats.totalImagingScans,
          sub: `PEND: ${stats.imagingScansPending}`,
          color: 'text-amber-400',
        },
        {
          icon: <Heart className="w-4 h-4" />,
          label: 'PRESCRIPTIONS',
          value: stats.totalPrescriptions,
          sub: `ACTV: ${stats.prescriptionsActive}`,
          color: 'text-purple-400',
        },
      ];

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">System Telemetry Matrix</span>
          <p className="text-[11px] text-slate-400 mt-0.5">{isAdmin ? 'Global platform metrics sourced from master node.' : 'Local clinical practice data snapshot.'}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => void loadPlatform()}
            disabled={platformLoading}
            className="px-3 py-1.5 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold rounded-[2px] transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30"
          >
            {platformLoading ? 'SYNCING...' : 'FORCE SYNC'}
          </button>
        )}
      </div>

      {isAdmin && platformError && (
        <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300">
          [ERROR] {platformError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {adminKpis.map((s, i) => (
          <div key={i} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col items-center justify-center text-center">
            <div className={`p-1.5 bg-[#151922] border border-[#2F3542] rounded-[2px] mb-2 ${s.color}`}>
              {s.icon}
            </div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</div>
            {s.sub && <div className="text-[8px] text-slate-600 mt-1 font-mono uppercase">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Activity Breakdown */}
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Activity Breakdown</span>
          
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase text-cyan-400 block">APPOINTMENT VECTORS</span>
            <div className="space-y-1">
              {[
                { label: 'SCHEDULED', value: stats.appointmentsScheduled, max: stats.totalAppointments },
                { label: 'RESOLVED', value: stats.appointmentsCompleted, max: stats.totalAppointments },
                { label: 'W=0', value: stats.appointmentsThisWeek, max: stats.totalAppointments },
              ].map((item, i) => (
                <div key={i} className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>{item.label}</span>
                    <span className="font-bold font-mono text-cyan-300">{item.value} / {Math.max(item.max, 1)}</span>
                  </div>
                  <div className="w-full h-1 bg-[#151922] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500/60"
                      style={{ width: `${(item.value / Math.max(item.max, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <span className="text-[10px] font-bold uppercase text-emerald-400 block pt-2 border-t border-[#252A35]">TEST VECTORS</span>
            <div className="space-y-1">
              {[
                { label: 'LABS RESOLVED', value: stats.labTestsCompleted, max: stats.totalLabTests, color: 'bg-emerald-500/60' },
                { label: 'DICOM RESOLVED', value: stats.imagingScansCompleted, max: stats.totalImagingScans, color: 'bg-amber-500/60' },
                { label: 'RX DISPENSED', value: stats.prescriptionsDispensed, max: stats.totalPrescriptions, color: 'bg-purple-500/60' },
              ].map((item, i) => (
                <div key={i} className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>{item.label}</span>
                    <span className="font-bold font-mono text-[#ECEEF2]">{item.value} / {Math.max(item.max, 1)}</span>
                  </div>
                  <div className="w-full h-1 bg-[#151922] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${(item.value / Math.max(item.max, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
            <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">NODE STATUS</span>
            <div className="space-y-1 text-xs">
              {[
                { name: 'API GATEWAY', status: platformError ? 'DEGRADED' : 'OPERATIONAL', ok: !platformError },
                { name: 'DB SYNC', status: isAdmin && platformStats ? 'SYNCHRONIZED' : isAdmin ? 'PENDING' : 'N/A', ok: isAdmin && !!platformStats },
              ].map((svc, i) => (
                <div key={i} className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                  <span className="text-slate-400">{svc.name}</span>
                  <span className={`font-bold font-mono ${svc.ok ? 'text-emerald-400' : 'text-amber-400'}`}>[{svc.status}]</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
            <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
              {isAdmin ? 'ROLE DISTRIBUTION (GLOBAL)' : 'LOCAL NODE SUMMARY'}
            </span>
            <div className="space-y-1 text-xs">
              {isAdmin && platformStats ? (
                <>
                  {Object.entries(platformStats.users.by_role).sort(([a], [b]) => a.localeCompare(b)).map(([role, count]) => (
                    <div key={role} className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                      <span className="text-slate-400 uppercase">{role}</span>
                      <span className="font-bold font-mono text-cyan-400">{count}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]"><span className="text-slate-400 uppercase">APPOINTMENTS</span><span className="font-bold font-mono text-cyan-400">{stats.totalAppointments}</span></div>
                  <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]"><span className="text-slate-400 uppercase">ACTIVE RX</span><span className="font-bold font-mono text-purple-400">{stats.prescriptionsActive}</span></div>
                  <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]"><span className="text-slate-400 uppercase">PENDING LABS</span><span className="font-bold font-mono text-emerald-400">{stats.labTestsPending}</span></div>
                  <div className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]"><span className="text-slate-400 uppercase">PENDING DICOM</span><span className="font-bold font-mono text-amber-400">{stats.imagingScansPending}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
