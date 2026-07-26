import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Signup from '@/pages/Signup';

const signupMock = vi.fn();
const loginWithGoogleMock = vi.fn();
const registerWithGoogleMock = vi.fn();

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    signup: signupMock,
    loginWithGoogle: loginWithGoogleMock,
    registerWithGoogle: registerWithGoogleMock,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('Signup page', () => {
  beforeEach(() => {
    signupMock.mockReset();
    signupMock.mockResolvedValue(undefined);
    loginWithGoogleMock.mockReset();
    registerWithGoogleMock.mockReset();
  });

  it('shows professional license fields and excludes admin signup', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Signup />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));

    expect(screen.getByText('License details')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/license or registration number/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/state or jurisdiction/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/optional specialty or department/i)).toBeInTheDocument();
  });
});
