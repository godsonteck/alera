import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/pages/features/ProfilePage';

const deleteAccountMock = vi.fn();
const clearCacheMock = vi.fn();
const updateProfileMock = vi.fn();
const updateBasicInfoMock = vi.fn();
const changePasswordMock = vi.fn();
const updateNotificationPreferencesMock = vi.fn();
const updatePrivacySettingsMock = vi.fn();
const resendEmailVerificationMock = vi.fn();

let authState: {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'doctor';
    isVerified: boolean;
    emailVerified: boolean;
    isActive: boolean;
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
  resendEmailVerification: typeof resendEmailVerificationMock;
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

describe('ProfilePage verification state', () => {
  beforeEach(() => {
    authState = {
      user: {
        id: 'doctor-1',
        email: 'doctor@example.com',
        name: 'Dr. Alice',
        role: 'doctor',
        isVerified: true,
        emailVerified: false,
        isActive: true,
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
      resendEmailVerification: resendEmailVerificationMock,
      clearCache: clearCacheMock,
    };

    deleteAccountMock.mockReset().mockResolvedValue(undefined);
    clearCacheMock.mockReset();
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    updateBasicInfoMock.mockReset().mockResolvedValue(undefined);
    changePasswordMock.mockReset().mockResolvedValue(undefined);
    updateNotificationPreferencesMock.mockReset().mockResolvedValue(undefined);
    updatePrivacySettingsMock.mockReset().mockResolvedValue(undefined);
    resendEmailVerificationMock.mockReset().mockResolvedValue(undefined);
  });

  it('shows the professional verification state as Verified', () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole('button', { name: /account/i }));

    expect(screen.getByTestId('professional-verification-status')).toHaveTextContent(/^Verified$/i);
    expect(screen.getByText(/professional verification/i)).toBeInTheDocument();
  });
});
