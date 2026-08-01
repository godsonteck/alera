import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Building2, Calendar, CheckCircle2, FileText, FlaskConical, Heart, Image as ImageIcon, LockKeyhole, Pill, Plus, ScanLine, ShieldCheck, Syringe, User, ActivitySquare, Ban } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { medicalRecordsApi, organizationsApi, patientPermissionsApi, recordsApi, type OrganizationApiResponse, type PatientPermissionResponse, type SynchronizedHistoryResponse, type SynchronizedHistoryTimelineEntry, type UnifiedPatientRecordApiResponse } from '@/lib/apiService';
import type { PatientMedicalHistory } from '@/data/mockData';

type RecordFormType = 'condition' | 'surgery' | 'family' | 'vaccination';

const formatDate = (value?: string | null) => {
  if (!value) return 'UNRECORDED';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split('T')[0];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'UNRECORDED';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').slice(0, 19);
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === 'string') return response.data.detail;
  }
  if (error instanceof Error) return error.message;
  return 'Unable to load medical history.';
};

const timelineMeta = (source: string) => {
  switch (source) {
    case 'appointment': return { icon: <Calendar className="w-3.5 h-3.5" />, tone: 'bg-cyan-950/40 border-cyan-600/60 text-cyan-400' };
    case 'prescription': return { icon: <Pill className="w-3.5 h-3.5" />, tone: 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400' };
    case 'lab_test': return { icon: <FlaskConical className="w-3.5 h-3.5" />, tone: 'bg-amber-950/40 border-amber-600/60 text-amber-400' };
    case 'imaging_scan': return { icon: <ScanLine className="w-3.5 h-3.5" />, tone: 'bg-violet-950/40 border-violet-600/60 text-violet-400' };
    case 'medical_history': return { icon: <Heart className="w-3.5 h-3.5" />, tone: 'bg-red-950/40 border-red-600/60 text-red-400' };
    default: return { icon: <FileText className="w-3.5 h-3.5" />, tone: 'bg-[#151922] border-[#252A35] text-slate-400' };
  }
};

const SummaryCard = ({ label, value, helper, icon: Icon }: { label: string; value: number | string; helper: string; icon?: React.ElementType }) => (
  <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center flex flex-col items-center justify-center relative overflow-hidden group">
    <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1 z-10">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5 z-10">{value}</div>
    <div className="text-[9px] text-slate-600 uppercase mt-1 z-10">{helper}</div>
  </div>
);

const UnifiedTimeline = ({ entries }: { entries: SynchronizedHistoryTimelineEntry[] }) => {
  if (entries.length === 0) return <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[2px] text-xs text-slate-500">No history recorded yet.</div>;

  return (
    <div className="space-y-0 border-l border-[#252A35] ml-4 pl-4 py-2 relative">
      {entries.map((entry, index) => {
        const meta = timelineMeta(entry.source);
        return (
          <div key={`${entry.source}-${entry.source_id}`} className="relative mb-6 last:mb-0 group">
            <div className={`absolute -left-[29px] top-1 w-6 h-6 rounded-[2px] border flex items-center justify-center z-10 bg-[#0F1218] transition-colors group-hover:border-cyan-500/60 ${meta.tone}`}>
              {meta.icon}
            </div>
            <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] transition-colors group-hover:border-[#2F3542]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-[#ECEEF2] uppercase tracking-wider">{entry.title}</div>
                  <div className="mt-1 text-[10px] text-slate-500 uppercase font-mono">
                    {entry.provider_name ? `OP: ${entry.provider_name}` : 'OP: UNKNOWN'}
                  </div>
                </div>
                {entry.status && <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-400 text-[9px] font-bold rounded-[2px] uppercase">{entry.status}</span>}
              </div>
              <div className="mt-2 text-[9px] text-cyan-500/80 font-mono uppercase">TX: {formatDateTime(entry.timestamp)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MedicalHistoryPage = () => {
  const { user, getUsers } = useAuth();
  const { medicalHistories, addMedicalHistory, updateMedicalHistory } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<RecordFormType>('condition');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [syncedHistory, setSyncedHistory] = useState<SynchronizedHistoryResponse | null>(null);
  const [unifiedRecord, setUnifiedRecord] = useState<UnifiedPatientRecordApiResponse | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationApiResponse | null>(null);
  const [isLoadingSyncedHistory, setIsLoadingSyncedHistory] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [permissionActionLoading, setPermissionActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [formData, setFormData] = useState({ name: '', date: '', notes: '', relation: '', surgeon: '', hospital: '' });

  const isPatientView = user?.role === 'patient';
  const canSelectPatient = user?.role === 'doctor' || user?.role === 'hospital' || user?.role === 'admin' || user?.role === 'super_admin';

  const userMedicalHistory = useMemo(() => medicalHistories.find((mh) => mh.patientId === user?.id), [medicalHistories, user?.id]);
  const accessiblePatients = useMemo(() => getUsers().filter((candidate) => candidate.role === 'patient').sort((a, b) => a.name.localeCompare(b.name)), [getUsers]);

  useEffect(() => {
    if (!user) return;
    if (isPatientView) { setSelectedPatientId(user.id); return; }
    if (!canSelectPatient) { setSelectedPatientId(''); return; }

    const requestedPatientId = searchParams.get('patient');
    const requestedIsAccessible = accessiblePatients.some((candidate) => candidate.id === requestedPatientId);
    const nextPatientId = requestedIsAccessible ? requestedPatientId ?? '' : accessiblePatients[0]?.id ?? '';

    if (nextPatientId !== selectedPatientId) setSelectedPatientId(nextPatientId);
  }, [accessiblePatients, canSelectPatient, isPatientView, searchParams, selectedPatientId, user]);

  useEffect(() => {
    if (!canSelectPatient || !selectedPatientId) return;
    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.get('patient') !== selectedPatientId) { nextParams.set('patient', selectedPatientId); setSearchParams(nextParams, { replace: true }); }
  }, [canSelectPatient, searchParams, selectedPatientId, setSearchParams]);

  const focusedPatientId = isPatientView ? user?.id ?? '' : selectedPatientId;
  const focusedPatientName = isPatientView ? user?.name : accessiblePatients.find((candidate) => candidate.id === focusedPatientId)?.name;

  useEffect(() => {
    if (!focusedPatientId) { setSyncedHistory(null); setSyncError(null); return; }
    let active = true;
    const loadSynchronizedHistory = async () => {
      setIsLoadingSyncedHistory(true); setSyncError(null);
      try {
        const [response, unified] = await Promise.all([recordsApi.getSynchronizedHistory(focusedPatientId), medicalRecordsApi.getUnifiedRecord(focusedPatientId)]);
        if (!active) return; setSyncedHistory(response); setUnifiedRecord(unified);
      } catch (error) {
        if (!active) return; setSyncedHistory(null); setUnifiedRecord(null); setSyncError(getErrorMessage(error));
      } finally { if (active) setIsLoadingSyncedHistory(false); }
    };
    void loadSynchronizedHistory();
    return () => { active = false; };
  }, [focusedPatientId]);

  useEffect(() => {
    if (!user || user.role === 'patient') { setCurrentOrganization(null); return; }
    let active = true;
    const loadOrganizations = async () => {
      try { const response = await organizationsApi.listOrganizations(); if (!active) return; setCurrentOrganization(response.items?.[0] ?? null); }
      catch (error) { if (!active) return; setCurrentOrganization(null); }
    };
    void loadOrganizations();
    return () => { active = false; };
  }, [user]);

  const refreshUnifiedRecord = useCallback(async () => {
    if (!focusedPatientId) return;
    const [history, unified] = await Promise.all([recordsApi.getSynchronizedHistory(focusedPatientId), medicalRecordsApi.getUnifiedRecord(focusedPatientId)]);
    setSyncedHistory(history); setUnifiedRecord(unified);
  }, [focusedPatientId]);

  useEffect(() => {
    if (!focusedPatientId) return;
    const interval = window.setInterval(() => { void refreshUnifiedRecord(); }, 15000);
    return () => window.clearInterval(interval);
  }, [refreshUnifiedRecord, focusedPatientId]);

  const handleAddHistoryItem = () => {
    if (!user) return;
    if (!userMedicalHistory) {
      const newHistory: PatientMedicalHistory = {
        id: `mh-${Date.now()}`, patientId: user.id, conditions: [], surgeries: [], familyHistory: [], socialHistory: { smoking: 'never', alcohol: '', drugs: '', lastUpdated: new Date().toISOString().split('T')[0] }, vaccinations: [], lastUpdated: new Date().toISOString().split('T')[0],
      };
      if (formType === 'condition' && formData.name) newHistory.conditions.push({ id: `cond-${Date.now()}`, name: formData.name, dateOnset: formData.date, status: 'active', notes: formData.notes });
      else if (formType === 'surgery' && formData.name) newHistory.surgeries.push({ id: `surg-${Date.now()}`, name: formData.name, date: formData.date, surgeon: formData.surgeon, hospital: formData.hospital, notes: formData.notes });
      else if (formType === 'family' && formData.name) newHistory.familyHistory.push({ id: `fam-${Date.now()}`, relation: formData.relation, condition: formData.name });
      else if (formType === 'vaccination' && formData.name) newHistory.vaccinations.push({ id: `vac-${Date.now()}`, name: formData.name, date: formData.date, provider: formData.notes });
      addMedicalHistory(newHistory);
    } else {
      updateMedicalHistory(userMedicalHistory.id, (history) => {
        if (formType === 'condition' && formData.name) return { ...history, conditions: [...history.conditions, { id: `cond-${Date.now()}`, name: formData.name, dateOnset: formData.date, status: 'active', notes: formData.notes }] };
        if (formType === 'surgery' && formData.name) return { ...history, surgeries: [...history.surgeries, { id: `surg-${Date.now()}`, name: formData.name, date: formData.date, surgeon: formData.surgeon, hospital: formData.hospital, notes: formData.notes }] };
        if (formType === 'family' && formData.name) return { ...history, familyHistory: [...history.familyHistory, { id: `fam-${Date.now()}`, relation: formData.relation, condition: formData.name }] };
        if (formType === 'vaccination' && formData.name) return { ...history, vaccinations: [...history.vaccinations, { id: `vac-${Date.now()}`, name: formData.name, date: formData.date, provider: formData.notes }] };
        return history;
      });
    }
    setFormData({ name: '', date: '', notes: '', relation: '', surgeon: '', hospital: '' }); setShowForm(false);
  };

  const handleRequestAccess = async () => {
    if (!focusedPatientId || !currentOrganization) return; setPermissionActionLoading('request');
    try { await patientPermissionsApi.requestAccess({ patient_id: Number(focusedPatientId), organization_id: currentOrganization.id, scope: ['full_record'], reason: 'Clinical review requested from unified medical record' }); await refreshUnifiedRecord(); }
    catch (error) { setSyncError(getErrorMessage(error)); } finally { setPermissionActionLoading(null); }
  };

  const handleApprovePermission = async (permissionId: string) => {
    setPermissionActionLoading(permissionId);
    try { await patientPermissionsApi.approveAccess(permissionId); await refreshUnifiedRecord(); } catch (error) { setSyncError(getErrorMessage(error)); } finally { setPermissionActionLoading(null); }
  };
  const handleDenyPermission = async (permissionId: string) => {
    setPermissionActionLoading(permissionId);
    try { await patientPermissionsApi.denyAccess(permissionId); await refreshUnifiedRecord(); } catch (error) { setSyncError(getErrorMessage(error)); } finally { setPermissionActionLoading(null); }
  };
  const handleRevokePermission = async (permissionId: string) => {
    setPermissionActionLoading(permissionId);
    try { await patientPermissionsApi.revokeAccess(permissionId); await refreshUnifiedRecord(); } catch (error) { setSyncError(getErrorMessage(error)); } finally { setPermissionActionLoading(null); }
  };

  const unifiedConditions = syncedHistory?.medical_history ?? [];
  const unifiedPrescriptions = syncedHistory?.prescriptions ?? [];
  const unifiedLabTests = syncedHistory?.lab_tests ?? [];
  const unifiedImagingScans = syncedHistory?.imaging_scans ?? [];
  const unifiedTimeline = syncedHistory?.timeline ?? [];
  const unifiedDocuments = useMemo(() => (unifiedRecord?.records ?? []).flatMap((record) => record.documents ?? []), [unifiedRecord]);
  const unifiedPermissions = unifiedRecord?.permissions ?? [];
  const activeGrantedPermissions = unifiedPermissions.filter((permission) => permission.status === 'granted');
  const pendingPermissions = unifiedPermissions.filter((permission) => permission.status === 'requested');
  const currentOrgPermission = currentOrganization ? unifiedPermissions.find((permission) => permission.organization_id === currentOrganization.id && permission.status === 'granted') : null;

  if (!user) return null;

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-lg font-bold text-[#0b3d62]">Medical history</span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isPatientView ? 'Your shared medical record.' : 'Review the patient medical record.'}
          </p>
        </div>
        {isPatientView && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
            <Plus className="w-4 h-4" /> INJECT ENTRY
          </button>
        )}
      </div>

      {showForm && isPatientView && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-base font-semibold text-[#0b3d62] block border-b border-[#252A35] pb-2">Add history item</span>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Record type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value as RecordFormType)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] uppercase">
                <option value="condition">CLINICAL CONDITION</option><option value="surgery">SURGICAL INTERVENTION</option><option value="family">GENETIC HISTORY</option><option value="vaccination">IMMUNIZATION</option>
              </select>
            </div>
            
            {formType === 'condition' && (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">CONDITION DESIGNATION *</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">ONSET EPOCH</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">CLINICAL NOTES</label>
                  <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] min-h-[60px]" />
                </div>
              </>
            )}

            {formType === 'surgery' && (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">PROCEDURE DESIGNATION *</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">EPOCH</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">OPERATOR</label>
                  <input value={formData.surgeon} onChange={e => setFormData({ ...formData, surgeon: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">FACILITY</label>
                  <input value={formData.hospital} onChange={e => setFormData({ ...formData, hospital: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
                </div>
              </>
            )}

            {formType === 'family' && (
              <>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Related provider *</label>
                  <select value={formData.relation} onChange={e => setFormData({ ...formData, relation: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] uppercase">
                    <option value="">SELECT...</option><option value="mother">MOTHER</option><option value="father">FATHER</option><option value="sibling">SIBLING</option><option value="grandparent">GRANDPARENT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">CONDITION *</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
                </div>
              </>
            )}

            {formType === 'vaccination' && (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">IMMUNIZATION *</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">EPOCH</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 bg-[#151922] border border-[#2F3542] text-slate-300 font-bold py-2 rounded-[2px] uppercase text-xs">CANCEL</button>
            <button onClick={handleAddHistoryItem} disabled={!formData.name} className="flex-1 bg-cyan-950/40 border border-cyan-600/60 text-cyan-400 font-bold py-2 rounded-[2px] uppercase text-xs disabled:opacity-50">Save history item</button>
          </div>
        </div>
      )}

      {canSelectPatient && (
        <div className="p-4 bg-[#090D14] border border-cyan-900/40 rounded-[2px] flex items-center gap-4">
          <span className="text-[10px] text-cyan-500 uppercase font-bold tracking-wider shrink-0">TARGET ENTITY:</span>
          <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} className="flex-1 bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] text-xs uppercase font-bold focus:border-cyan-500/50 outline-none">
            <option value="">-- SELECT PATIENT --</option>
            {accessiblePatients.map((p) => <option key={p.id} value={p.id}>{p.name} [{p.id}]</option>)}
          </select>
        </div>
      )}

      {!focusedPatientId && canSelectPatient && (
        <div className="p-8 text-center bg-amber-950/10 border border-amber-900/40 rounded-[2px] text-xs text-amber-500 font-mono uppercase">
          NO TARGET ENTITY SELECTED. SYNCHRONIZATION PAUSED.
        </div>
      )}

      {syncError && (
        <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-[2px] text-[10px] text-red-500/80 uppercase font-bold flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          {syncError}
        </div>
      )}

      {isLoadingSyncedHistory ? (
        <div className="p-12 text-center text-xs text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px] bg-[#090D14] animate-pulse">
          Loading medical history...
        </div>
      ) : syncedHistory ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SummaryCard label="EVENTS" value={syncedHistory.counts.appointments} helper="CLINICAL ENCOUNTERS" icon={Calendar} />
            <SummaryCard label="Prescriptions" value={syncedHistory.counts.prescriptions} helper="Active medications" icon={Pill} />
            <SummaryCard label="DIAGNOSTICS" value={syncedHistory.counts.lab_tests + syncedHistory.counts.imaging_scans} helper="LAB/IMAGING RESULTS" icon={FlaskConical} />
            <SummaryCard label="DOCS" value={unifiedRecord?.document_count ?? unifiedDocuments.length} helper="ATTACHED FILES" icon={FileText} />
          </div>

          <div className="grid md:grid-cols-[1.5fr_1fr] gap-4">
            <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-4 flex flex-col gap-4">
              <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> SECURE LINK STATUS</span>
              <div className="flex flex-wrap gap-2">
                <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-300 text-[9px] font-bold uppercase rounded-[2px]">CLEARANCE: {syncedHistory.access_scope}</span>
                <span className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase rounded-[2px] ${syncedHistory.has_shared_history_consent ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400' : 'bg-red-950/40 border-red-600/60 text-red-400'}`}>CONSENT: {syncedHistory.has_shared_history_consent ? 'ACTIVE' : 'REVOKED'}</span>
                <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-300 text-[9px] font-bold uppercase rounded-[2px]">Providers: {activeGrantedPermissions.length}</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-relaxed uppercase">
                Your record is shared only with providers you have approved.
              </div>
              {!isPatientView && currentOrganization && (
                currentOrgPermission ? (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-[10px] text-emerald-500 uppercase font-bold rounded-[2px]">
                    CLEARANCE GRANTED. SECURE LINK ESTABLISHED WITH {currentOrganization.name}.
                  </div>
                ) : (
                  <button onClick={handleRequestAccess} disabled={permissionActionLoading === 'request'} className="w-full bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-600/60 text-cyan-400 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-[10px] disabled:opacity-50">
                    {permissionActionLoading === 'request' ? 'Sending request...' : 'Request access'}
                  </button>
                )
              )}
            </div>

            <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-4 flex flex-col gap-4">
              <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> Connected providers</span>
              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2">
                {syncedHistory.interacting_organizations.length > 0 ? (
                  syncedHistory.interacting_organizations.map((participant) => (
                    <div key={participant.user_id} className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] flex items-center justify-between">
                      <div className="text-[10px] font-bold text-[#ECEEF2] uppercase">{participant.name}</div>
                      <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-400 text-[8px] font-bold uppercase rounded-[2px]">{participant.role}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-500">No connected providers yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-[#252A35] pb-2">
              {[
                { id: 'timeline', label: 'TIMELINE' },
                { id: 'conditions', label: 'CONDITIONS' },
                { id: 'medications', label: 'RX' },
                { id: 'diagnostics', label: 'LAB/RAD' },
                { id: 'documents', label: 'DOCS' },
                { id: 'access', label: 'ACL' },
                ...(isPatientView ? [{ id: 'personal', label: 'LOCAL TX' }] : [])
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors rounded-[2px] border ${activeTab === tab.id ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-[#090D14] border border-[#252A35] rounded-[2px] p-4">
              {activeTab === 'timeline' && (
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 mb-4">CHRONOLOGICAL EVENT STREAM</span>
                  <UnifiedTimeline entries={unifiedTimeline} />
                </div>
              )}

              {activeTab === 'conditions' && (
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 mb-4">CLINICAL CONDITIONS & ALLERGIES</span>
                  <div className="grid md:grid-cols-2 gap-3">
                    {unifiedConditions.length > 0 ? (
                      unifiedConditions.map((condition) => (
                        <div key={String(condition.id ?? condition.condition_name)} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-[11px] font-bold text-[#ECEEF2] uppercase">{String(condition.condition_name ?? 'Unknown condition')}</div>
                            {condition.status && <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-300 text-[9px] font-bold uppercase rounded-[2px]">{String(condition.status)}</span>}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono uppercase mb-2">ONSET: {formatDate(typeof condition.onset_date === 'string' ? condition.onset_date : null)}</div>
                          {typeof condition.description === 'string' && condition.description && <div className="text-[10px] text-slate-400 uppercase leading-relaxed">{condition.description}</div>}
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-8 text-center text-xs text-slate-500 border border-[#252A35] rounded-[2px]">No conditions recorded.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'medications' && (
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 mb-4">PHARMACOLOGICAL INTERVENTIONS</span>
                  <div className="grid md:grid-cols-2 gap-3">
                    {unifiedPrescriptions.length > 0 ? (
                      unifiedPrescriptions.map((prescription) => (
                        <div key={String(prescription.id ?? prescription.medication_name)} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-[11px] font-bold text-emerald-400 uppercase">{String(prescription.medication_name ?? 'UNKNOWN COMPOUND')}</div>
                            {prescription.status && <span className="px-1.5 py-0.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-500 text-[9px] font-bold uppercase rounded-[2px]">{String(prescription.status)}</span>}
                          </div>
                          <div className="text-[10px] text-[#ECEEF2] font-mono uppercase my-2">DOSAGE: {String(prescription.dosage ?? '')} {String(prescription.dosage_unit ?? '')} | FREQ: {String(prescription.frequency ?? '')}</div>
                          <div className="flex items-center justify-between mt-3 text-[9px] font-mono text-slate-500 uppercase border-t border-[#252A35] pt-2">
                            <span>OP: {String(prescription.provider_name ?? 'UNKNOWN')}</span>
                            <span>TX: {formatDate(typeof prescription.start_date === 'string' ? prescription.start_date : null)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-8 text-center text-xs text-slate-500 border border-[#252A35] rounded-[2px]">No prescriptions recorded.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'diagnostics' && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase block border-b border-amber-900/40 pb-2 mb-3 flex items-center gap-2"><FlaskConical className="w-3 h-3" /> LAB RESULTS</span>
                    <div className="space-y-2">
                      {unifiedLabTests.length > 0 ? (
                        unifiedLabTests.map((test) => (
                          <div key={String(test.id ?? test.test_name)} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                            <div className="flex items-start justify-between mb-1">
                              <div className="text-[10px] font-bold text-[#ECEEF2] uppercase">{String(test.test_name ?? 'UNKNOWN ASSAY')}</div>
                              {test.status && <span className="px-1.5 py-0.5 bg-amber-950/20 border border-amber-900/40 text-amber-500 text-[8px] font-bold uppercase rounded-[2px]">{String(test.status)}</span>}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono uppercase mb-2">TX: {formatDate(typeof test.ordered_at === 'string' ? test.ordered_at : null)}</div>
                            {typeof test.result_notes === 'string' && test.result_notes && <div className="text-[9px] text-slate-400 uppercase leading-relaxed bg-[#090D14] p-2 border border-[#252A35] rounded-[2px]">{test.result_notes}</div>}
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-[10px] text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px]">NO ASSAYS RECORDED.</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-violet-400 uppercase block border-b border-violet-900/40 pb-2 mb-3 flex items-center gap-2"><ScanLine className="w-3 h-3" /> IMAGING</span>
                    <div className="space-y-2">
                      {unifiedImagingScans.length > 0 ? (
                        unifiedImagingScans.map((scan) => (
                          <div key={String(scan.id ?? scan.scan_type)} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                            <div className="flex items-start justify-between mb-1">
                              <div className="text-[10px] font-bold text-[#ECEEF2] uppercase">{String(scan.scan_type ?? 'UNKNOWN SCAN')}</div>
                              {scan.status && <span className="px-1.5 py-0.5 bg-violet-950/20 border border-violet-900/40 text-violet-400 text-[8px] font-bold uppercase rounded-[2px]">{String(scan.status)}</span>}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono uppercase mb-2">TX: {formatDate(typeof scan.ordered_at === 'string' ? scan.ordered_at : null)}</div>
                            {typeof scan.impression === 'string' && scan.impression && <div className="text-[9px] text-slate-400 uppercase leading-relaxed bg-[#090D14] p-2 border border-[#252A35] rounded-[2px]">{scan.impression}</div>}
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-[10px] text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px]">NO IMAGING RECORDED.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 mb-4">ATTACHED ASSETS</span>
                  <div className="grid md:grid-cols-2 gap-3">
                    {unifiedDocuments.length > 0 ? (
                      unifiedDocuments.map((doc) => (
                        <div key={doc.id} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] flex items-center gap-3">
                          <div className="p-2 bg-[#151922] border border-[#2F3542] text-slate-300 rounded-[2px]">
                            {doc.mime_type?.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-[#ECEEF2] uppercase truncate">{doc.filename}</div>
                            <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 font-mono uppercase">
                              <span>{doc.document_type}</span>
                              <span>|</span>
                              <span>{Math.max(1, Math.round(doc.file_size / 1024))} KB</span>
                            </div>
                            <div className="mt-1 text-[9px] text-cyan-500/80 font-mono uppercase">TX: {formatDate(doc.created_at)}</div>
                          </div>
                          <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-400 text-[8px] font-bold uppercase rounded-[2px] self-start">{doc.source_system}</span>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-8 text-center text-xs text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px]">NO ASSETS LINKED.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'access' && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase block border-b border-emerald-900/40 pb-2 mb-3 flex items-center gap-2"><LockKeyhole className="w-3 h-3" /> ACTIVE ACCESS LIST</span>
                    <div className="space-y-2">
                      {activeGrantedPermissions.length > 0 ? (
                        activeGrantedPermissions.map((permission) => {
                          const org = unifiedRecord?.organization_access.find((item) => item.id === permission.organization_id);
                          return (
                            <div key={permission.id} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="text-[11px] font-bold text-[#ECEEF2] uppercase">{org?.name ?? `Provider ${permission.organization_id}`}</div>
                                  <div className="text-[9px] text-slate-500 uppercase mt-1 font-mono">SCOPE: {permission.scope.join(', ') || 'FULL'} | GRANTED: {formatDate(permission.granted_at)}</div>
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                  <span className="px-1.5 py-0.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-500 text-[8px] font-bold uppercase rounded-[2px]">{permission.status}</span>
                                  {isPatientView && (
                                    <button onClick={() => handleRevokePermission(permission.id)} disabled={permissionActionLoading === permission.id} className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase disabled:opacity-50">
                                      REVOKE
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-[10px] text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px]">NO ACTIVE ACL ENTRIES.</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase block border-b border-amber-900/40 pb-2 mb-3 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> PENDING REQUESTS</span>
                    <div className="space-y-2">
                      {pendingPermissions.length > 0 ? (
                        pendingPermissions.map((permission) => {
                          const org = unifiedRecord?.organization_access.find((item) => item.id === permission.organization_id);
                          return (
                            <div key={permission.id} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                              <div className="text-[11px] font-bold text-[#ECEEF2] uppercase">{org?.name ?? `Provider ${permission.organization_id}`}</div>
                              <div className="text-[9px] text-slate-500 uppercase mt-1 font-mono mb-3">REQ: {formatDate(permission.requested_at)}</div>
                              <div className="flex gap-2">
                                {isPatientView ? (
                                  <>
                                    <button onClick={() => handleApprovePermission(permission.id)} disabled={permissionActionLoading === permission.id} className="flex-1 bg-emerald-950/40 border border-emerald-600/60 text-emerald-400 font-bold py-1.5 rounded-[2px] uppercase text-[9px] disabled:opacity-50">AUTHORIZE</button>
                                    <button onClick={() => handleDenyPermission(permission.id)} disabled={permissionActionLoading === permission.id} className="flex-1 bg-red-950/40 border border-red-600/60 text-red-400 font-bold py-1.5 rounded-[2px] uppercase text-[9px] disabled:opacity-50">DENY</button>
                                  </>
                                ) : (
                                  <span className="px-1.5 py-1 bg-amber-950/20 border border-amber-900/40 text-amber-500 text-[9px] font-bold uppercase rounded-[2px] w-full text-center">AWAITING PATIENT ACTION</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-[10px] text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px]">NO PENDING REQUESTS.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'personal' && isPatientView && (
                <div className="space-y-4">
                  <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2 mb-4">Personal records</span>
                  {!userMedicalHistory ? (
                    <div className="p-8 text-center text-xs text-slate-500 font-mono uppercase border border-[#252A35] rounded-[2px]">NO LOCAL DATA INJECTED YET.</div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {userMedicalHistory.conditions.length > 0 && (
                        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                          <span className="text-[10px] font-bold text-red-400 uppercase block mb-3 flex items-center gap-1"><Heart className="w-3 h-3" /> CONDITIONS</span>
                          {userMedicalHistory.conditions.map(c => (
                            <div key={c.id} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b border-[#252A35] last:border-0">
                              <div className="flex justify-between items-start"><span className="text-[10px] font-bold text-[#ECEEF2] uppercase">{c.name}</span><span className="text-[8px] bg-[#151922] border border-[#2F3542] text-slate-400 px-1 rounded-[2px]">{c.status}</span></div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">ONSET: {c.dateOnset || 'UNKNOWN'}</div>
                              {c.notes && <div className="text-[9px] text-slate-400 mt-1 italic leading-tight">{c.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {userMedicalHistory.surgeries.length > 0 && (
                        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase block mb-3 flex items-center gap-1"><Activity className="w-3 h-3" /> SURGICAL</span>
                          {userMedicalHistory.surgeries.map(s => (
                            <div key={s.id} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b border-[#252A35] last:border-0">
                              <div className="text-[10px] font-bold text-[#ECEEF2] uppercase">{s.name}</div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">TX: {s.date || 'UNKNOWN'}</div>
                              <div className="text-[9px] text-slate-400 uppercase mt-0.5">OP: {s.surgeon || 'UNKNOWN'} | LOC: {s.hospital || 'UNKNOWN'}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {userMedicalHistory.vaccinations.length > 0 && (
                        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase block mb-3 flex items-center gap-1"><Syringe className="w-3 h-3" /> IMMUNIZATIONS</span>
                          {userMedicalHistory.vaccinations.map(v => (
                            <div key={v.id} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b border-[#252A35] last:border-0">
                              <div className="text-[10px] font-bold text-[#ECEEF2] uppercase">{v.name}</div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">TX: {v.date || 'UNKNOWN'} | PROV: {v.provider || 'UNKNOWN'}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {userMedicalHistory.familyHistory.length > 0 && (
                        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                          <span className="text-[10px] font-bold text-amber-400 uppercase block mb-3 flex items-center gap-1"><User className="w-3 h-3" /> GENETICS</span>
                          {userMedicalHistory.familyHistory.map(f => (
                            <div key={f.id} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b border-[#252A35] last:border-0">
                              <div className="text-[10px] font-bold text-[#ECEEF2] uppercase">{f.condition}</div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">REL: {f.relation || 'UNKNOWN'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default MedicalHistoryPage;
