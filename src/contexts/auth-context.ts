import { createContext } from 'react';
import type { User, UserProfile, UserRole, SignupRole } from './AuthContext';
import type { ApiAuthResponse } from '@/lib/apiService';

export type GoogleSignupData = NonNullable<ApiAuthResponse['google_data']>;
export type AppleSignupData = NonNullable<ApiAuthResponse['apple_data']>;

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<{ needsRegistration?: boolean; googleData?: GoogleSignupData }>;
  loginWithApple: (credential: string, firstName?: string, lastName?: string) => Promise<{ needsRegistration?: boolean; appleData?: AppleSignupData }>;
  registerWithGoogle: (
    credential: string,
    role: SignupRole,
    licenseNumber?: string,
    licenseState?: string,
    specialty?: string,
    phone?: string,
    address?: string,
    city?: string,
    state?: string,
    zipCode?: string,
  ) => Promise<void>;
  registerWithApple: (
    credential: string,
    role: SignupRole,
    firstName?: string,
    lastName?: string,
    licenseNumber?: string,
    licenseState?: string,
    specialty?: string,
    phone?: string,
  ) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    role: SignupRole,
    licenseNumber?: string,
    licenseState?: string,
    specialty?: string,
    phone?: string,
    address?: string,
    city?: string,
    state?: string,
    zipCode?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  addUser: (name: string, email: string, password: string, role: SignupRole) => Promise<User>;
  getUsers: () => User[];
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updateBasicInfo: (firstName: string, lastName: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  updateNotificationPreferences: (email: boolean, sms: boolean) => Promise<void>;
  updatePrivacySettings: (publicProfile: boolean) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  linkAccount: (currentPassword: string, linkedEmail: string, linkedPassword: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  clearCache: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
