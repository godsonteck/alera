import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Users, Heart, FlaskConical, ScanLine, Pill, Ambulance, Building2, ShieldCheck, Eye, EyeOff, Upload, Bell, Lock, AlertCircle, Check, Mail, Key, Terminal } from 'lucide-react';
import {
  getProfessionalVerificationStatus,
  getVerificationStatusLabel,
} from '@/lib/verificationStatus';

const roleIcons: Record<string, React.ReactNode> = {
  patient: <Users className="w-4 h-4" />,
  doctor: <Heart className="w-4 h-4" />,
  hospital: <Building2 className="w-4 h-4" />,
  laboratory: <FlaskConical className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />,
  pharmacy: <Pill className="w-4 h-4" />,
  ambulance: <Ambulance className="w-4 h-4" />,
  physiotherapist: <Heart className="w-4 h-4" />,
  admin: <ShieldCheck className="w-4 h-4" />,
  super_admin: <ShieldCheck className="w-4 h-4" />,
};

const roleLabels: Record<string, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  hospital: 'Hospital',
  laboratory: 'Laboratory',
  imaging: 'Imaging',
  pharmacy: 'Pharmacy',
  ambulance: 'Ambulance',
  physiotherapist: 'Physiotherapist',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const profileTabs = [
  { id: 'basic', label: 'Basic Info', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'contact', label: 'Coordinates', icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'security', label: 'Security Key', icon: <Lock className="w-3.5 h-3.5" /> },
  { id: 'notifications', label: 'Alert Signals', icon: <Bell className="w-3.5 h-3.5" /> },
  { id: 'privacy', label: 'Enclave Privacy', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
] as const;

const ProfilePage = () => {
  const { user, updateProfile, updateBasicInfo, changePassword, updateNotificationPreferences, updatePrivacySettings, resendEmailVerification } = useAuth();
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'security' | 'notifications' | 'privacy'>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const profile = user?.profile;
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '');

  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [zipCode, setZipCode] = useState(profile?.zipCode || '');
  const [bio, setBio] = useState(profile?.bio || '');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [notifEmail, setNotifEmail] = useState(profile?.notificationEmail ?? true);
  const [notifSms, setNotifSms] = useState(profile?.notificationSms ?? false);
  const [publicProfile, setPublicProfile] = useState(profile?.privacyPublicProfile ?? false);

  if (!user) return null;

  const professionalVerificationStatus = getProfessionalVerificationStatus(user.isVerified, user.isActive ?? true);
  const isEmailUnverified = user.role !== 'admin' && user.emailVerified === false;

  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateBasicInfo({ firstName, lastName, avatar });
      setSuccess('Profile identity updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateProfile({ phone, address, city, state, zipCode, bio });
      setSuccess('Contact coordinates updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess('Password security key mutated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password mutation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[2px] bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
              {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : roleIcons[user.role]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#ECEEF2]">{user.name}</span>
                <span className="text-[10px] bg-[#151922] border border-[#2F3542] px-1.5 py-0.2 rounded text-cyan-300">
                  {roleLabels[user.role]}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-[2px] border text-[10px] font-bold uppercase ${
              professionalVerificationStatus === 'verified'
                ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
            }`}>
              {getVerificationStatusLabel(professionalVerificationStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
              activeTab === tab.id
                ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Alert Notices */}
      {error && <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300">[ERROR] {error}</div>}
      {success && <div className="p-3 bg-emerald-950/40 border border-emerald-600/60 rounded-[2px] text-xs text-emerald-300">[SUCCESS] {success}</div>}

      {/* Basic Tab */}
      {activeTab === 'basic' && (
        <form onSubmit={handleBasicSubmit} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3 text-xs">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Basic Identity Parameters</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-[#151922] border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px]">
            {isLoading ? 'SAVING...' : 'UPDATE IDENTITY'}
          </button>
        </form>
      )}

      {/* Contact Tab */}
      {activeTab === 'contact' && (
        <form onSubmit={handleContactSubmit} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3 text-xs">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Physical & Network Coordinates</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Phone Number</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Street Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">State / Zip</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-[#151922] border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px]">
            {isLoading ? 'SAVING...' : 'UPDATE COORDINATES'}
          </button>
        </form>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <form onSubmit={handlePasswordSubmit} className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3 text-xs">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Password Key Mutation</span>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Current Password Key</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" required />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">New Password Key</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" required />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Confirm New Password Key</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" required />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-[#151922] border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px]">
            {isLoading ? 'MUTATING KEY...' : 'MUTATE PASSWORD KEY'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ProfilePage;
