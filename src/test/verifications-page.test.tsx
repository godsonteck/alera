import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerificationsPage from '@/pages/features/VerificationsPage';

const mocks = vi.hoisted(() => ({
  listVerificationsMock: vi.fn(),
  verifyProviderMock: vi.fn(),
  rejectProviderMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Alera Admin',
      role: 'admin',
      isVerified: true,
      emailVerified: true,
    },
  }),
}));

vi.mock('@/lib/apiService', () => ({
  api: {
    admin: {
      listVerifications: mocks.listVerificationsMock,
      verifyProvider: mocks.verifyProviderMock,
      approveProvider: mocks.verifyProviderMock,
      rejectProvider: mocks.rejectProviderMock,
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('VerificationsPage', () => {
  beforeEach(() => {
    mocks.listVerificationsMock.mockReset();
    mocks.verifyProviderMock.mockReset();
    mocks.rejectProviderMock.mockReset();
    mocks.toastMock.mockReset();
  });

  it('shows Verified after a pending provider is verified', async () => {
    const pendingProvider = {
      id: 1,
      email: 'pharmacy@example.com',
      username: 'pharmacy-user',
      first_name: 'Pharmacy',
      last_name: 'User',
      role: 'pharmacist',
      is_active: true,
      is_verified: false,
      created_at: '2026-04-04T12:00:00Z',
      license_number: 'PH-123',
      license_state: 'GA',
      bio: 'Pharmacy team member',
    };

    const verifiedProvider = {
      ...pendingProvider,
      is_verified: true,
    };

    mocks.listVerificationsMock
      .mockResolvedValueOnce([pendingProvider])
      .mockResolvedValueOnce([verifiedProvider]);
    mocks.verifyProviderMock.mockResolvedValueOnce({ message: 'Provider verified successfully' });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VerificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/pharmacy user/i)).toBeInTheDocument();
    expect(screen.getByTestId('verification-status-1')).toHaveTextContent(/pending verification/i);

    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => expect(mocks.verifyProviderMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(mocks.listVerificationsMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('verification-status-1')).toHaveTextContent(/^Verified$/i));
  });
});
