import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HeartPulse, ArrowLeft, CheckCircle2, Mail, Loader2, Lock, Terminal } from 'lucide-react';
import { authApi } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setMessage('This verification link is missing its cryptographic token.');
        return;
      }

      try {
        await authApi.verifyEmail(token);
        if (!cancelled) {
          setStatus('success');
          setMessage('Email coordinates verified. Clinical enclave access is fully authorized.');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(handleApiError(error, 'verify the email address'));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
                <span>COORDINATE VERIFICATION PROTOCOL</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#ECEEF2]">
                Verify Email Coordinates
              </h1>

              <p className="text-xs leading-relaxed text-slate-400 max-w-md">
                Verifies patient or clinician node email coordinates to confirm cryptographic authorization and enable secure data enclaves.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-[10px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>COORDINATE AUDIT ACTIVE</span>
            </div>
            <span>PROTOCOL V1.0.1</span>
          </div>
        </section>

        {/* Right Side Form Card */}
        <section className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-6 sm:p-8 space-y-6 shadow-2xl">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 block">IDENTITY VALIDATION</span>
            <h2 className="text-lg font-bold text-[#ECEEF2] mt-0.5">Verification Status</h2>
          </div>

          {status === 'loading' && (
            <div className="p-4 rounded-[2px] border border-cyan-500/40 bg-cyan-950/20 text-xs text-cyan-300 flex items-center gap-3 font-mono">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
              <span>Verifying cryptographic token coordinates...</span>
            </div>
          )}

          {status !== 'loading' && (
            <div className={`p-4 rounded-[2px] border text-xs flex items-start gap-3 font-mono ${
              status === 'success' ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-red-500/40 bg-red-950/20 text-red-300'
            }`}>
              {status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Mail className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{message}</span>
            </div>
          )}

          <div className="pt-4 border-t border-[#252A35] flex items-center justify-between text-[11px] font-mono">
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-bold uppercase">
              Authenticate Session $\rightarrow$
            </Link>
            <Link to="/dashboard" className="text-slate-400 hover:text-[#ECEEF2] uppercase">
              Launch Workspace
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default VerifyEmail;
