import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { authApi } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This reset link is missing its security token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('This reset link is missing its security token.');
      return;
    }
    if (!password || !confirmPassword) {
      setError('All credential fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await authApi.resetPassword(token, password, confirmPassword);
      setMessage('Password updated. Redirecting you to sign in...');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setError(handleApiError(err, 'reset the password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="alera-dark-backdrop min-h-screen text-[#ECEEF2] flex flex-col font-mono">
      <div className="mx-auto grid min-h-screen max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_1fr] lg:px-8 lg:items-center">
        {/* Left Side Signpost */}
        <section className="flex flex-col justify-between h-full py-6 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <img src="/sad.jpg" alt="Alera logo" className="h-9 w-9 rounded-[2px] border border-cyan-500/40 bg-white/70 object-cover shadow-[0_2px_10px_rgba(0,0,0,0.18)]" />
                <div>
                  <p className="text-xs font-bold tracking-widest text-[#ECEEF2] uppercase font-mono">ALERA</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Account recovery</p>
                </div>
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors border border-[#252A35] bg-[#0F1218] px-2.5 py-1 rounded-[2px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to sign in</span>
              </Link>
            </div>

            <div className="mt-12 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-[2px] border border-[#252A35] bg-[#0F1218] px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                <Lock className="w-3 h-3 text-cyan-400" />
                <span>Secure password update</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#ECEEF2]">
                Set a new password
              </h1>

              <p className="text-xs leading-relaxed text-slate-400 max-w-md">
                Choose a fresh password to secure your account and get back to your care dashboard.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-[10px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Your password will be updated securely.</span>
            </div>
          </div>
        </section>

        {/* Right Side Form Card */}
        <section className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-6 sm:p-8 space-y-6 shadow-2xl">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 block">PASSWORD UPDATE</span>
            <h2 className="text-lg font-bold text-[#ECEEF2] mt-0.5">Create a new password</h2>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300 font-mono">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-600/60 rounded-[2px] text-xs text-emerald-300 font-mono">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] px-3 py-2 text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] px-3 py-2 text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2.5 rounded-[2px] transition-colors flex items-center justify-center gap-2 uppercase tracking-wider text-xs"
            >
              {loading ? (
                <span>Updating password...</span>
              ) : (
                <>
                  <span>Update password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#252A35] flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Ready to sign in?</span>
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-bold uppercase">
              Sign in $
ightarrow$
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ResetPassword;
