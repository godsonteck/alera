import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, ArrowLeft, ArrowRight, Mail, Lock, Terminal } from 'lucide-react';
import { authApi } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email coordinates are required.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await authApi.requestPasswordReset(email.trim());
      setMessage('If a clinical account exists for that email, a cryptographic recovery token has been dispatched.');
    } catch (err) {
      setError(handleApiError(err, 'send the reset email'));
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
                <div className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-cyan-500/40 bg-cyan-950/30 text-cyan-400">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest text-[#ECEEF2] uppercase font-mono">ALERA CNOS</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Clinical Neural Operating System</p>
                </div>
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors border border-[#252A35] bg-[#0F1218] px-2.5 py-1 rounded-[2px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Auth</span>
              </Link>
            </div>

            <div className="mt-12 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-[2px] border border-[#252A35] bg-[#0F1218] px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                <Lock className="w-3 h-3 text-cyan-400" />
                <span>CREDENTIAL RECOVERY PROTOCOL</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#ECEEF2]">
                Reset Clinical Node Key
              </h1>

              <p className="text-xs leading-relaxed text-slate-400 max-w-md">
                Dispatches a single-use cryptographic recovery token to restore node session access without exposing account presence.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-[10px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>SHA-256 RECOVERY ENCLAVE</span>
            </div>
            <span>PROTOCOL V1.0.1</span>
          </div>
        </section>

        {/* Right Side Form Card */}
        <section className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-6 sm:p-8 space-y-6 shadow-2xl">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 block">KEY RECOVERY</span>
            <h2 className="text-lg font-bold text-[#ECEEF2] mt-0.5">Request Token Dispatch</h2>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300 font-mono">
              [RECOVERY ERROR] {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-600/60 rounded-[2px] text-xs text-emerald-300 font-mono">
              [DISPATCH CONFIRMED] {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                Email Coordinates
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="clinician@hospital.org"
                  className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] px-3 py-2 pl-9 text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
                  required
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2.5 rounded-[2px] transition-colors flex items-center justify-center gap-2 uppercase tracking-wider text-xs"
            >
              {loading ? (
                <span>DISPATCHING RECOVERY TOKEN...</span>
              ) : (
                <>
                  <span>DISPATCH RECOVERY TOKEN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#252A35] flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Remembered Key?</span>
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-bold uppercase">
              Authenticate Session $\rightarrow$
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ForgotPassword;
