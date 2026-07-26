import { describe, expect, it } from 'vitest';

import { normalizeUserRole } from '@/lib/roleUtils';

describe('normalizeUserRole', () => {
  it('maps backend provider and pharmacist roles to ui roles', () => {
    expect(normalizeUserRole('provider')).toBe('doctor');
    expect(normalizeUserRole('pharmacist')).toBe('pharmacy');
  });

  it('normalizes spaced and hyphenated legacy role labels', () => {
    expect(normalizeUserRole('Super Admin')).toBe('super_admin');
    expect(normalizeUserRole('super-admin')).toBe('super_admin');
    expect(normalizeUserRole('HOSPITAL')).toBe('hospital');
  });
});
