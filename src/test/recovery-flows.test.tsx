import { AxiosError } from 'axios';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';

const { requestPasswordResetMock, resetPasswordMock, verifyEmailMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
  resetPasswordMock: vi.fn(),
  verifyEmailMock: vi.fn(),
}));

vi.mock('@/lib/apiService', () => ({
  authApi: {
    requestPasswordReset: requestPasswordResetMock,
    resetPassword: resetPasswordMock,
    verifyEmail: verifyEmailMock,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('Recovery flows', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset().mockResolvedValue({ message: 'sent' });
    resetPasswordMock.mockReset().mockResolvedValue({ message: 'ok' });
    verifyEmailMock.mockReset().mockResolvedValue({ message: 'ok' });
  });

  it('submits the forgot-password request', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/doctor@hospital\.org/i), { target: { value: 'patient@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith('patient@example.com');
    });

    expect(await screen.findByText(/if that account exists/i)).toBeInTheDocument();
  });

  it('submits a reset-password token exchange', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=reset-token-123']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith('reset-token-123', 'newpassword123', 'newpassword123');
    });

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it('verifies an email token on load', async () => {
    render(
      <MemoryRouter initialEntries={['/verify-email?token=verify-token-123']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(verifyEmailMock).toHaveBeenCalledWith('verify-token-123');
    });

    expect(await screen.findByText(/your email has been verified/i)).toBeInTheDocument();
  });
});
