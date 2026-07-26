import { describe, expect, it } from 'vitest';
import { canAccessFeature } from '@/lib/featureAccess';

describe('provider access matrix', () => {
  it('keeps doctor portal routes accessible', () => {
    expect(canAccessFeature('appointments', 'doctor')).toBe(true);
    expect(canAccessFeature('patients', 'doctor')).toBe(true);
    expect(canAccessFeature('lab-referrals', 'doctor')).toBe(true);
    expect(canAccessFeature('imaging-referrals', 'doctor')).toBe(true);
    expect(canAccessFeature('pharmacy-referrals', 'doctor')).toBe(true);
    expect(canAccessFeature('referrals', 'doctor')).toBe(true);
    expect(canAccessFeature('requests', 'doctor')).toBe(true);
    expect(canAccessFeature('timeline', 'doctor')).toBe(true);
    expect(canAccessFeature('messages', 'doctor')).toBe(true);
  });

  it('keeps hospital portal routes accessible', () => {
    expect(canAccessFeature('patients', 'hospital')).toBe(true);
    expect(canAccessFeature('requests', 'hospital')).toBe(true);
    expect(canAccessFeature('referrals', 'hospital')).toBe(true);
    expect(canAccessFeature('doctors', 'hospital')).toBe(true);
    expect(canAccessFeature('messages', 'hospital')).toBe(true);
  });

  it('keeps laboratory portal routes accessible', () => {
    expect(canAccessFeature('test-requests', 'laboratory')).toBe(true);
    expect(canAccessFeature('results', 'laboratory')).toBe(true);
    expect(canAccessFeature('messages', 'laboratory')).toBe(true);
  });

  it('keeps imaging portal routes accessible', () => {
    expect(canAccessFeature('scan-requests', 'imaging')).toBe(true);
    expect(canAccessFeature('imaging-referrals', 'imaging')).toBe(true);
    expect(canAccessFeature('results', 'imaging')).toBe(true);
    expect(canAccessFeature('messages', 'imaging')).toBe(true);
  });

  it('keeps pharmacy portal routes accessible', () => {
    expect(canAccessFeature('prescriptions', 'pharmacy')).toBe(true);
    expect(canAccessFeature('pharmacy-referrals', 'pharmacy')).toBe(true);
    expect(canAccessFeature('inventory', 'pharmacy')).toBe(true);
    expect(canAccessFeature('messages', 'pharmacy')).toBe(true);
  });

  it('keeps physiotherapist portal routes accessible', () => {
    expect(canAccessFeature('appointments', 'physiotherapist')).toBe(true);
    expect(canAccessFeature('patients', 'physiotherapist')).toBe(true);
    expect(canAccessFeature('referrals', 'physiotherapist')).toBe(true);
    expect(canAccessFeature('clinical-notes', 'physiotherapist')).toBe(true);
    expect(canAccessFeature('messages', 'physiotherapist')).toBe(true);
    expect(canAccessFeature('pricing-settings', 'physiotherapist')).toBe(true);
  });

  it('does not leak admin-only routes into provider portals', () => {
    expect(canAccessFeature('users', 'doctor')).toBe(false);
    expect(canAccessFeature('users', 'hospital')).toBe(false);
    expect(canAccessFeature('analytics', 'pharmacy')).toBe(false);
    expect(canAccessFeature('admin-billing', 'laboratory')).toBe(false);
  });
});
