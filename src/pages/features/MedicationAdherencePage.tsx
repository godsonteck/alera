import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, X, Calendar, TrendingUp, Pill, Plus, Search } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { toast } from '@/components/ui/use-toast';
import type { MedicationAdherence } from '@/data/mockData';

const MedicationAdherencePage: React.FC = () => {
  const { user } = useAuth();
  const { medicationAdherence, recordMedicationAdherence, prescriptions } = useAppData();
  const [selectedPrescription, setSelectedPrescription] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusFilter, setFocusFilter] = useState<'all' | 'excellent' | 'needs-help'>('all');

  const patientId = user?.role === 'patient' ? user.id : '';
  const patientAdherence = medicationAdherence.filter((a) => a.patientId === patientId);
  const patientPrescriptions = prescriptions.filter((p) => p.patientId === patientId);

  const [formData, setFormData] = useState({
    prescriptionId: selectedPrescription || '', medicationName: '', tookDose: true, notes: '',
  });

  const selectedPrescriptionRecord = patientPrescriptions.find((p) => p.id === formData.prescriptionId);

  const stats = useMemo(() => {
    const overall = patientAdherence.length > 0 ? (patientAdherence.reduce((sum, a) => sum + a.adherencePercentage, 0) / patientAdherence.length) : 0;
    const poor = patientAdherence.filter((a) => a.adherencePercentage < 80).length;
    const excellent = patientAdherence.filter((a) => a.adherencePercentage >= 95).length;
    return { totalMedications: patientAdherence.length, overallAdherence: Math.round(overall), poorAdherence: poor, excellentAdherence: excellent };
  }, [patientAdherence]);

  useEffect(() => {
    if (!selectedPrescriptionRecord) return;
    const nextMedicationName = selectedPrescriptionRecord.medications[0]?.name || '';
    setFormData((cur) => ({ ...cur, medicationName: cur.medicationName || nextMedicationName }));
  }, [selectedPrescriptionRecord]);

  const handleRecordAdherence = () => {
    if (!patientId) { toast({ title: 'Auth fault', description: 'Patient session missing.', variant: 'destructive' }); return; }
    if (!formData.prescriptionId || !formData.medicationName) { toast({ title: 'Validation fault', description: 'Prescription missing.', variant: 'destructive' }); return; }

    const newAdherence: MedicationAdherence = {
      id: `adh-${Date.now()}`, patientId, prescriptionId: formData.prescriptionId, medicationName: formData.medicationName,
      startDate: new Date().toISOString().split('T')[0], adherencePercentage: formData.tookDose ? 100 : 0,
      missedDoses: formData.tookDose ? 0 : 1, totalDoses: 1, lastDoseDate: formData.tookDose ? new Date().toISOString().split('T')[0] : undefined,
      notes: formData.notes || undefined,
    };
    recordMedicationAdherence(newAdherence);
    toast({ title: 'Telemetry recorded', description: 'Compliance matrix updated.' });
    setFormData({ prescriptionId: selectedPrescription || '', medicationName: '', tookDose: true, notes: '' });
    setShowForm(false);
  };

  const filteredAdherence = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patientAdherence
      .filter((a) => !selectedPrescription || a.prescriptionId === selectedPrescription)
      .filter((a) => (focusFilter === 'all' || (focusFilter === 'excellent' && a.adherencePercentage >= 95) || (focusFilter === 'needs-help' && a.adherencePercentage < 80)))
      .filter((a) => (!q || a.medicationName.toLowerCase().includes(q) || (a.notes || '').toLowerCase().includes(q)))
      .sort((l, r) => new Date(r.lastDoseDate || r.startDate).getTime() - new Date(l.lastDoseDate || l.startDate).getTime());
  }, [focusFilter, patientAdherence, searchQuery, selectedPrescription]);

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Pharmacology Compliance</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Track medication adherence telemetry and compliance indices.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'CANCEL' : 'RECORD DOSE'}</span>
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Log Medication Action</span>
          
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Prescription Source</label>
              <select
                value={formData.prescriptionId}
                onChange={(e) => setFormData((cur) => ({ ...cur, prescriptionId: e.target.value, medicationName: patientPrescriptions.find(rx => rx.id === e.target.value)?.medications[0]?.name || cur.medicationName }))}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">SELECT PRESCRIPTION...</option>
                {patientPrescriptions.map((rx) => (
                  <option key={rx.id} value={rx.id}>{rx.medications[0]?.name || 'UNKNOWN'} - {rx.medications[0]?.dosage || ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Compound Name</label>
              <input value={formData.medicationName} onChange={(e) => setFormData(cur => ({ ...cur, medicationName: e.target.value }))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Dose Administered</label>
              <div className="flex gap-2">
                <button onClick={() => setFormData(cur => ({ ...cur, tookDose: true }))} className={`flex-1 py-1.5 font-bold uppercase text-[10px] rounded-[2px] transition-colors border flex items-center justify-center gap-1 ${formData.tookDose ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500'}`}><Check className="w-3 h-3" /> YES</button>
                <button onClick={() => setFormData(cur => ({ ...cur, tookDose: false }))} className={`flex-1 py-1.5 font-bold uppercase text-[10px] rounded-[2px] transition-colors border flex items-center justify-center gap-1 ${!formData.tookDose ? 'bg-red-950/60 border-red-600/60 text-red-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500'}`}><X className="w-3 h-3" /> NO</button>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Clinical Notes</label>
              <input value={formData.notes} onChange={(e) => setFormData(cur => ({ ...cur, notes: e.target.value }))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
          </div>
          
          <button onClick={handleRecordAdherence} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs">
            COMMIT COMPLIANCE LOG
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1"><Pill className="w-3 h-3" /> PRESCRIPTIONS</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{stats.totalMedications}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-cyan-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-cyan-500 uppercase font-bold flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> COMPLIANCE MEAN</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{stats.overallAdherence}%</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> OPTIMAL</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.excellentAdherence}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-red-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-red-500 uppercase font-bold flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> SUB-OPTIMAL</div>
          <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{stats.poorAdherence}</div>
        </div>
      </div>

      {stats.poorAdherence > 0 && (
        <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-[2px] text-[10px] text-red-500/80 uppercase leading-relaxed flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-1">COMPLIANCE FAULT DETECTED</span>
            {stats.poorAdherence} compound(s) with adherence below 80%. Risk of treatment failure elevated.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="QUERY COMPLIANCE DATA..."
            className="w-full h-8 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select value={selectedPrescription || ''} onChange={(e) => setSelectedPrescription(e.target.value || null)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="">ALL COMPOUNDS</option>
          {patientPrescriptions.map((rx) => <option key={rx.id} value={rx.id}>{rx.medications[0]?.name || 'UNKNOWN'}</option>)}
        </select>
        <select value={focusFilter} onChange={(e) => setFocusFilter(e.target.value as 'all' | 'excellent' | 'needs-help')} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL DATA</option><option value="excellent">OPTIMAL ONLY</option><option value="needs-help">SUB-OPTIMAL</option>
        </select>
      </div>

      {/* List */}
      {filteredAdherence.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          NO COMPLIANCE LOGS LOCATED
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredAdherence.map((adherence) => (
            <div key={adherence.id} className={`p-3 bg-[#090D14] border rounded-[2px] flex flex-col gap-3 ${
              adherence.adherencePercentage >= 95 ? 'border-emerald-600/40' : adherence.adherencePercentage >= 80 ? 'border-cyan-600/40' : adherence.adherencePercentage >= 60 ? 'border-amber-600/40' : 'border-red-600/40'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-[#ECEEF2] text-xs uppercase">{adherence.medicationName}</div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> INIT: {new Date(adherence.startDate).toISOString().split('T')[0]}</div>
                  {adherence.lastDoseDate && <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><Check className="w-3 h-3" /> LAST: {new Date(adherence.lastDoseDate).toISOString().split('T')[0]}</div>}
                  {adherence.notes && <div className="mt-1.5 p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-[10px] text-slate-400">{adherence.notes}</div>}
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold font-mono ${adherence.adherencePercentage >= 95 ? 'text-emerald-400' : adherence.adherencePercentage >= 80 ? 'text-cyan-400' : adherence.adherencePercentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {adherence.adherencePercentage}%
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold mt-1 tracking-wider">
                    {adherence.adherencePercentage >= 95 ? 'OPTIMAL' : adherence.adherencePercentage >= 80 ? 'NOMINAL' : adherence.adherencePercentage >= 60 ? 'DEGRADED' : 'CRITICAL'}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono mt-1">VOL: {adherence.totalDoses} | FAIL: {adherence.missedDoses}</div>
                </div>
              </div>
              <div className="h-1 bg-[#0F1218] rounded-full overflow-hidden">
                <div className={`h-full ${adherence.adherencePercentage >= 95 ? 'bg-emerald-500' : adherence.adherencePercentage >= 80 ? 'bg-cyan-500' : adherence.adherencePercentage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${adherence.adherencePercentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicationAdherencePage;
