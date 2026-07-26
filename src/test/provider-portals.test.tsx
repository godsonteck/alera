import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DashboardLayout from '@/components/DashboardLayout';
import { canAccessFeature } from '@/lib/featureAccess';

const logoutMock = vi.fn();
const resendEmailVerificationMock = vi.fn();

let authUser: {
  id: string;
  email: string;
  name: string;
  role: 'hospital' | 'laboratory' | 'imaging' | 'pharmacy' | 'doctor' | 'physiotherapist';
  isVerified: boolean;
  emailVerified: boolean;
} | null = null;

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    logout: logoutMock,
    resendEmailVerification: resendEmailVerificationMock,
  }),
}));

vi.mock('@/contexts/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: 0,
    feedLabel: 'Realtime feed',
    isLive: true,
  }),
}));

vi.mock('@/components/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center" />,
}));

vi.mock('@/components/ChatWidget', () => ({
  default: () => <div data-testid="chat-widget" />,
}));

describe('provider portals', () => {
  it.each([
    ['doctor'],
    ['hospital'],
    ['laboratory'],
    ['imaging'],
    ['pharmacy'],
    ['physiotherapist'],
  ] as const)('shows secure messaging entry for %s portal', (role) => {
    authUser = {
      id: `${role}-1`,
      email: `${role}@example.com`,
      name: `${role} user`,
      role,
      isVerified: true,
      emailVerified: true,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Portal content</div>
        </DashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /messages|secure terminal|message box/i })).toBeInTheDocument();
  });

  it('allows operational roles to access messaging routes', () => {
    expect(canAccessFeature('messages', 'doctor')).toBe(true);
    expect(canAccessFeature('messages', 'hospital')).toBe(true);
    expect(canAccessFeature('messages', 'laboratory')).toBe(true);
    expect(canAccessFeature('messages', 'imaging')).toBe(true);
    expect(canAccessFeature('messages', 'pharmacy')).toBe(true);
    expect(canAccessFeature('messages', 'physiotherapist')).toBe(true);
    expect(canAccessFeature('messages', 'patient')).toBe(true);
    expect(canAccessFeature('messages', 'admin')).toBe(false);
  });
});
