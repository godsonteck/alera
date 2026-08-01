import { useState, useMemo } from 'react';
import { Heart, Plus, X, AlertCircle, CheckCircle, Inbox } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import type { PatientProblem } from '@/data/mockData';

const problemSeverities = ['mild', 'moderate', 'severe'] as const;

const PatientProblemListPage = () => {
  const { user } = useAuth();
  const { patientProblems, addPatientProblem, updatePatientProblem } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [formData, setFormData] = useState({
    problem: '', icd10Code: '', severity: 'moderate' as typeof problemSeverities[number], notes: '',
  });

  const userProblems = useMemo(() => patientProblems.filter((p) => p.patientId === user?.id), [patientProblems, user?.id]);
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return userProblems;
    return userProblems.filter((p) => p.status === statusFilter);
  }, [userProblems, statusFilter]);

  const activeProblems = useMemo(() => userProblems.filter((p) => p.status === 'active'), [userProblems]);
  const resolvedProblems = useMemo(() => userProblems.filter((p) => p.status === 'resolved'), [userProblems]);

  const handleAddProblem = () => {
    if (!formData.problem) return;
    const newProblem: PatientProblem = {
      id: `prob-${Date.now()}`, patientId: user?.id || '', problem: formData.problem,
      icd10Code: formData.icd10Code || undefined, dateIdentified: new Date().toISOString().split('T')[0],
      status: 'active', severity: formData.severity, notes: formData.notes || undefined,
    };
    addPatientProblem(newProblem);
    setFormData({ problem: '', icd10Code: '', severity: 'moderate', notes: '' });
    setShowForm(false);
  };

  const handleResolveProblem = (id: string) => updatePatientProblem(id, (p) => ({ ...p, status: 'resolved' }));
  const handleReactivateProblem = (id: string) => updatePatientProblem(id, (p) => ({ ...p, status: 'active' }));

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Pathology & Condition Index</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Chronological ledger of active and resolved patient health conditions.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'CANCEL' : 'ADD CONDITION'}</span>
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Log Health Condition</span>
          
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Condition Descriptor *</label>
              <input value={formData.problem} onChange={(e) => setFormData({ ...formData, problem: e.target.value })} placeholder="e.g., Hypertension" className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">ICD-10 Code</label>
              <input value={formData.icd10Code} onChange={(e) => setFormData({ ...formData, icd10Code: e.target.value })} placeholder="e.g., I10" className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Severity Grading</label>
              <select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value as typeof problemSeverities[number] })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]">
                <option value="mild">MILD</option><option value="moderate">MODERATE</option><option value="severe">SEVERE</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Clinical Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] min-h-[60px]" />
            </div>
          </div>
          
          <button onClick={handleAddProblem} disabled={!formData.problem} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs disabled:opacity-30">
            Save condition
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold">TOTAL LOGGED</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{userProblems.length}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-red-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-red-500 uppercase font-bold flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> ACTIVE</div>
          <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{activeProblems.length}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> RESOLVED</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{resolvedProblems.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'resolved'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
              statusFilter === status
                ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-bold'
                : 'bg-[#090D14] border-[#252A35] text-slate-400 hover:text-white'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono flex flex-col items-center gap-2">
          <Inbox className="w-6 h-6" />
          <span>NO CONDITIONS MATCH CRITERIA</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((problem) => (
            <div key={problem.id} className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 border rounded-[2px] mt-0.5 ${
                  problem.severity === 'severe' ? 'bg-red-950/40 border-red-600/60 text-red-400'
                  : problem.severity === 'moderate' ? 'bg-amber-950/40 border-amber-600/60 text-amber-400'
                  : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400'
                }`}>
                  {problem.severity === 'severe' ? <AlertCircle className="w-4 h-4" /> : problem.severity === 'moderate' ? <Heart className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2] text-xs">{problem.problem}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {problem.icd10Code && <span className="text-[10px] bg-[#151922] border border-[#2F3542] px-1 rounded text-cyan-400 font-mono">ICD-10: {problem.icd10Code}</span>}
                    <span className="text-[10px] text-slate-500 uppercase">{problem.severity} SEVERITY</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">LOGGED: {problem.dateIdentified}</div>
                  {problem.notes && <div className="text-[10px] text-slate-400 mt-1.5 p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] leading-relaxed">{problem.notes}</div>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded-[2px] ${
                  problem.status === 'active' ? 'bg-amber-950/40 border-amber-600/60 text-amber-400' : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400'
                }`}>
                  {problem.status}
                </span>
                {problem.status === 'active' ? (
                  <button onClick={() => handleResolveProblem(problem.id)} className="px-2 py-1 bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-[10px] font-bold rounded-[2px] uppercase hover:bg-emerald-900 transition-colors flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> RESOLVE
                  </button>
                ) : (
                  <button onClick={() => handleReactivateProblem(problem.id)} className="px-2 py-1 bg-[#151922] border border-[#2F3542] text-slate-300 text-[10px] font-bold rounded-[2px] uppercase hover:bg-slate-800 transition-colors flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> REACTIVATE
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

export default PatientProblemListPage;
