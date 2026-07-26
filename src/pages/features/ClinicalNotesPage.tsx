import { useState, useMemo } from 'react';
import { Stethoscope, Plus, X, Eye, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import type { ClinicalNote } from '@/data/mockData';

const noteTypes = ['visit', 'consultation', 'follow-up', 'procedure'] as const;

const ClinicalNotesPage = () => {
  const { user } = useAuth();
  const { clinicalNotes, addClinicalNote, updateClinicalNote } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    type: 'visit' as typeof noteTypes[number],
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const userNotes = useMemo(
    () => user?.role === 'doctor'
      ? clinicalNotes.filter((note) => note.doctorId === user?.id)
      : clinicalNotes.filter((note) => note.patientId === user?.id),
    [clinicalNotes, user?.id, user?.role]
  );

  const sortedNotes = useMemo(
    () => [...userNotes].sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()),
    [userNotes]
  );

  const handleAddNote = () => {
    if (!formData.subjective || !formData.objective || !formData.assessment || !formData.plan) return;

    const newNote: ClinicalNote = {
      id: `note-${Date.now()}`,
      patientId: formData.patientId,
      doctorId: user?.id || '',
      doctorName: user?.name || '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }),
      type: formData.type,
      subjective: formData.subjective,
      objective: formData.objective,
      assessment: formData.assessment,
      plan: formData.plan,
      status: 'draft',
    };

    addClinicalNote(newNote);
    setFormData({ patientId: '', type: 'visit', subjective: '', objective: '', assessment: '', plan: '' });
    setShowForm(false);
  };

  const handleSignNote = (id: string) => {
    updateClinicalNote(id, (note) => ({ ...note, status: 'signed' }));
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">SOAP Clinical Documentation Node</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
              {sortedNotes.length} NOTES
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Structured SOAP encounter documentation, clinical impressions, and care plan authoring.
          </p>
        </div>

        {user?.role === 'doctor' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'CANCEL' : 'AUTHOR SOAP NOTE'}</span>
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && user?.role === 'doctor' && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">New SOAP Encounter Note</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Note Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof noteTypes[number] })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                {noteTypes.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
            <div key={field}>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                {field === 'subjective' ? 'S — Subjective (Chief Complaints)' :
                 field === 'objective' ? 'O — Objective (Exam & Findings)' :
                 field === 'assessment' ? 'A — Assessment (Diagnosis)' :
                 'P — Plan (Treatment & Next Steps)'}
              </label>
              <textarea
                value={formData[field]}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                placeholder={`Enter ${field} data...`}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-xs text-[#ECEEF2] min-h-[60px]"
              />
            </div>
          ))}

          <button
            onClick={handleAddNote}
            disabled={!formData.subjective || !formData.objective || !formData.assessment || !formData.plan}
            className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs disabled:opacity-30"
          >
            COMMIT SOAP NOTE AS DRAFT
          </button>
        </div>
      )}

      {/* Selected Note Detail View */}
      {selectedNote && (
        <div className="p-4 bg-[#090D14] border border-cyan-500/40 rounded-[4px] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-300 uppercase">SOAP Note Detail</span>
              <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                selectedNote.status === 'signed' ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                : selectedNote.status === 'completed' ? 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300'
                : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
              }`}>
                {selectedNote.status}
              </span>
            </div>
            <button onClick={() => setSelectedNote(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="text-[10px] text-slate-500">
            {selectedNote.doctorName} • {selectedNote.date} at {selectedNote.time}
          </div>

          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
            <div key={field} className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
              <span className="text-[9px] font-bold text-cyan-400 uppercase block mb-0.5">
                {field.charAt(0).toUpperCase()}. {field}
              </span>
              <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{selectedNote[field]}</p>
            </div>
          ))}

          {user?.role === 'doctor' && selectedNote.doctorId === user?.id && selectedNote.status !== 'signed' && (
            <button
              onClick={() => handleSignNote(selectedNote.id)}
              className="w-full bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-bold py-2 rounded-[2px] text-xs uppercase"
            >
              SIGN & LOCK NOTE
            </button>
          )}
        </div>
      )}

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No SOAP encounter notes recorded.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] hover:border-cyan-500/50 cursor-pointer flex items-start justify-between gap-3 text-xs transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 mt-0.5">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2] flex items-center gap-2">
                    <span>{note.type.charAt(0).toUpperCase() + note.type.slice(1)} Encounter</span>
                    <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                      note.status === 'signed' ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                      : note.status === 'completed' ? 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300'
                      : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                    }`}>
                      {note.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{note.doctorName} • {note.date} at {note.time}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{note.subjective}</div>
                </div>
              </div>
              <Eye className="w-4 h-4 text-cyan-400 shrink-0 mt-1" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClinicalNotesPage;
