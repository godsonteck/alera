import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { ArrowRight, Eye, EyeOff, HeartPulse } from 'lucide-react';
import { handleApiError } from '@/lib/errorHandler';
import { GoogleAuthSection } from '@/components/auth/GoogleAuthSection';
import { AppleAuthButton } from '@/components/auth/AppleAuthButton';
import { frontendEnv } from '@/config/env';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const googleAuthAvailable = Boolean(frontendEnv.googleClientId);
  const appleAuthAvailable = frontendEnv.enableAppleSignIn && Boolean(frontendEnv.appleClientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'sign in'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async (credential: string, firstName?: string, lastName?: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await loginWithApple(credential, firstName, lastName);
      if (result?.needsRegistration) {
        navigate('/signup', {
          state: {
            isAppleSignup: true,
            appleData: { ...result.appleData, credential },
          },
        });
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Apple sign in'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (credential: string) => {
    setLoading(true);
    setError('');

    try {
      const result = await loginWithGoogle(credential);
      if (result?.needsRegistration) {
        navigate('/signup', {
          state: {
            isGoogleSignup: true,
            googleData: {
              ...result.googleData,
              credential,
            },
          },
        });
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Google sign in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="alera-navy-backdrop relative min-h-screen overflow-hidden text-[#223127]">

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-white/25 bg-[color:var(--surface-elevated)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)] sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/sad.jpg" alt="Alera logo" className="h-9 w-9 rounded-md border border-white/10 bg-white/70 object-cover shadow-[0_2px_10px_rgba(0,0,0,0.15)]" />
            <div>
              <p className="text-sm font-semibold text-[#223127]">Alera</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6e7d71]">Sign in</p>
            </div>
          </Link>
          <Link to="/" className="text-sm text-[#4a785c] hover:text-[#3a624d]">
            Back
          </Link>
        </div>

        <section className="border-t border-slate-200 pt-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[#223127]">Sign in</h2>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {googleAuthAvailable && (
            <div className="mb-6">
              <GoogleAuthSection
                mode="signin"
                disabled={loading}
                isAvailable={googleAuthAvailable}
                onSuccess={handleGoogleSignIn}
                onError={() => setError('Google sign in failed. Please try again.')}
              />
            </div>
          )}
          {appleAuthAvailable && (
            <div className="mb-6">
              <AppleAuthButton
                clientId={frontendEnv.appleClientId}
                disabled={loading}
                onSuccess={handleAppleSignIn}
                onError={() => setError('Apple sign in failed. Please try again.')}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#34463d]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-[#dfe8e0] bg-[#f8fcf8] px-3 py-2.5 text-[#223127] outline-none transition focus:border-[#4a785c]"
                required
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-[#34463d]">Password</label>
                <Link to="/forgot-password" className="text-sm text-[#4a785c] hover:text-[#3a624d]">
                  Forgot password
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0b3d62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#082f4c]"
            >
              {loading ? (
                'Signing in…'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[#e7efe9] pt-4 text-sm text-[#4f6154]">
            <span>New here?</span>
            <Link to="/signup" className="font-semibold text-[#4a785c] hover:text-[#3a624d]">
              Sign up
            </Link>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
};

export default Login;
