import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/pages/features/ProfilePage';

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

describe('ProfilePage security flow', () => {
  beforeEach(() => {
    authState = {
      user: {
        id: 'doctor-1',
        email: 'doctor@example.com',
        name: 'Dr. Alice',
        role: 'doctor',
        isVerified: true,
        emailVerified: true,
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
      resendEmailVerification: resendEmailVerificationMock,
      clearCache: clearCacheMock,
    };

    clearCacheMock.mockReset();
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    updateBasicInfoMock.mockReset().mockResolvedValue(undefined);
    changePasswordMock.mockReset().mockResolvedValue(undefined);
    updateNotificationPreferencesMock.mockReset().mockResolvedValue(undefined);
    updatePrivacySettingsMock.mockReset().mockResolvedValue(undefined);
    resendEmailVerificationMock.mockReset().mockResolvedValue(undefined);
  });

  it('calls changePassword and shows success feedback after form submission', async () => {
    render(<ProfilePage />);

    // Navigate to Security Key tab
    fireEvent.click(screen.getByRole('button', { name: /security key/i }));

    // Password inputs are type="password" — query them directly via DOM
    const allInputs = document.querySelectorAll('input[type="password"]');
    expect(allInputs.length).toBeGreaterThanOrEqual(3);

    fireEvent.change(allInputs[0], { target: { value: 'oldpass123' } });
    fireEvent.change(allInputs[1], { target: { value: 'newpass123' } });
    fireEvent.change(allInputs[2], { target: { value: 'newpass123' } });

    fireEvent.click(screen.getByRole('button', { name: /mutate password key/i }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith('oldpass123', 'newpass123');
    });

    expect(await screen.findByText(/password security key mutated successfully/i)).toBeInTheDocument();
  });
});
