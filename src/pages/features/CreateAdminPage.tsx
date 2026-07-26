import { useState } from 'react';
import { ShieldCheck, User, Mail, Lock, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

const CreateAdminPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'admin' as 'admin' | 'super_admin',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.username || !formData.password || !formData.first_name || !formData.last_name) {
      setError('All required fields must be filled');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await api.admin.createAdmin(formData);
      setSuccess(true);
      setFormData({ email: '', username: '', password: '', first_name: '', last_name: '', phone: '', role: 'admin' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-8 bg-[#090D14] border border-red-600/60 rounded-[4px] text-center font-mono text-xs text-red-400 space-y-2">
        <ShieldCheck className="w-8 h-8 mx-auto text-red-500" />
        <div className="font-bold uppercase">ACCESS DENIED</div>
        <p className="text-slate-500">Only Supreme Cockpit nodes may provision admin credentials.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-red-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Admin Credential Provisioning</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">Create new admin or super admin accounts with elevated system access.</p>
      </div>

      {error && <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300">[ERROR] {error}</div>}
      {success && <div className="p-3 bg-emerald-950/40 border border-emerald-600/60 rounded-[2px] text-xs text-emerald-300">[SUCCESS] Admin account provisioned successfully.</div>}

      <form onSubmit={handleSubmit} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
        <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Credential Parameters</span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { label: 'First Name', key: 'first_name', type: 'text', placeholder: 'First Name', required: true },
            { label: 'Last Name', key: 'last_name', type: 'text', placeholder: 'Last Name', required: true },
            { label: 'Email Address', key: 'email', type: 'email', placeholder: 'admin@facility.com', required: true },
            { label: 'Username', key: 'username', type: 'text', placeholder: 'admin_username', required: true },
            { label: 'Password Key', key: 'password', type: 'password', placeholder: 'Min 8 characters', required: true },
            { label: 'Phone Number', key: 'phone', type: 'tel', placeholder: '+1 (555) 123-4567', required: false },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">{field.label} {field.required && '*'}</label>
              <input
                type={field.type}
                value={(formData as Record<string, string>)[field.key]}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[10px] text-slate-400 uppercase block mb-1">Role Privilege Level *</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'super_admin' })}
            className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] text-xs"
          >
            <option value="admin">Admin (Limited Management)</option>
            <option value="super_admin">Super Admin (Full System Control)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#151922] hover:bg-slate-800 border border-red-500/60 text-red-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {isLoading ? <><Loader className="w-3.5 h-3.5 animate-spin" /> PROVISIONING...</> : <><ShieldCheck className="w-3.5 h-3.5" /> PROVISION ADMIN CREDENTIAL</>}
        </button>
      </form>
    </div>
  );
};

export default CreateAdminPage;