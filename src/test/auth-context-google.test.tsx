import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/useAuth';

const { getCurrentUserMock, getAccessibleUsersMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getAccessibleUsersMock: vi.fn(),
}));

vi.mock('@/lib/storageKeys', () => ({
  clearAleraStorage: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  clearTokens: vi.fn(),
  setGlobalLogoutCallback: vi.fn(),
}));

vi.mock('@/lib/apiService', () => ({
  accountLinksApi: {
    create: vi.fn(),
  },
  authApi: {
    getCurrentUser: getCurrentUserMock,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    registerWithGoogle: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    resendVerificationEmail: vi.fn(),
  },
  usersApi: {
    getAccessibleUsers: getAccessibleUsersMock,
  },
}));

const Probe = () => {
  const { isLoading, loginWithGoogle, registerWithGoogle } = useAuth();

  if (isLoading) {
    return <div>loading</div>;
  }

  return (
    <div>
      loginWithGoogle:{typeof loginWithGoogle}
      registerWithGoogle:{typeof registerWithGoogle}
    </div>
  );
};

describe('AuthProvider Google auth wiring', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getAccessibleUsersMock.mockReset();
    getCurrentUserMock.mockRejectedValue(new Error('unauthenticated'));
    getAccessibleUsersMock.mockResolvedValue([]);
  });

  it('exposes registerWithGoogle after auth initialization completes', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/loginWithGoogle:function/i)).toBeInTheDocument();
      expect(screen.getByText(/registerWithGoogle:function/i)).toBeInTheDocument();
    });
  });
});
