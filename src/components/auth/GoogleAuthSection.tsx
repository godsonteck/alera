import { GoogleLogin } from '@react-oauth/google';
import { Globe, ShieldCheck } from 'lucide-react';

type GoogleAuthSectionProps = {
  mode: 'signin' | 'signup';
  disabled?: boolean;
  isAvailable: boolean;
  onSuccess: (credential: string) => Promise<void> | void;
  onError: () => void;
};

const copy = {
  signin: {
    badge: 'Faster access',
    title: 'Continue with Google',
    description: 'Use your Google account to sign in securely without typing your password.',
    divider: 'Or continue with email',
    buttonText: 'signin_with' as const,
  },
  signup: {
    badge: 'Social sign-up',
    title: 'Create your account with Google',
    description: 'Start with Google, then finish the role details Alera needs for your account.',
    divider: 'Or create your account with email',
    buttonText: 'signup_with' as const,
  },
};

export const GoogleAuthSection = ({
  mode,
  disabled = false,
  isAvailable,
  onSuccess,
  onError,
}: GoogleAuthSectionProps) => {
  const content = copy[mode];

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {content.badge}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">{content.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{content.description}</p>
          </div>
        </div>

        <div className="mt-5">
          {isAvailable ? (
            <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                    void onSuccess(credentialResponse.credential);
                  } else {
                    onError();
                  }
                }}
                onError={onError}
                theme="outline"
                size="large"
                text={content.buttonText}
                shape="pill"
                width="100%"
                useOneTap={mode === 'signin'}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Google sign-{mode === 'signin' ? 'in' : 'up'} is unavailable until `VITE_GOOGLE_CLIENT_ID` is configured.
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-sm font-medium">
          <span className="bg-white px-4 text-slate-500">{content.divider}</span>
        </div>
      </div>
    </div>
  );
};
