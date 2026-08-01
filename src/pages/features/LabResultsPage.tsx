import { useMemo, useState } from 'react';
import { FlaskConical, Upload, Plus, Search, X, Inbox, Trash2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { toast } from '@/components/ui/use-toast';
import { type LabTest } from '@/data/mockData';
import { getDoctorPatients } from '@/lib/patientDirectory';
import { getVisibleLabTests } from '@/lib/recordVisibility';
import { getReferralDestinationProviders } from '@/lib/referralUtils';
import { normalizeUserRole } from '@/lib/roleUtils';
import { api } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

interface LabResultsPageProps {
  page?: string;
}

const LabResultsPage = ({ page }: LabResultsPageProps) => {
  const { user, getUsers } = useAuth();
  const { appointments, labTests, addLabTest, updateLabTest, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [uploadResult, setUploadResult] = useState('');
  const [orderForm, setOrderForm] = useState({ patientId: '', labId: '', testName: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LabTest['status']>('all');
  const focusId = searchParams.get('focus');
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;
  const currentPage = page ?? (user?.role === 'laboratory' ? 'test-requests' : effectiveRole === 'doctor' ? 'lab-referrals' : 'lab-results');
  const users = getUsers();
  const patientOptions = useMemo(() => getDoctorPatients(users, appointments, user?.id), [appointments, user?.id, users]);
  const labOptions = useMemo(() => getReferralDestinationProviders(users, 'laboratory'), [users]);
  const visibleLabTests = useMemo(
    () => getVisibleLabTests(labTests, user),
    [labTests, user],
  );
  const filteredLabTests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return visibleLabTests.filter((test) => {
      const matchesStatus = statusFilter === 'all' || test.status === statusFilter;
      const matchesQuery = !normalizedQuery
        || test.testName.toLowerCase().includes(normalizedQuery)
        || test.patientName.toLowerCase().includes(normalizedQuery)
        || test.doctorName.toLowerCase().includes(normalizedQuery)
        || (test.destinationProviderName || '').toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [searchQuery, statusFilter, visibleLabTests]);

  const handleUpload = (id: string) => {
    if (!uploadResult.trim()) {
      toast({ title: 'Result required', description: 'Enter the lab result details before submitting.', variant: 'destructive' });
      return;
    }
    const target = labTests.find((test) => test.id === id);
    updateLabTest(id, (test) => ({ ...test, status: 'completed' as const, results: uploadResult }));
    if (target) {
      const doctorEmail = users.find((account) => account.id === target.doctorId)?.email;
      const patientEmail = users.find((account) => account.id === target.patientId)?.email;
      addNotification({
        title: 'Lab Result Uploaded',
        message: `${target.testName} for ${target.patientName} was completed and published.`,
        type: 'result',
        priority: 'high',
        audience: 'personal',
        actionUrl: `/dashboard/${currentPage}?focus=${target.id}`,
        actionLabel: 'Open result',
        targetEmails: [doctorEmail, patientEmail].filter((value): value is string => Boolean(value)),
        excludeEmails: user?.email ? [user.email] : [],
        actionUrlByRole: {
          laboratory: `/dashboard/test-requests?focus=${target.id}`,
          doctor: `/dashboard/lab-referrals?focus=${target.id}`,
          patient: `/dashboard/lab-results?focus=${target.id}`,
        },
      });
    }
    setShowUpload(null);
    setUploadResult('');
  };

  const handleOrder = async () => {
    if (!orderForm.patientId || !orderForm.labId || !orderForm.testName.trim() || !user?.id) {
      toast({ title: 'Missing fields', description: 'Select patient, laboratory, and test name.', variant: 'destructive' });
      return;
    }
    const patient = patientOptions.find((p) => p.id === orderForm.patientId);
    const lab = labOptions.find((l) => l.id === orderForm.labId);
    if (!patient || !lab) return;

    try {
      await api.labTests.createLabTest({
        patient_id: Number(orderForm.patientId),
        destination_provider_id: Number(lab.id),
        test_name: orderForm.testName.trim(),
        description: `Lab test ordered for ${patient.name}`,
      });

      addLabTest({
        id: `lab-${Date.now()}`,
        testName: orderForm.testName.trim(),
        patientId: patient.id,
        patientName: patient.name,
        doctorId: user.id,
        doctorName: user.name,
        labId: lab.id,
        destinationProviderName: lab.name,
        date: new Date().toISOString().split('T')[0],
        status: 'requested',
      });

      addNotification({
        title: 'Lab test ordered',
        message: `${orderForm.testName} ordered for ${patient.name}.`,
        type: 'result',
        priority: 'medium',
        audience: 'personal',
      });

      await refreshAppData();
      setShowOrder(false);
      setOrderForm({ patientId: '', labId: '', testName: '' });
    } catch (err) {
      toast({ title: 'Order Failed', description: handleApiError(err, 'order lab test'), variant: 'destructive' });
    }
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Are you sure you want to revoke this diagnostic order?')) return;
    setDeleteId(testId);
    try {
      await api.labTests.deleteLabTest(testId);
      addNotification({
        title: 'Diagnostic Order Revoked',
        message: `Lab order #${testId} has been revoked.`,
        type: 'result',
        priority: 'medium',
        audience: 'personal',
      });
      await refreshAppData();
    } catch (err) {
      toast({ title: 'Delete Failed', description: handleApiError(err, 'delete lab test'), variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="alera-feature space-y-4 text-slate-700">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#0b3d62]">Lab results</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
              {filteredLabTests.length} tests tracked
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Biological laboratory orders, accession tracking, and verified report publishing.
          </p>
        </div>

        {effectiveRole === 'doctor' && (
          <button
            onClick={() => setShowOrder(!showOrder)}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            {showOrder ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showOrder ? 'Cancel' : 'Order lab test'}</span>
          </button>
        )}
      </div>

      {/* Order Requisition Surface */}
      {showOrder && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
            Order lab test
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Patient</label>
              <select
                value={orderForm.patientId}
                onChange={(e) => setOrderForm({ ...orderForm, patientId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">Select Patient</option>
                {patientOptions.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Diagnostic Laboratory</label>
              <select
                value={orderForm.labId}
                onChange={(e) => setOrderForm({ ...orderForm, labId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">Select Laboratory</option>
                {labOptions.map((lb) => (
                  <option key={lb.id} value={lb.id}>{lb.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Test name</label>
              <input
                type="text"
                value={orderForm.testName}
                onChange={(e) => setOrderForm({ ...orderForm, testName: e.target.value })}
                placeholder="e.g. High-Sensitivity Troponin I"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
          </div>

          <button
            onClick={() => void handleOrder()}
            className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs"
          >
            Send lab request
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['all', 'requested', 'in-progress', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
                statusFilter === st
                  ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
              }`}
            >
              {st === 'all' ? 'All tests' : st.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test name or patient..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] pl-9 pr-3 py-1.5 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Assay List Grid */}
      {filteredLabTests.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No matching lab tests found.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLabTests.map((test) => (
            <div
              key={test.id}
              className={`p-3 bg-[#090D14] border rounded-[2px] flex flex-col space-y-2 text-xs ${
                focusId === test.id ? 'border-cyan-500/80 bg-[#0F1218]' : 'border-[#252A35]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 mt-0.5">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#ECEEF2] flex items-center gap-2">
                      <span>{test.testName}</span>
                      <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        {test.destinationProviderName || 'Laboratory'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Patient: <strong className="text-white">{test.patientName}</strong> • Ordered by: <strong>{test.doctorName}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      Date: {test.date}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase border ${
                    test.status === 'completed'
                      ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                      : test.status === 'in-progress'
                      ? 'bg-amber-950/50 border-amber-600/60 text-amber-400'
                      : 'bg-[#151922] border-[#2F3542] text-slate-400'
                  }`}>
                    {test.status}
                  </span>

                  {user?.role === 'laboratory' && test.status !== 'completed' && (
                    <button
                      onClick={() => { setShowUpload(test.id); setUploadResult(test.results || ''); }}
                      className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-600/60 text-cyan-300 text-[10px] font-bold rounded-[2px] hover:bg-cyan-900"
                    >
                      PUBLISH VALUES
                    </button>
                  )}

                  {effectiveRole === 'doctor' && (
                    <button
                      onClick={() => void handleDelete(test.id)}
                      disabled={deleteId === test.id}
                      className="p-1 bg-red-950/40 border border-red-900/60 text-red-400 hover:text-red-200 rounded-[2px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {test.results && (
                <div className="p-2 bg-[#06080C] border border-[#1F232E] rounded-[2px] text-[11px] text-slate-300">
                  <strong className="text-cyan-400 block text-[10px] uppercase font-mono">Lab results:</strong>
                  <span>{test.results}</span>
                </div>
              )}

              {showUpload === test.id && (
                <div className="p-3 bg-[#0F1218] border border-cyan-500/50 rounded-[2px] space-y-2 mt-2">
                  <span className="text-[10px] font-semibold text-[#0b3d62] block">Enter verified lab results</span>
                  <textarea
                    value={uploadResult}
                    onChange={(e) => setUploadResult(e.target.value)}
                    placeholder="Enter lab result values, units, and reference bounds..."
                    className="w-full bg-[#06080C] border border-[#252A35] rounded-[2px] p-2 text-xs text-[#ECEEF2]"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowUpload(null)} className="px-3 py-1 bg-[#151922] text-xs text-slate-400 rounded-[2px]">Cancel</button>
                    <button onClick={() => handleUpload(test.id)} className="px-3 py-1 bg-cyan-950 border border-cyan-600 text-cyan-300 text-xs font-bold rounded-[2px]">PUBLISH TO EMR</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LabResultsPage;
