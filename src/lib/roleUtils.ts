import type { UserRole } from '@/contexts/AuthContext';

const allowedRoles: UserRole[] = ['patient', 'doctor', 'hospital', 'laboratory', 'imaging', 'pharmacy', 'ambulance', 'physiotherapist', 'admin', 'super_admin'];

/**
 * Normalize backend role strings to the frontend UI role strings.
 *
 * Backend stores doctors as `provider` and pharmacists as `pharmacist`,
 * while the UI expects `doctor` and `pharmacy`.
 */
export const normalizeUserRole = (role: unknown): UserRole | undefined => {
  if (typeof role !== 'string') return undefined;

  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapped =
    normalized === 'provider' ? 'doctor' :
    normalized === 'pharmacist' ? 'pharmacy' :
    normalized;

  return allowedRoles.includes(mapped as UserRole) ? (mapped as UserRole) : undefined;
};
