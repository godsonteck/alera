import { useState, type ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import {
  Activity,
  Ambulance,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  FlaskConical,
  Heart,
  HeartPulse,
  Pill,
  ScanLine,
  User,
} from 'lucide-react';
import { handleApiError } from '@/lib/errorHandler';
import { GoogleAuthSection } from '@/components/auth/GoogleAuthSection';
import { AppleAuthButton } from '@/components/auth/AppleAuthButton';
import { frontendEnv } from '@/config/env';
import type { AppleSignupData, GoogleSignupData } from '@/contexts/auth-context';

type SignupRole =
  | 'patient'
  | 'doctor'
  | 'hospital'
  | 'laboratory'
  | 'imaging'
  | 'pharmacy'
  | 'ambulance'
  | 'physiotherapist';

const roles: { value: SignupRole; label: string; icon: ReactNode; desc: string }[] = [
  { value: 'patient', label: 'Patient', icon: <User className="h-4 w-4" />, desc: 'Access records and care updates.' },
  { value: 'doctor', label: 'Doctor', icon: <Heart className="h-4 w-4" />, desc: 'Coordinate care and review plans.' },
  { value: 'physiotherapist', label: 'Physiotherapist', icon: <Activity className="h-4 w-4" />, desc: 'Track therapy progress and schedules.' },
  { value: 'hospital', label: 'Hospital', icon: <Building2 className="h-4 w-4" />, desc: 'Support referrals and intake workflows.' },
  { value: 'laboratory', label: 'Laboratory', icon: <FlaskConical className="h-4 w-4" />, desc: 'Manage results and diagnostic requests.' },
  { value: 'imaging', label: 'Imaging Center', icon: <ScanLine className="h-4 w-4" />, desc: 'Share imaging updates and bookings.' },
  { value: 'pharmacy', label: 'Pharmacy', icon: <Pill className="h-4 w-4" />, desc: 'Review prescriptions and inventory.' },
  { value: 'ambulance', label: 'Ambulance', icon: <Ambulance className="h-4 w-4" />, desc: 'Coordinate dispatch and support.' },
];

const providerRoles = new Set<SignupRole>([
  'doctor',
  'hospital',
  'laboratory',
  'imaging',
  'pharmacy',
  'ambulance',
  'physiotherapist',
]);

const roleRequirements: Record<SignupRole, { detail: string; requirements: string }> = {
  patient: { detail: 'Keep your appointments, results, prescriptions, messages, and care updates in one place.', requirements: 'Your name, email, and phone number for important updates. No professional review is needed.' },
  doctor: { detail: 'Support patients, review care information, and work with other teams involved in care.', requirements: 'Your professional licence or registration details and specialty. Full clinical access is reviewed.' },
  physiotherapist: { detail: 'Track therapy, recovery, appointments, referrals, and progress for your patients.', requirements: 'Your professional licence or registration details and specialty. Full clinical access is reviewed.' },
  hospital: { detail: 'Coordinate intake, referrals, appointments, teams, and patient movement through care.', requirements: 'Organisation registration details and a responsible contact. Access is reviewed before activation.' },
  laboratory: { detail: 'Receive diagnostic requests, publish results, and keep the next care step clear.', requirements: 'Laboratory registration details and a responsible contact. Access is reviewed before activation.' },
  imaging: { detail: 'Manage imaging requests, bookings, reports, and secure handoffs.', requirements: 'Imaging-centre registration details and a responsible contact. Access is reviewed before activation.' },
  pharmacy: { detail: 'Manage prescriptions, refills, inventory, and patient support.', requirements: 'Pharmacy registration details and a responsible contact. Access is reviewed before activation.' },
  ambulance: { detail: 'Coordinate dispatch details, service status, and urgent care handoffs.', requirements: 'Service registration details and a responsible contact. Access is reviewed before activation.' },
};

const Signup = () => {
  const location = useLocation();
  const locationState = location.state as { isGoogleSignup?: boolean; googleData?: GoogleSignupData; isAppleSignup?: boolean; appleData?: AppleSignupData } | null;
  const isGoogleSignupMode = locationState?.isGoogleSignup || false;
  const googleData = locationState?.googleData;
  const appleData = locationState?.appleData;

  const [name, setName] = useState(googleData ? `${googleData.first_name} ${googleData.last_name}` : appleData ? `${appleData.first_name} ${appleData.last_name}` : '');
  const [email, setEmail] = useState(googleData?.email || appleData?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SignupRole | null>(null);
  const [previewRole, setPreviewRole] = useState<SignupRole | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleSignup, setIsGoogleSignup] = useState(isGoogleSignupMode);
  const [googleCredential, setGoogleCredential] = useState(googleData?.credential || '');
  const [isAppleSignup, setIsAppleSignup] = useState(locationState?.isAppleSignup || false);
  const [appleCredential, setAppleCredential] = useState(appleData?.credential || '');

  const { signup, loginWithGoogle, registerWithGoogle, loginWithApple, registerWithApple } = useAuth();
  const navigate = useNavigate();
  const googleAuthAvailable = Boolean(frontendEnv.googleClientId);
  const appleAuthAvailable = frontendEnv.enableAppleSignIn && Boolean(frontendEnv.appleClientId);
  const isProviderRole = selectedRole ? providerRoles.has(selectedRole) : false;
  const displayedRole = previewRole ?? selectedRole;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }

    if (!isGoogleSignup && !isAppleSignup && !password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isAppleSignup) {
        const [firstName = '', ...lastNameParts] = name.trim().split(' ');
        await registerWithApple(appleCredential, selectedRole, firstName, lastNameParts.join(' '), licenseNumber.trim() || undefined, licenseState.trim() || undefined, specialty.trim() || undefined, phone.trim() || undefined);
      } else if (isGoogleSignup) {
        await registerWithGoogle(
          googleCredential,
          selectedRole,
          isProviderRole ? licenseNumber.trim() || undefined : undefined,
          isProviderRole ? licenseState.trim() || undefined : undefined,
          isProviderRole ? specialty.trim() || undefined : undefined,
          phone.trim() || undefined,
        );
      } else {
        await signup(
          name.trim(),
          email.trim(),
          password,
          selectedRole,
          isProviderRole ? licenseNumber.trim() || undefined : undefined,
          isProviderRole ? licenseState.trim() || undefined : undefined,
          isProviderRole ? specialty.trim() || undefined : undefined,
          phone.trim() || undefined,
        );
      }

      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'registration'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignupStart = async (credential: string, firstName?: string, lastName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithApple(credential, firstName, lastName);
      if (result?.needsRegistration && result.appleData) {
        setIsAppleSignup(true);
        setAppleCredential(credential);
        setEmail(result.appleData.email);
        setName(`${result.appleData.first_name} ${result.appleData.last_name}`.trim());
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(handleApiError(err, 'Apple verification'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignupStart = async (credential: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await loginWithGoogle(credential);
      if (result?.needsRegistration && result.googleData) {
        setIsGoogleSignup(true);
        setGoogleCredential(credential);
        setEmail(result.googleData.email);
        setName(`${result.googleData.first_name} ${result.googleData.last_name}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(handleApiError(err, 'Google verification'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="alera-navy-backdrop relative min-h-screen overflow-hidden text-[#223127]">

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl rounded-3xl border border-white/25 bg-[color:var(--surface-elevated)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)] sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/sad.jpg" alt="Alera logo" className="h-9 w-9 rounded-md border border-white/10 bg-white/70 object-cover shadow-[0_2px_10px_rgba(0,0,0,0.15)]" />
            <div>
              <p className="text-sm font-semibold text-[#223127]">Alera</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6e7d71]">Sign up</p>
            </div>
          </Link>
          <Link to="/" className="text-sm text-[#4a785c] hover:text-[#3a624d]">Back</Link>
        </div>

        <section className="border-t border-slate-200 pt-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[#223127]">
              {isGoogleSignup || isAppleSignup ? 'Complete setup' : 'Create account'}
            </h2>
            {(isGoogleSignup || isAppleSignup) && <p className="mt-2 text-sm leading-6 text-[#4f6154]">Your sign-in is connected. Choose a role so we can prepare the right account for you.</p>}
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isGoogleSignup && !isAppleSignup && (
            <div className="mb-6">
              <GoogleAuthSection
                mode="signup"
                disabled={loading}
                isAvailable={googleAuthAvailable}
                onSuccess={handleGoogleSignupStart}
                onError={() => setError('Google sign up failed. Please try again.')}
              />
              {appleAuthAvailable && (
                <div className="mt-3">
                  <AppleAuthButton clientId={frontendEnv.appleClientId} disabled={loading} onSuccess={handleAppleSignupStart} onError={() => setError('Apple sign up failed. Please try again.')} />
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#34463d]">Select your role</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {roles.map((role) => (
                  <button
                    type="button"
                    key={role.value}
                    onClick={() => { setSelectedRole(role.value); setPreviewRole(role.value); }}
                    onMouseEnter={() => setPreviewRole(role.value)}
                    onFocus={() => setPreviewRole(role.value)}
                    onMouseLeave={() => setPreviewRole(selectedRole)}
                    className={`alera-focus-ring flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                      selectedRole === role.value
                        ? 'border-[#4a785c] bg-[#f4faf4] text-[#223127] shadow-[0_8px_24px_rgba(75,116,93,0.16)]'
                        : 'border-[#dfe8e0] bg-white text-[#4f6154] hover:border-[#c3d7c8] hover:bg-[#f8fcf8]'
                    }`}
                  >
                    <div className="mt-0.5 rounded-xl bg-[#f8fcf8] p-2 text-[#4a785c]">{role.icon}</div>
                    <div>
                      <div className="font-semibold text-[#223127]">{role.label}</div>
                      <div className="mt-1 text-xs leading-5 text-[#6e7d71]">{role.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 min-h-[124px] rounded-2xl border border-[#dce7df] bg-[#f6fafc] px-4 py-4 text-sm text-[#405467] shadow-sm" aria-live="polite">
                {displayedRole ? (
                  <>
                    <p className="font-semibold text-[#223127]">{roles.find((role) => role.value === displayedRole)?.label}</p>
                    <p className="mt-1 leading-6">{roleRequirements[displayedRole].detail}</p>
                    <p className="mt-2 text-xs leading-5"><span className="font-semibold text-[#223127]">What you may need:</span> {roleRequirements[displayedRole].requirements}</p>
                  </>
                ) : <p className="leading-6">Hover over a role or select one to see what it is for and what you may need to provide.</p>}
              </div>
            </div>

            {selectedRole && selectedRole !== 'patient' && (
              <div className="rounded-2xl border border-[#e7efe9] bg-[#f8fcf8] p-4 text-sm text-[#4f6154]">
                Provider accounts may require a short verification step before full access is granted.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-[#4f6154]">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  disabled={isGoogleSignup}
                  className="w-full rounded-2xl border border-[#dfe8e0] bg-[#f8fcf8] px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4f6154]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vance@icu.org"
                  disabled={isGoogleSignup}
                  className="w-full rounded-2xl border border-[#dfe8e0] bg-[#f8fcf8] px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4f6154]">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2831"
                  className="w-full rounded-2xl border border-[#dfe8e0] bg-[#f8fcf8] px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                />
              </div>

              {!isGoogleSignup && !isAppleSignup && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-[#4f6154]">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-2xl border border-[#dfe8e0] bg-[#f8fcf8] px-3 py-2.5 pr-10 text-[#223127] outline-none transition focus:border-[#4a785c]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7d71]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedRole && selectedRole !== 'patient' && (
              <div className="rounded-2xl border border-[#e7efe9] bg-[#f8fcf8] p-4">
                <p className="mb-3 text-sm font-semibold text-[#223127]">License details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#4f6154]">License number</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="License or registration number"
                      className="w-full rounded-2xl border border-[#dfe8e0] bg-white px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#4f6154]">State or jurisdiction</label>
                    <input
                      type="text"
                      value={licenseState}
                      onChange={(e) => setLicenseState(e.target.value)}
                      placeholder="State or jurisdiction"
                      className="w-full rounded-2xl border border-[#dfe8e0] bg-white px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-[#4f6154]">Specialty</label>
                    <input
                      type="text"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="Optional specialty or department"
                      className="w-full rounded-2xl border border-[#dfe8e0] bg-white px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0b3d62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#082f4c]"
            >
              {loading ? (
                'Creating account…'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Create account</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[#e7efe9] pt-4 text-sm text-[#4f6154]">
            <span>Already have an account?</span>
            <Link to="/login" className="font-semibold text-[#4a785c] hover:text-[#3a624d]">
              Sign in
            </Link>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
};

export default Signup;
