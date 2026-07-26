import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '@/pages/Login';

const loginMock = vi.fn();
const loginWithGoogleMock = vi.fn();

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    login: loginMock,
    loginWithGoogle: loginWithGoogleMock,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('Login page', () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginWithGoogleMock.mockReset();
  });

  it('surfaces backend authorization detail in the login error message', async () => {
    const response: AxiosResponse<{ detail: string }> = {
      status: 403,
      data: { detail: 'Your account is pending verification' },
      statusText: 'Forbidden',
      headers: {},
      config: { headers: {} },
    } as unknown as AxiosResponse<{ detail: string }>;

    loginMock.mockRejectedValueOnce(
      new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', undefined, undefined, response)
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), { target: { value: 'doctor@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/your account is pending verification/i)).toBeInTheDocument();
  });
});
