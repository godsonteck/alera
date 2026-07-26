import { Apple } from 'lucide-react';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (options: Record<string, unknown>) => void;
        signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
      };
    };
  }
}

type AppleAuthButtonProps = {
  clientId: string;
  disabled?: boolean;
  onSuccess: (credential: string, firstName?: string, lastName?: string) => Promise<void> | void;
  onError: () => void;
};

export const AppleAuthButton = ({ clientId, disabled = false, onSuccess, onError }: AppleAuthButtonProps) => {
  const [ready, setReady] = useState(Boolean(window.AppleID));

  useEffect(() => {
    if (window.AppleID) return;
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = onError;
    document.head.appendChild(script);
    return () => script.remove();
  }, [onError]);

  const signIn = async () => {
    try {
      if (!window.AppleID) throw new Error('Apple Sign In is unavailable');
      window.AppleID.auth.init({ clientId, scope: 'name email', redirectURI: window.location.origin, usePopup: true });
      const response = await window.AppleID.auth.signIn();
      const name = response.user?.name;
      await onSuccess(response.authorization.id_token, name?.firstName, name?.lastName);
    } catch {
      onError();
    }
  };

  if (!clientId) return null;
  return (
    <button
      type="button"
      onClick={() => void signIn()}
      disabled={disabled || !ready}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Apple className="h-4 w-4" />
      {ready ? 'Continue with Apple' : 'Loading Apple Sign In…'}
    </button>
  );
};
