import { useMemo, useState } from 'react';
import { Pill, Plus, Search, X, Inbox, AlertCircle, Trash2, ShieldCheck, UserCheck, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { api } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getDoctorPatients } from '@/lib/patientDirectory';
import { getReferralDestinationProviders } from '@/lib/referralUtils';
import { getVisiblePrescriptions } from '@/lib/recordVisibility';
import type { DrugInteraction } from '@/data/mockData';

const PrescriptionsPage = () => {
  const { user, getUsers } = useAuth();
  const { appointments, prescriptions, checkDrugInteractions, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ patientId: '', pharmacyId: '', medName: '', dosage: '', frequency: '', duration: '' });
  const [interactionWarnings, setInteractionWarnings] = useState<DrugInteraction[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dispenseId, setDispenseId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'dispensed' | 'expired'>('all');
  const focusId = searchParams.get('focus');
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;

  const users = getUsers();
  const patientOptions = useMemo(() => getDoctorPatients(users, appointments, user?.id), [appointments, user?.id, users]);
  const pharmacyOptions = useMemo(() => getReferralDestinationProviders(users, 'pharmacy'), [users]);

  const visiblePrescriptions = useMemo(
    () => getVisiblePrescriptions(prescriptions, user),
    [prescriptions, user],
  );
  const filteredPrescriptions = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return visiblePrescriptions.filter((prescription) => {
      const matchesStatus = statusFilter === 'all' || prescription.status === statusFilter;
      const matchesSearch = !needle
        || prescription.patientName.toLowerCase().includes(needle)
        || prescription.doctorName.toLowerCase().includes(needle)
        || prescription.medications.some((medication) => medication.name.toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter, visiblePrescriptions]);

  const submitPrescription = async (meta: { notifyDuplicate: boolean; notifyInteractions: number }) => {
    if (!formData.patientId || !formData.pharmacyId || !formData.medName || !user?.id) {
      setCreateError('Patient, pharmacy, and medication name are required.');
      return;
    }
    const patient = patientOptions.find((option) => option.id === formData.patientId);
    const pharmacy = pharmacyOptions.find((option) => option.id === formData.pharmacyId);
    if (!patient || !pharmacy) return;

    setSubmitting(true);
    setCreateError(null);
    try {
      const instructions = formData.duration.trim()
        ? `Duration: ${formData.duration.trim()}${overrideReason.trim() ? `. Override: ${overrideReason.trim()}` : ''}`
        : overrideReason.trim() || undefined;

      const created = (await api.prescriptions.createPrescription({
        patient_id: Number(formData.patientId),
        pharmacy_id: Number(formData.pharmacyId),
        medication_name: formData.medName.trim(),
        dosage: formData.dosage.trim() || '1',
        dosage_unit: 'tablet',
        frequency: formData.frequency.trim() || 'As directed',
        route: 'oral',
        instructions,
      })) as { id: string | number };

      addNotification({
        title: 'Prescription Issued',
        message: `Prescription for ${formData.medName} issued to ${patient.name}.`,
        type: 'prescription',
        priority: 'high',
        audience: 'personal',
      });

      await refreshAppData();
      setShowForm(false);
      setFormData({ patientId: '', pharmacyId: '', medName: '', dosage: '', frequency: '', duration: '' });
      setInteractionWarnings([]);
      setOverrideReason('');
      setDuplicateWarning(null);
    } catch (err) {
      setCreateError(handleApiError(err, 'issue prescription'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = (overrideFlags?: 'duplicate_ok' | 'interactions_ok') => {
    if (!formData.patientId || !formData.medName.trim()) {
      setCreateError('Patient and medication name are required.');
      return;
    }
    setCreateError(null);

    const existingMedsForPatient = visiblePrescriptions
      .filter((rx) => rx.patientId === formData.patientId && rx.status === 'active')
      .flatMap((rx) => rx.medications.map((m) => m.name));

    if (overrideFlags !== 'duplicate_ok') {
      const isDuplicate = existingMedsForPatient.some(
        (med) => med.toLowerCase() === formData.medName.trim().toLowerCase()
      );
      if (isDuplicate) {
        setDuplicateWarning(`Patient already has an active regime for ${formData.medName.trim()}.`);
        return;
      }
    }

    if (overrideFlags !== 'interactions_ok') {
      const interactions = checkDrugInteractions(formData.medName.trim(), existingMedsForPatient);
      if (interactions.length > 0) {
        setInteractionWarnings(interactions);
        return;
      }
    }

    void submitPrescription({
      notifyDuplicate: Boolean(duplicateWarning),
      notifyInteractions: interactionWarnings.length,
    });
  };

  const handleDispense = async (prescriptionId: string) => {
    setDispenseId(prescriptionId);
    try {
      await api.prescriptions.dispensePrescription(prescriptionId);
      addNotification({
        title: 'Medication Dispensed',
        message: `Prescription #${prescriptionId} marked as dispensed.`,
        type: 'prescription',
        priority: 'medium',
        audience: 'personal',
      });
      await refreshAppData();
    } catch (err) {
      alert(handleApiError(err, 'dispense prescription'));
    } finally {
      setDispenseId(null);
    }
  };

  const handleDelete = async (prescriptionId: string) => {
    if (!confirm('Are you sure you want to revoke this prescription?')) return;
    setDeleteId(prescriptionId);
    try {
      await api.prescriptions.deletePrescription(prescriptionId);
      addNotification({
        title: 'Prescription Revoked',
        message: `Prescription #${prescriptionId} has been revoked.`,
        type: 'prescription',
        priority: 'medium',
        audience: 'personal',
      });
      await refreshAppData();
    } catch (err) {
      alert(handleApiError(err, 'delete prescription'));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Pharmacological Regimes Node</span>
            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-mono">
              {filteredPrescriptions.length} REGIMES ACTIVE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Audit e-prescriptions, pharmacogenomic compatibility warnings, and dispense fulfillment queues.
          </p>
        </div>

        {effectiveRole === 'doctor' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-purple-500/60 text-purple-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'CANCEL ISSUE' : 'ISSUE E-PRESCRIPTION'}</span>
          </button>
        )}
      </div>

      {/* Form Surface */}
      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
            New Pharmacological Prescription Requisition
          </span>

          {createError && (
            <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300">
              {createError}
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 bg-amber-950/40 border border-amber-600/60 rounded-[2px] text-xs text-amber-300 flex items-start justify-between">
              <div>
                <strong className="block font-bold">DUPLICATE REGIME WARNING</strong>
                <span>{duplicateWarning}</span>
              </div>
              <button
                onClick={() => handleCreate('duplicate_ok')}
                className="px-2 py-1 bg-amber-900 border border-amber-600 text-white rounded-[2px] font-bold text-[10px]"
              >
                PRESCRIBE ANYWAY
              </button>
            </div>
          )}

          {interactionWarnings.length > 0 && (
            <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300 space-y-2">
              <strong className="block font-bold text-red-400 uppercase">DRUG INTERACTION ALERT DETECTED</strong>
              {interactionWarnings.map((iw) => (
                <div key={iw.id} className="p-2 bg-[#150C0C] border border-red-900/60 rounded-[2px]">
                  <div className="font-bold text-white">{iw.drug1} + {iw.drug2}</div>
                  <div className="text-[10px] text-red-300 mt-0.5">{iw.description}</div>
                </div>
              ))}
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Clinical justification for override..."
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-xs text-[#ECEEF2]"
              />
              <button
                onClick={() => handleCreate('interactions_ok')}
                disabled={!overrideReason.trim()}
                className="px-3 py-1 bg-red-900 border border-red-600 text-white text-xs font-bold rounded-[2px]"
              >
                PROCEED WITH CLINICAL OVERRIDE
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Patient</label>
              <select
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">Select Patient</option>
                {patientOptions.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Fulfillment Pharmacy</label>
              <select
                value={formData.pharmacyId}
                onChange={(e) => setFormData({ ...formData, pharmacyId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">Select Pharmacy</option>
                {pharmacyOptions.map((ph) => (
                  <option key={ph.id} value={ph.id}>{ph.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Medication Name</label>
              <input
                type="text"
                value={formData.medName}
                onChange={(e) => setFormData({ ...formData, medName: e.target.value })}
                placeholder="e.g. Vancomycin IV"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Dosage</label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="e.g. 500 mg"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Frequency</label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                placeholder="e.g. Q12H"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Duration</label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g. 7 Days"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
          </div>

          <button
            onClick={() => handleCreate()}
            disabled={submitting}
            className="w-full bg-[#151922] hover:bg-slate-800 border border-purple-500/60 text-purple-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs"
          >
            {submitting ? 'COMMITTING PRESCRIPTION...' : 'COMMIT E-PRESCRIPTION'}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['all', 'active', 'dispensed', 'expired'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
                statusFilter === st
                  ? 'bg-[#151922] border-purple-500/60 text-purple-300 font-semibold'
                  : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
              }`}
            >
              {st === 'all' ? 'ALL REGIMES' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medication or patient..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-purple-500 rounded-[2px] pl-9 pr-3 py-1.5 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* List Grid */}
      {filteredPrescriptions.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No matching prescription records found.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPrescriptions.map((rx) => (
            <div
              key={rx.id}
              className={`p-3 bg-[#090D14] border rounded-[2px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                focusId === rx.id ? 'border-purple-500/80 bg-[#0F1218]' : 'border-[#252A35]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-purple-400 mt-0.5">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2]">
                    {rx.medications.map((m) => `${m.name} (${m.dosage})`).join(', ')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Patient: <strong className="text-white">{rx.patientName}</strong> • Prescribed by: <strong>{rx.doctorName}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Pharmacy: {rx.pharmacyName || 'Unassigned'} • Date: {rx.date}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase border ${
                  rx.status === 'dispensed'
                    ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                    : rx.status === 'active'
                    ? 'bg-purple-950/50 border-purple-600/60 text-purple-300'
                    : 'bg-[#151922] border-[#2F3542] text-slate-400'
                }`}>
                  {rx.status}
                </span>

                {effectiveRole === 'pharmacy' && rx.status === 'active' && (
                  <button
                    onClick={() => void handleDispense(rx.id)}
                    disabled={dispenseId === rx.id}
                    className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-[10px] font-bold rounded-[2px] hover:bg-emerald-900"
                  >
                    {dispenseId === rx.id ? 'DISPENSING...' : 'DISPENSE'}
                  </button>
                )}

                {effectiveRole === 'doctor' && (
                  <button
                    onClick={() => void handleDelete(rx.id)}
                    disabled={deleteId === rx.id}
                    className="p-1 bg-red-950/40 border border-red-900/60 text-red-400 hover:text-red-200 rounded-[2px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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

export default PrescriptionsPage;
