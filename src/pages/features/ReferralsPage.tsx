import { useState, useMemo } from 'react';
import { FileText, CheckCircle, Clock, Inbox, Plus, Search, Send, X, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import type { UserRole } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { toast } from '@/components/ui/use-toast';
import type { ReferralType } from '@/data/mockData';
import { getDoctorPatients } from '@/lib/patientDirectory';
import {
  REFERRAL_DESTINATION_ERROR,
  canAcceptReferral,
  canCancelReferral,
  canCompleteReferral,
  getReferralDestinationProviders,
  getReferralDepartmentId,
  getVisibleReferrals,
  isReferralDestinationValid,
  referralKindLabel,
  type ReferralKind,
} from '@/lib/referralUtils';
import { normalizeUserRole } from '@/lib/roleUtils';

export interface ReferralsPageProps {
  referralKind?: ReferralKind;
}

const ReferralsPage = ({ referralKind = 'hospital' }: ReferralsPageProps) => {
  const { user, getUsers } = useAuth();
  const { referrals, appointments, addReferral, updateReferral, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ patientId: '', destinationProviderId: '', toDepartment: '', reason: '', notes: '' });

  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;
  const users = getUsers();

  const userReferrals = useMemo(() => {
    const kindFilter = effectiveRole === 'doctor' ? referralKind : undefined;
    return getVisibleReferrals(referrals, user, kindFilter ? { kind: kindFilter } : undefined);
  }, [referrals, user, effectiveRole, referralKind]);

  const patientOptions = useMemo(
    () => getDoctorPatients(users, appointments, effectiveRole === 'doctor' ? user?.id : undefined),
    [appointments, users, user, effectiveRole],
  );

  const destinationOptions = useMemo(
    () => getReferralDestinationProviders(users, referralKind),
    [users, referralKind],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return userReferrals.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSearch = !normalizedQuery
        || r.patientName.toLowerCase().includes(normalizedQuery)
        || r.fromDoctorName.toLowerCase().includes(normalizedQuery)
        || r.toDepartment.toLowerCase().includes(normalizedQuery)
        || r.reason.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter, userReferrals]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.patientId || !formData.destinationProviderId || !formData.reason.trim() || !user?.id) {
      setFormError('Patient, destination provider, and reason for referral are required.');
      return;
    }

    const patient = patientOptions.find((p) => p.id === formData.patientId);
    const dest = destinationOptions.find((d) => d.id === formData.destinationProviderId);

    if (!patient || !dest) {
      setFormError('Invalid patient or destination selection.');
      return;
    }

    addReferral({
      patientId: patient.id,
      patientName: patient.name,
      fromDoctorId: user.id,
      fromDoctorName: user.name,
      toDepartment: formData.toDepartment.trim() || dest.name,
      destinationProviderId: dest.id,
      destinationProviderName: dest.name,
      referralType: referralKind,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      reason: formData.reason.trim(),
      notes: formData.notes.trim() || undefined,
    });

    addNotification({
      title: `${referralKindLabel(referralKind)} Referral Issued`,
      message: `Outbound referral for ${patient.name} dispatched to ${dest.name}.`,
      type: 'referral',
      priority: 'high',
      audience: 'personal',
    });

    setShowForm(false);
    setFormData({ patientId: '', destinationProviderId: '', toDepartment: '', reason: '', notes: '' });
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">
              {referralKindLabel(referralKind)} Referrals Gateway
            </span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
              {filtered.length} REFERRALS QUEUED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Coordinate specialist handoffs, inter-departmental transfers, and facility routing.
          </p>
        </div>

        {effectiveRole === 'doctor' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'CANCEL REFERRAL' : 'DISPATCH REFERRAL'}</span>
          </button>
        )}
      </div>

      {/* Form Surface */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
            Dispatch Outbound Specialist Referral
          </span>

          {formError && (
            <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Patient</label>
              <select
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                required
              >
                <option value="">Select Patient</option>
                {patientOptions.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Destination Facility</label>
              <select
                value={formData.destinationProviderId}
                onChange={(e) => setFormData({ ...formData, destinationProviderId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                required
              >
                <option value="">Select Destination Provider</option>
                {destinationOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Clinical Reason for Referral</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g. High-acuity cardiology consultation for chest tightness"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>DISPATCH OUTBOUND REFERRAL</span>
          </button>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['all', 'pending', 'accepted', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
                statusFilter === st
                  ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
              }`}
            >
              {st === 'all' ? 'ALL REFERRALS' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search referral or doctor..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] pl-9 pr-3 py-1.5 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Referral Records List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No matching referral records found in current queue.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ref) => (
            <div
              key={ref.id}
              className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2] flex items-center gap-2">
                    <span>Patient: {ref.patientName}</span>
                    <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                      To: {ref.toDepartment || ref.destinationProviderName || 'Specialist'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Reason: <strong>{ref.reason}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Requisitioned by {ref.fromDoctorName} on {ref.date}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase border ${
                  ref.status === 'accepted' || ref.status === 'completed'
                    ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                    : ref.status === 'pending'
                    ? 'bg-amber-950/50 border-amber-600/60 text-amber-400'
                    : 'bg-red-950/50 border-red-600/60 text-red-400'
                }`}>
                  {ref.status}
                </span>

                {canAcceptReferral(ref, user) && (
                  <button
                    onClick={() => updateReferral(ref.id, (r) => ({ ...r, status: 'accepted' }))}
                    className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-[10px] font-bold rounded-[2px] hover:bg-emerald-900"
                  >
                    ACCEPT
                  </button>
                )}

                {canCompleteReferral(ref, user) && (
                  <button
                    onClick={() => updateReferral(ref.id, (r) => ({ ...r, status: 'completed' }))}
                    className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-600/60 text-cyan-300 text-[10px] font-bold rounded-[2px] hover:bg-cyan-900"
                  >
                    COMPLETE
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

export default ReferralsPage;
