import { useMemo, useState } from 'react';
import { CheckCircle, AlertCircle, FileText, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import type { PatientConsent } from '@/data/mockData';

const CONSENT_TYPES = ['hipaa', 'research', 'treatment', 'medication', 'procedure'] as const;

const PatientConsentPage = () => {
  const { user } = useAuth();
  const { patientConsents, addPatientConsent, updatePatientConsent } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    consentType: 'hipaa' as typeof CONSENT_TYPES[number], consentText: '',
  });

  const userConsents = useMemo(() => patientConsents.filter((c) => c.patientId === user?.id), [patientConsents, user?.id]);
  const activeConsents = useMemo(() => userConsents.filter((c) => c.status === 'active'), [userConsents]);
  const revokedConsents = useMemo(() => userConsents.filter((c) => c.status === 'revoked'), [userConsents]);

  const handleAddConsent = () => {
    if (!formData.consentType) return;
    const newConsent: PatientConsent = {
      id: `consent-${Date.now()}`, patientId: user?.id ?? '', consentType: formData.consentType,
      consentedDate: new Date().toISOString().split('T')[0], status: 'active', consentText: formData.consentText || undefined,
    };
    addPatientConsent(newConsent);
    setFormData({ consentType: 'hipaa', consentText: '' });
    setShowForm(false);
  };

  const handleRevokeConsent = (id: string) => {
    updatePatientConsent(id, (consent) => ({
      ...consent, status: 'revoked', revokedDate: new Date().toISOString().split('T')[0], revokedReason: 'Patient revoked consent',
    }));
  };

  const getConsentDescription = (type: typeof CONSENT_TYPES[number]) => {
    const descriptions: Record<typeof CONSENT_TYPES[number], string> = {
      hipaa: 'Authorization for healthcare providers to access and share my medical information',
      research: 'Permission to use my health data for approved medical research',
      treatment: 'Consent for medical treatment and procedures',
      medication: 'Authorization to prescribe medications',
      procedure: 'Consent for specific medical procedures',
    };
    return descriptions[type];
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Consent & Privacy Authorization</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Manage patient healthcare authorizations, data sharing permissions, and HIPAA compliance.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'CANCEL' : 'PROVIDE CONSENT'}</span>
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Provide Healthcare Consent</span>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Authorization Scope</label>
              <select
                value={formData.consentType}
                onChange={(e) => setFormData({ ...formData, consentType: e.target.value as typeof CONSENT_TYPES[number] })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] text-xs uppercase"
              >
                {CONSENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type} CONSENT</option>
                ))}
              </select>
              <div className="text-[10px] text-slate-500 mt-1 uppercase">{getConsentDescription(formData.consentType)}</div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Additional Conditions/Limitations</label>
              <textarea
                value={formData.consentText}
                onChange={(e) => setFormData({ ...formData, consentText: e.target.value })}
                placeholder="Optional conditions for this authorization..."
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] text-xs min-h-[60px]"
              />
            </div>
          </div>
          
          <button onClick={handleAddConsent} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs">
            AUTHORIZE CONSENT
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> ACTIVE AUTHORIZATIONS</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{activeConsents.length}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-red-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-red-500 uppercase font-bold flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> REVOKED</div>
          <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{revokedConsents.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        {activeConsents.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-emerald-400 uppercase block mb-2">ACTIVE CONSENTS</span>
            {activeConsents.map((consent) => (
              <div key={consent.id} className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-[#ECEEF2] text-xs uppercase flex items-center gap-2">
                    {consent.consentType} CONSENT
                    <span className="px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-600/60 text-emerald-400 text-[9px] rounded uppercase">ACTIVE</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase leading-relaxed">{getConsentDescription(consent.consentType as typeof CONSENT_TYPES[number])}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">AUTHORIZED: {consent.consentedDate}</div>
                  {consent.consentText && <div className="mt-1.5 p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-[10px] text-slate-400">{consent.consentText}</div>}
                </div>
                <button
                  onClick={() => handleRevokeConsent(consent.id)}
                  className="px-2 py-1 bg-red-950/60 border border-red-600/60 text-red-400 text-[10px] font-bold rounded-[2px] uppercase hover:bg-red-900 transition-colors shrink-0"
                >
                  REVOKE
                </button>
              </div>
            ))}
          </div>
        )}

        {revokedConsents.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-red-400 uppercase block mb-2 mt-4">REVOKED CONSENTS</span>
            {revokedConsents.map((consent) => (
              <div key={consent.id} className="p-3 bg-[#090D14] border border-[#252A35] opacity-60 rounded-[2px]">
                <div className="font-bold text-slate-400 text-xs uppercase flex items-center gap-2">
                  {consent.consentType} CONSENT
                  <span className="px-1.5 py-0.5 bg-red-950/60 border border-red-600/60 text-red-400 text-[9px] rounded uppercase">REVOKED</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase">REVOKED ON: {consent.revokedDate} {consent.revokedReason && `// ${consent.revokedReason}`}</div>
              </div>
            ))}
          </div>
        )}

        {activeConsents.length === 0 && revokedConsents.length === 0 && (
          <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
            NO CONSENT RECORDS LOCATED
          </div>
        )}
      </div>

      {/* Notice */}
      <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 rounded-[2px] text-[10px] text-cyan-500/80 uppercase leading-relaxed flex gap-2">
        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">HIPAA COMPLIANCE NOTICE</span>
          Patients possess rights to access medical records, limit disclosures, and revoke authorization except for actions already executed.
        </div>
      </div>
    </div>
  );
};

export default PatientConsentPage;
