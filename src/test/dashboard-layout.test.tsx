import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLayout from '@/components/DashboardLayout';

const logoutMock = vi.fn();
const resendEmailVerificationMock = vi.fn();

let authState: {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'doctor' | 'admin';
    isVerified: boolean;
    emailVerified: boolean;
  } | null;
  logout: typeof logoutMock;
  resendEmailVerification: typeof resendEmailVerificationMock;
};

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: 0,
    feedLabel: 'Realtime feed',
    isLive: false,
  }),
}));

vi.mock('@/components/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center" />,
}));

vi.mock('@/components/ChatWidget', () => ({
  default: () => <div data-testid="chat-widget" />,
}));

describe('DashboardLayout', () => {
  beforeEach(() => {
    authState = {
      user: {
        id: 'doctor-1',
        email: 'doctor@example.com',
        name: 'Dr. Alice',
        role: 'doctor',
        isVerified: false,
        emailVerified: false,
      },
      logout: logoutMock,
      resendEmailVerification: resendEmailVerificationMock,
    };
    logoutMock.mockReset();
    resendEmailVerificationMock.mockReset();
  });

  it('shows the pending verification banner for unverified professionals', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Dashboard content</div>
        </DashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByText(/verification unresolved/i)).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-professional-verification')).toHaveTextContent(/pending verification/i);
    expect(screen.getByText(/dashboard content/i)).toBeInTheDocument();
  });

  it('does not show the email verification banner for admin users', () => {
    authState.user = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Alera Admin',
      role: 'admin',
      isVerified: true,
      emailVerified: false,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Dashboard content</div>
        </DashboardLayout>
      </MemoryRouter>
    );

    expect(screen.queryByText(/verification unresolved/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-issue/i })).not.toBeInTheDocument();
    expect(screen.getByText(/dashboard content/i)).toBeInTheDocument();
  });

  it('shows verified status for verified professionals', () => {
    authState.user = {
      id: 'doctor-verified',
      email: 'doctor@example.com',
      name: 'Dr. Alice',
      role: 'doctor',
      isVerified: true,
      emailVerified: true,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Dashboard content</div>
        </DashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('sidebar-professional-verification')).toHaveTextContent(/^Verified$/i);
    expect(screen.queryByText(/pending verification/i)).not.toBeInTheDocument();
  });
});
