import React, { useState, useCallback, useEffect } from 'react';
import { clearAleraStorage } from '@/lib/storageKeys';
import { AuthContext } from './auth-context';
import { accountLinksApi, authApi, usersApi, type ApiLinkedAccountSummary, type ApiUser } from '@/lib/apiService';
import { clearTokens, setGlobalLogoutCallback } from '@/lib/apiClient';
import { normalizeUserRole } from '@/lib/roleUtils';

export type UserRole =
  | 'patient'
  | 'doctor'
  | 'hospital'
  | 'laboratory'
  | 'imaging'
  | 'pharmacy'
  | 'ambulance'
  | 'physiotherapist'
  | 'admin'
  | 'super_admin';

export type SignupRole = Exclude<UserRole, 'admin' | 'super_admin'>;
export type AuthRegisterRole = 'patient' | 'provider' | 'pharmacist' | 'hospital' | 'laboratory' | 'imaging' | 'ambulance' | 'physiotherapist';

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  dateOfBirth?: string;
  bio?: string;
  avatar?: string;
  postdicomApiUrl?: string;
  notificationEmail: boolean;
  notificationSms: boolean;
  privacyPublicProfile: boolean;
}

export interface LinkedAccountSummary {
  id: string;
  role: UserRole;
  maskedEmail?: string;
  createdAt?: string | null;
  linkType?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isVerified?: boolean;
  isActive?: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  avatar?: string;
  profile?: UserProfile;
  postdicomApiUrl?: string;
  createdAt?: string;
  lastLogin?: string;
  hasLinkedAccount?: boolean;
  linkedAccounts?: LinkedAccountSummary[];
}

const isApiUser = (data: unknown): data is ApiUser => {
  return typeof data === 'object' && data !== null && 'id' in data && 'email' in data;
};

const ACCESSIBLE_USERS_PAGE_SIZE = 100;

type BackendRole = ApiUser['role'];

const mapBackendRoleToUserRole = (role: BackendRole | string): UserRole => {
  return normalizeUserRole(role) ?? 'patient';
};

const mapLinkedAccount = (data: ApiLinkedAccountSummary): LinkedAccountSummary => ({
  id: String(data.id),
  role: mapBackendRoleToUserRole(data.role),
  maskedEmail: data.masked_email ?? undefined,
  createdAt: data.created_at ?? null,
  linkType: data.link_type ?? 'same_person',
});

// Map backend user roles to frontend format
const mapBackendUser = (data: ApiUser): User => {
  const fullName = data.full_name?.trim() || [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  const [firstName = '', ...lastNameParts] = fullName.split(' ');
  return {
    id: String(data.id),
    email: data.email,
    name: fullName || data.email,
    role: mapBackendRoleToUserRole(data.role),
    isVerified: Boolean(data.is_verified),
    isActive: data.is_active ?? true,
    emailVerified: data.email_verified ?? false,
    emailVerifiedAt: data.email_verified_at ?? null,
    avatar: data.avatar || data.profile_image_url,
    postdicomApiUrl: data.postdicom_api_url,
    createdAt: data.created_at,
    lastLogin: data.last_login,
    hasLinkedAccount: data.has_linked_account ?? false,
    linkedAccounts: (data.linked_accounts || []).map(mapLinkedAccount),
    profile: {
      firstName,
      lastName: lastNameParts.join(' '),
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      dateOfBirth: data.date_of_birth,
      bio: data.bio,
      avatar: data.avatar || data.profile_image_url,
      notificationEmail: data.notification_email ?? true,
      notificationSms: data.notification_sms ?? false,
      privacyPublicProfile: data.privacy_public_profile ?? false,
    }
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Set global logout callback for apiClient
  useEffect(() => {
    setGlobalLogoutCallback(() => {
      setUser(null);
      setUsers([]);
    });
  }, []);

  const loadAccessibleUsers = useCallback(async () => {
    try {
      const response = await usersApi.getAccessibleUsers(0, ACCESSIBLE_USERS_PAGE_SIZE);
      const mapped = Array.isArray(response) ? response.filter(isApiUser).map(mapBackendUser) : [];
      setUsers(mapped);
      return mapped;
    } catch (error) {
      console.error('Failed to load accessible users:', error);
      setUsers([]);
      return [];
    }
  }, []);

  // Initialize auth state - cookies are sent automatically with requests
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Try to fetch current user - cookies will be sent automatically
        const userData = await authApi.getCurrentUser();
        if (!isMounted) return;
        if (isApiUser(userData)) {
          setUser(mapBackendUser(userData));
        } else {
          setUser(null);
        }
      } catch (error) {
        // If we can't get current user, user is not authenticated
        if (!isMounted) return;
        setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    // Backend now sets cookies automatically, no tokens in response
    if (!isApiUser(response.user)) {
      throw new Error('Login response did not include a valid user');
    }
    setUser(mapBackendUser(response.user));
    void loadAccessibleUsers();
  }, [loadAccessibleUsers]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const response = await authApi.loginWithGoogle(credential);
    if (response.needs_registration) {
      return { needsRegistration: true, googleData: response.google_data };
    }
    if (!isApiUser(response.user)) {
      throw new Error('Login response did not include a valid user');
    }
    setUser(mapBackendUser(response.user));
    void loadAccessibleUsers();
    return {};
  }, [loadAccessibleUsers]);

  const loginWithApple = useCallback(async (credential: string, firstName?: string, lastName?: string) => {
    const response = await authApi.loginWithApple(credential, firstName, lastName);
    if (response.needs_registration) {
      return { needsRegistration: true, appleData: response.apple_data };
    }
    if (!isApiUser(response.user)) {
      throw new Error('Login response did not include a valid user');
    }
    setUser(mapBackendUser(response.user));
    void loadAccessibleUsers();
    return {};
  }, [loadAccessibleUsers]);

  const signup = useCallback(async (
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
  ) => {
    const [firstName = '', ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || 'User';

    // Map frontend roles to backend roles
    const roleMap: Record<SignupRole, AuthRegisterRole> = {
      patient: 'patient',
      doctor: 'provider',
      hospital: 'hospital',
      laboratory: 'laboratory',
      imaging: 'imaging',
      pharmacy: 'pharmacist',
      ambulance: 'ambulance',
      physiotherapist: 'physiotherapist',
    };
    const backendRole = roleMap[role] || 'patient';

    // Generate username from email (remove domain)
    const username = email.split('@')[0] || name.toLowerCase().replace(/\s+/g, '.');

    const response = await authApi.register({
      email,
      password,
      username,
      first_name: firstName,
      last_name: lastName,
      role: backendRole,
      phone: phone || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip_code: zipCode || undefined,
      license_number: role === 'patient' ? undefined : licenseNumber,
      license_state: role === 'patient' ? undefined : licenseState,
      specialty: role === 'patient' ? undefined : specialty,
    });

    // Backend now sets cookies automatically, no tokens in response
    if (isApiUser(response.user)) {
      setUser(mapBackendUser(response.user));
      void loadAccessibleUsers();
    }
  }, [loadAccessibleUsers]);

  const registerWithGoogle = useCallback(async (
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
  ) => {
    // Map frontend roles to backend roles
    const roleMap: Record<SignupRole, AuthRegisterRole> = {
      patient: 'patient',
      doctor: 'provider',
      hospital: 'hospital',
      laboratory: 'laboratory',
      imaging: 'imaging',
      pharmacy: 'pharmacist',
      ambulance: 'ambulance',
      physiotherapist: 'physiotherapist',
    };
    const backendRole = roleMap[role] || 'patient';

    const response = await authApi.registerWithGoogle({
      credential,
      role: backendRole,
      phone: phone || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip_code: zipCode || undefined,
      license_number: role === 'patient' ? undefined : licenseNumber,
      license_state: role === 'patient' ? undefined : licenseState,
      specialty: role === 'patient' ? undefined : specialty,
    });

    if (isApiUser(response.user)) {
      setUser(mapBackendUser(response.user));
      void loadAccessibleUsers();
    } else {
      throw new Error('Registration response did not include a valid user');
    }
  }, [loadAccessibleUsers]);

  const registerWithApple = useCallback(async (
    credential: string,
    role: SignupRole,
    firstName?: string,
    lastName?: string,
    licenseNumber?: string,
    licenseState?: string,
    specialty?: string,
    phone?: string,
  ) => {
    const roleMap: Record<SignupRole, AuthRegisterRole> = {
      patient: 'patient', doctor: 'provider', hospital: 'hospital', laboratory: 'laboratory',
      imaging: 'imaging', pharmacy: 'pharmacist', ambulance: 'ambulance', physiotherapist: 'physiotherapist',
    };
    const response = await authApi.registerWithApple({
      credential,
      role: roleMap[role],
      first_name: firstName,
      last_name: lastName,
      phone: phone || undefined,
      license_number: role === 'patient' ? undefined : licenseNumber,
      license_state: role === 'patient' ? undefined : licenseState,
      specialty: role === 'patient' ? undefined : specialty,
    });
    if (!isApiUser(response.user)) throw new Error('Registration response did not include a valid user');
    setUser(mapBackendUser(response.user));
    void loadAccessibleUsers();
  }, [loadAccessibleUsers]);

  const logout = useCallback(async () => {
    try {
      // Only call logout API if we have a user (avoid 401 on already logged out state)
      if (user) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of API call success
      setUser(null);
      setUsers([]);
      clearTokens();
    }
  }, [user]);

  const updateProfile = useCallback(async (profile: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    const response = await authApi.updateProfile({
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip_code: profile.zipCode,
      date_of_birth: profile.dateOfBirth,
      bio: profile.bio,
      profile_image_url: profile.avatar,
      postdicom_api_url: profile.postdicomApiUrl,
      notification_email: profile.notificationEmail,
      notification_sms: profile.notificationSms,
      privacy_public_profile: profile.privacyPublicProfile,
    });

    if (isApiUser(response)) {
      setUser(mapBackendUser(response));
    }
  }, [user]);

  const updateBasicInfo = useCallback(async (firstName: string, lastName: string) => {
    if (!user) throw new Error('No user logged in');

    const response = await authApi.updateProfile({
      first_name: firstName,
      last_name: lastName,
    });

    if (isApiUser(response)) {
      setUser(mapBackendUser(response));
    }
  }, [user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('No user logged in');

    await authApi.changePassword(currentPassword, newPassword);
  }, [user]);

  const updateNotificationPreferences = useCallback(async (email: boolean, sms: boolean) => {
    if (!user) throw new Error('No user logged in');

    await updateProfile({
      notificationEmail: email,
      notificationSms: sms,
    });
  }, [user, updateProfile]);

  const updatePrivacySettings = useCallback(async (publicProfile: boolean) => {
    if (!user) throw new Error('No user logged in');

    await updateProfile({
      privacyPublicProfile: publicProfile,
    });
  }, [user, updateProfile]);

  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<number>(0);

  const refreshCurrentUser = useCallback(async () => {
    const now = Date.now();
    // Prevent refresh attempts more than once every 5 seconds
    if (now - lastRefreshAttempt < 5000) {
      return null;
    }
    setLastRefreshAttempt(now);

    try {
      const userData = await authApi.getCurrentUser();
      if (isApiUser(userData)) {
        const updatedUser = mapBackendUser(userData);
        setUser(updatedUser);
        void loadAccessibleUsers();
        return updatedUser;
      }
      return null;
    } catch (error) {
      const status = typeof error === 'object' && error && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;

      if (status === 401 || status === 403) {
        // Clear auth state on authentication failure
        setUser(null);
        setUsers([]);
        clearTokens();
      } else {
        console.error('Failed to refresh current user:', error);
      }

      return null;
    }
  }, [loadAccessibleUsers, lastRefreshAttempt]);

  const deleteAccount = useCallback(async (password: string) => {
    if (!user) throw new Error('No user logged in');

    await authApi.deleteAccount(password);
  }, [user]);

  const linkAccount = useCallback(async (currentPassword: string, linkedEmail: string, linkedPassword: string) => {
    if (!user) throw new Error('No user logged in');

    await accountLinksApi.create({
      current_password: currentPassword,
      linked_email: linkedEmail,
      linked_password: linkedPassword,
    });

    const refreshedUser = await authApi.getCurrentUser();
    if (isApiUser(refreshedUser)) {
      setUser(mapBackendUser(refreshedUser));
    }
  }, [user]);

  const resendEmailVerification = useCallback(async () => {
    if (!user) throw new Error('No user logged in');
    if (user.role === 'admin' || user.emailVerified) return;

    await authApi.resendVerificationEmail();
  }, [user]);

  const clearCache = useCallback(() => {
    clearAleraStorage();
    clearTokens();
    setUser(null);
    setUsers([]);
  }, []);

  // Mock functions for backward compatibility - to be replaced by API calls
  const addUser = useCallback(async (name: string, email: string, password: string, role: SignupRole): Promise<User> => {
    throw new Error('Use signup instead');
  }, []);

  const getUsers = useCallback((): User[] => users, [users]);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      return;
    }

    void loadAccessibleUsers();
  }, [loadAccessibleUsers, user]);

  useEffect(() => {
    let lastVisibilityCheck = Date.now();

    const syncUser = () => {
      // Only refresh if we have a user and it's been at least 30 seconds since last check
      if (user && Date.now() - lastVisibilityCheck > 30000) {
        lastVisibilityCheck = Date.now();
        void refreshCurrentUser();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncUser();
      }
    };

    // Only listen for visibility changes, not focus (too frequent)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshCurrentUser, user]);

  if (isLoading) {
    // Don't mock auth methods during initialization; we still need signup/login to work
    // (especially right after page load).
    return (
      <AuthContext.Provider value={{
        user,
        // During initialization `user` may still be null, but we want to avoid
        // redirecting protected routes before auth initialization completes.
        isAuthenticated: true,
        isLoading,
        login,
        loginWithGoogle,
        loginWithApple,
        registerWithGoogle,
        registerWithApple,
        signup,
        logout,
        addUser,
        getUsers,
        updateProfile,
        updateBasicInfo,
        changePassword,
        updateNotificationPreferences,
        updatePrivacySettings,
        deleteAccount,
        linkAccount,
        resendEmailVerification,
        clearCache
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading,
      login, 
      loginWithGoogle,
      loginWithApple,
      registerWithGoogle,
      registerWithApple,
      signup, 
      logout, 
      addUser, 
      getUsers, 
      updateProfile, 
      updateBasicInfo, 
      changePassword, 
      updateNotificationPreferences, 
      updatePrivacySettings, 
      deleteAccount, 
      linkAccount,
      resendEmailVerification,
      clearCache 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
