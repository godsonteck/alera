import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersPage from '@/pages/features/UsersPage';

const mocks = vi.hoisted(() => ({
  listAllUsersMock: vi.fn(),
  registerMock: vi.fn(),
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
      listAllUsers: mocks.listAllUsersMock,
      reactivateUser: vi.fn(),
      deactivateUser: vi.fn(),
    },
  },
  authApi: {
    register: mocks.registerMock,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: { children?: React.ReactNode }) => <button {...props}>{children}</button>,
    tr: ({ children, ...props }: { children?: React.ReactNode }) => <tr {...props}>{children}</tr>,
  },
}));

describe('UsersPage verification status', () => {
  beforeEach(() => {
    mocks.listAllUsersMock.mockReset();
    mocks.registerMock.mockReset();
  });

  it('shows Verified for active verified users', async () => {
    mocks.listAllUsersMock.mockResolvedValueOnce([
      {
        id: 1,
        email: 'doctor@example.com',
        username: 'doctor',
        first_name: 'Doc',
        last_name: 'Tor',
        role: 'provider',
        is_active: true,
        is_verified: true,
        created_at: '2026-04-04T12:00:00Z',
        last_login: '2026-04-04T12:30:00Z',
      },
    ]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UsersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/doc tor/i)).toBeInTheDocument();
    expect(screen.getByTestId('user-verification-status-1')).toHaveTextContent(/^Verified$/i);
  });
});
