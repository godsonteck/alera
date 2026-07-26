import { useCallback, useState, useMemo, useEffect } from 'react';
import { ShieldCheck, CheckCircle, XCircle, Heart, FlaskConical, ScanLine, Pill, Ambulance, Building2, Inbox, FileCheck, RefreshCcw, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';
import { useToast } from '@/hooks/use-toast';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getVerificationQueueStatus, getVerificationStatusLabel, type VerificationQueueStatus } from '@/lib/verificationStatus';

const roleIcons: Record<string, React.ReactNode> = {
  doctor: <Heart className="w-4 h-4" />, hospital: <Building2 className="w-4 h-4" />, laboratory: <FlaskConical className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />, pharmacy: <Pill className="w-4 h-4" />, ambulance: <Ambulance className="w-4 h-4" />,
};

const roleLabels: Record<string, string> = {
  doctor: 'PROVIDER', hospital: 'HOSPITAL', laboratory: 'LABORATORY', imaging: 'IMAGING', pharmacy: 'PHARMACY', ambulance: 'AMBULANCE',
};

type VerificationItem = {
  id: number; name: string; email: string; role: string; status: VerificationQueueStatus; appliedDate: string; documents: string; notes?: string; verifiedBy?: string; verificationDate?: string;
};

const VerificationsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const statusTabs = ['all', 'pending', 'verified', 'rejected'] as const;

  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.listVerifications();
      const mapped = data.map(u => ({
        id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email, role: normalizeUserRole(u.role) ?? 'doctor',
        status: getVerificationQueueStatus(u.is_verified, u.is_active) as VerificationQueueStatus,
        appliedDate: new Date(u.created_at).toISOString().split('T')[0],
        documents: `LIC: ${u.license_number || 'N/A'} [${u.license_state || 'ANY'}]`,
        notes: u.bio,
      }));
      setVerifications(mapped);
    } catch (error) { toast({ title: 'Sync fault', description: handleApiError(error), variant: 'destructive' }); }
    finally { setIsLoading(false); }
  }, [toast]);

  useEffect(() => { fetchVerifications(); }, [fetchVerifications]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return verifications;
    return verifications.filter(v => v.status === statusFilter);
  }, [verifications, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: verifications.length, pending: verifications.filter(v => v.status === 'pending').length,
      verified: verifications.filter(v => v.status === 'verified').length, rejected: verifications.filter(v => v.status === 'rejected').length,
    };
  }, [verifications]);

  const handleVerify = async (id: number) => {
    try { await api.admin.verifyProvider(id); toast({ title: 'Clearance granted', description: 'Provider identity verified.' }); fetchVerifications(); }
    catch (error) { toast({ title: 'Verification fault', description: handleApiError(error), variant: 'destructive' }); }
  };

  const handleReject = async (id: number) => {
    try { await api.admin.rejectProvider(id); toast({ title: 'Clearance denied', description: 'Provider identity flagged.' }); fetchVerifications(); }
    catch (error) { toast({ title: 'Rejection fault', description: handleApiError(error), variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Provider Verification Queue</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Review and authorize professional credentials.</p>
        </div>
        <button onClick={fetchVerifications} disabled={isLoading} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider disabled:opacity-50">
          {isLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} SYNC
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold">TOTAL REQUESTS</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{stats.total}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-amber-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-amber-500 uppercase font-bold flex items-center justify-center gap-1"><FileCheck className="w-3 h-3" /> PENDING</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{stats.pending}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> VERIFIED</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.verified}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-red-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-red-500 uppercase font-bold flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> REJECTED</div>
          <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{stats.rejected}</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusTabs.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-[2px] text-[10px] font-bold tracking-wider uppercase transition-colors border ${
              statusFilter === status ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {status === 'all' ? 'ALL QUEUES' : getVerificationStatusLabel(status)}
          </button>
        ))}
      </div>

      <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">SYNCING QUEUE...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">NO VERIFICATION REQUESTS LOCATED.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#252A35] bg-[#0F1218]">
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">ENTITY</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">CLEARANCE</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">STATUS</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">CREDENTIALS</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">OPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252A35]">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-[#0F1218] transition-colors">
                    <td className="px-3 py-2">
                      <div className="font-bold text-[#ECEEF2]">{v.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{v.email}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">INIT: {v.appliedDate}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-300 text-[9px] font-bold uppercase rounded-[2px]">
                        {roleIcons[v.role]} {roleLabels[v.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                        v.status === 'verified' ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400' :
                        v.status === 'rejected' ? 'bg-red-950/40 border-red-600/60 text-red-400' :
                        'bg-amber-950/40 border-amber-600/60 text-amber-400'
                      }`}>
                        {getVerificationStatusLabel(v.status)}
                      </span>
                      {v.verificationDate && <div className="text-[9px] text-slate-500 font-mono mt-1">BY: {v.verifiedBy} ({v.verificationDate})</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[10px] font-mono text-cyan-400">{v.documents}</div>
                      {v.notes && <div className="text-[10px] text-slate-500 mt-1 italic max-w-[200px] truncate">{v.notes}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {v.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleVerify(v.id)} className="px-2 py-1 bg-emerald-950/40 border border-emerald-600/60 text-emerald-400 text-[9px] font-bold uppercase rounded-[2px] hover:bg-emerald-900/60 transition-colors flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> VERIFY
                          </button>
                          <button onClick={() => handleReject(v.id)} className="px-2 py-1 bg-red-950/40 border border-red-600/60 text-red-400 text-[9px] font-bold uppercase rounded-[2px] hover:bg-red-900/60 transition-colors flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> REJECT
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationsPage;
