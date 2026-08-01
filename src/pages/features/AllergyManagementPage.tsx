import { useState, useMemo } from 'react';
import { AlertTriangle, Plus, X, CheckCircle, Pill, Heart, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { getDoctorPatients } from '@/lib/patientDirectory';
import { normalizeUserRole } from '@/lib/roleUtils';
import type { PatientAllergy } from '@/data/mockData';

const ALLERGY_TYPES = ['medication', 'food', 'environmental', 'latex', 'other'] as const;
const SEVERITY_LEVELS = ['mild', 'moderate', 'severe', 'life-threatening'] as const;

type AllergyType = typeof ALLERGY_TYPES[number];
type SeverityLevel = typeof SEVERITY_LEVELS[number];

const isAllergyType = (value: unknown): value is AllergyType => {
  return ALLERGY_TYPES.includes(value as AllergyType);
};

const isSeverityLevel = (value: unknown): value is SeverityLevel => {
  return SEVERITY_LEVELS.includes(value as SeverityLevel)
};

const severityColor = (severity: string) => {
  switch (severity) {
    case 'mild': return 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300';
    case 'moderate': return 'bg-amber-950/50 border-amber-600/60 text-amber-300';
    case 'severe': return 'bg-orange-950/50 border-orange-600/60 text-orange-300';
    case 'life-threatening': return 'bg-red-950/50 border-red-600/60 text-red-300';
    default: return 'bg-[#151922] border-[#2F3542] text-slate-400';
  }
};

const AllergyManagementPage = () => {
  const { user, getUsers } = useAuth();
  const { patientAllergies, prescriptions, appointments, addAllergy, removeAllergy, checkDrugInteractions } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;
  const patientOptions = useMemo(
    () => getDoctorPatients(getUsers(), appointments, user?.id),
    [appointments, getUsers, user?.id],
  );

  const [formData, setFormData] = useState<{
    patientId: string;
    allergen: string;
    allergyType: AllergyType;
    severity: SeverityLevel;
    reaction: string;
    notes: string;
  }>({
    patientId: '',
    allergen: '',
    allergyType: 'medication',
    severity: 'moderate',
    reaction: '',
    notes: '',
  });

  const userAllergies = useMemo(() => {
    if (effectiveRole === 'patient') {
      return patientAllergies.filter((allergy) => allergy.patientId === user?.id && allergy.status === 'active');
    }
    if (effectiveRole === 'doctor') {
      return patientAllergies.filter((allergy) => allergy.status === 'active');
    }
    return [];
  }, [patientAllergies, user?.id, effectiveRole]);

  const currentMedications = useMemo(() => {
    return prescriptions
      .filter((p) => p.patientId === user?.id && p.status === 'active')
      .flatMap((p) => p.medications.map((m) => m.name));
  }, [prescriptions, user?.id]);

  const medicationAlergiesAndInteractions = useMemo(() => {
    const medicationAllergies = userAllergies.filter((a) => a.allergyType === 'medication');
    const interactions = checkDrugInteractions(currentMedications);

    return {
      medicationAllergies,
      interactions: interactions.filter((int) => {
        const allergens = medicationAllergies.map((a) => a.allergen.toLowerCase());
        return (
          allergens.includes(int.drug1.toLowerCase()) || allergens.includes(int.drug2.toLowerCase())
        );
      }),
    };
  }, [userAllergies, currentMedications, checkDrugInteractions]);

  const handleAddAllergy = () => {
    if (!formData.allergen || !formData.reaction) return;
    if (effectiveRole === 'doctor' && !formData.patientId) return;

    const targetPatientId = effectiveRole === 'doctor' ? formData.patientId : (user?.id || '');

    const newAllergy: PatientAllergy = {
      id: `allergy-${Date.now()}`,
      patientId: targetPatientId,
      allergen: formData.allergen,
      allergyType: formData.allergyType,
      severity: formData.severity,
      reaction: formData.reaction,
      dateIdentified: new Date().toISOString().split('T')[0],
      addedDate: new Date().toISOString().split('T')[0],
      status: 'active',
      notes: formData.notes || undefined,
    };

    addAllergy(newAllergy);
    setFormData({
      patientId: '',
      allergen: '',
      allergyType: 'medication',
      severity: 'moderate',
      reaction: '',
      notes: '',
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Immunological Sensitivity Registry</span>
            <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-1.5 py-0.2 rounded font-mono">
              {userAllergies.length} ACTIVE ENTRIES
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Document allergen sensitivities, cross-reference pharmacogenomic interactions, and maintain safety profiles.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-red-500/60 text-red-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'CANCEL' : 'REGISTER ALLERGEN'}</span>
        </button>
      </div>

      {/* Add Allergy Form */}
      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
            Register New Allergen Sensitivity
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {effectiveRole === 'doctor' && (
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Patient</label>
                <select
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                >
                  <option value="">Select Patient</option>
                  {patientOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Allergen Name</label>
              <input
                type="text"
                value={formData.allergen}
                onChange={(e) => setFormData({ ...formData, allergen: e.target.value })}
                placeholder="e.g. Penicillin, Shellfish"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Allergen Type</label>
              <select
                value={formData.allergyType}
                onChange={(e) => {
                  if (isAllergyType(e.target.value)) setFormData({ ...formData, allergyType: e.target.value });
                }}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                {ALLERGY_TYPES.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Severity Level</label>
              <select
                value={formData.severity}
                onChange={(e) => {
                  if (isSeverityLevel(e.target.value)) setFormData({ ...formData, severity: e.target.value });
                }}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                {SEVERITY_LEVELS.map((level) => (
                  <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Reaction Description</label>
              <input
                type="text"
                value={formData.reaction}
                onChange={(e) => setFormData({ ...formData, reaction: e.target.value })}
                placeholder="e.g. Anaphylaxis, Rash"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
          </div>

          <button
            onClick={handleAddAllergy}
            disabled={!formData.allergen || !formData.reaction || (effectiveRole === 'doctor' && !formData.patientId)}
            className="w-full bg-[#151922] hover:bg-slate-800 border border-red-500/60 text-red-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs disabled:opacity-30"
          >
            Save allergy
          </button>
        </div>
      )}

      {/* Drug Interaction Warnings */}
      {medicationAlergiesAndInteractions.interactions.length > 0 && (
        <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-400 uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>PHARMACOGENOMIC INTERACTION ALERT DETECTED</span>
          </div>
          {medicationAlergiesAndInteractions.interactions.map((interaction) => (
            <div key={interaction.id} className="p-2 bg-[#150C0C] border border-red-900/60 rounded-[2px]">
              <div className="font-bold text-white">{interaction.drug1} + {interaction.drug2}</div>
              <div className="text-[10px] text-red-300 mt-0.5">{interaction.description}</div>
              <div className="text-[10px] text-red-400 mt-0.5 font-bold">Management: {interaction.management}</div>
            </div>
          ))}
        </div>
      )}

      {/* Allergy Records */}
      {userAllergies.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No allergen sensitivities registered in active immunological profile.
        </div>
      ) : (
        <div className="space-y-2">
          {userAllergies.map((allergy) => (
            <div
              key={allergy.id}
              className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-red-400 mt-0.5">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2] flex items-center gap-2">
                    <span>{allergy.allergen}</span>
                    <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${severityColor(allergy.severity)}`}>
                      {allergy.severity}
                    </span>
                    <span className="text-[9px] bg-[#151922] border border-[#2F3542] px-1.5 py-0.2 rounded text-slate-400 uppercase">
                      {allergy.allergyType}
                    </span>
                  </div>
                  {effectiveRole === 'doctor' && allergy.patientName && (
                    <div className="text-[10px] text-cyan-400 mt-0.5">Patient: {allergy.patientName}</div>
                  )}
                  <div className="text-[11px] text-slate-400 mt-0.5">Reaction: {allergy.reaction}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Identified: {allergy.dateIdentified}</div>
                </div>
              </div>

              <button
                onClick={() => removeAllergy(allergy.id)}
                className="p-1 bg-red-950/40 border border-red-900/60 text-red-400 hover:text-red-200 rounded-[2px] shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Current Medications Check */}
      {currentMedications.length > 0 && (
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Medication Cross-Reference</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {currentMedications.map((med, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-xs">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>{med}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllergyManagementPage;
