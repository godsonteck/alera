import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/pages/features/ProfilePage';

const deleteAccountMock = vi.fn();
const clearCacheMock = vi.fn();
const updateProfileMock = vi.fn();
const updateBasicInfoMock = vi.fn();
const changePasswordMock = vi.fn();
const updateNotificationPreferencesMock = vi.fn();
const updatePrivacySettingsMock = vi.fn();

let authState: {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'doctor';
    isVerified: boolean;
    profile: {
      firstName: string;
      lastName: string;
      notificationEmail: boolean;
      notificationSms: boolean;
      privacyPublicProfile: boolean;
    };
  } | null;
  updateProfile: typeof updateProfileMock;
  updateBasicInfo: typeof updateBasicInfoMock;
  changePassword: typeof changePasswordMock;
  updateNotificationPreferences: typeof updateNotificationPreferencesMock;
  updatePrivacySettings: typeof updatePrivacySettingsMock;
  deleteAccount: typeof deleteAccountMock;
  clearCache: typeof clearCacheMock;
};

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('ProfilePage delete flow', () => {
  beforeEach(() => {
    authState = {
      user: {
        id: 'doctor-1',
        email: 'doctor@example.com',
        name: 'Dr. Alice',
        role: 'doctor',
        isVerified: false,
        profile: {
          firstName: 'Dr',
          lastName: 'Alice',
          notificationEmail: true,
          notificationSms: false,
          privacyPublicProfile: false,
        },
      },
      updateProfile: updateProfileMock,
      updateBasicInfo: updateBasicInfoMock,
      changePassword: changePasswordMock,
      updateNotificationPreferences: updateNotificationPreferencesMock,
      updatePrivacySettings: updatePrivacySettingsMock,
      deleteAccount: deleteAccountMock,
      clearCache: clearCacheMock,
    };

    deleteAccountMock.mockReset().mockResolvedValue(undefined);
    clearCacheMock.mockReset();
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    updateBasicInfoMock.mockReset().mockResolvedValue(undefined);
    changePasswordMock.mockReset().mockResolvedValue(undefined);
    updateNotificationPreferencesMock.mockReset().mockResolvedValue(undefined);
    updatePrivacySettingsMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls deleteAccount after confirmation and shows success feedback', async () => {
    vi.useFakeTimers();

    render(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /account/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /permanently delete/i }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(deleteAccountMock).toHaveBeenCalledWith('password123');
    expect(screen.getByText(/account deleted successfully/i)).toBeInTheDocument();
  });
});

