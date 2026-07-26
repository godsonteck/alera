import { describe, expect, it } from 'vitest';

import { buildSocketUrl, resolveSocketBaseUrl } from '@/lib/socketUrl';

describe('socket URL helpers', () => {
  it('builds a same-origin websocket URL from the default api base', () => {
    const expectedBase = `ws://${window.location.host}/api`;
    expect(resolveSocketBaseUrl('/api')).toBe(expectedBase);
    expect(buildSocketUrl('/ws/location/42', '/api')).toBe(`${expectedBase}/ws/location/42`);
  });

  it('converts configured https api URLs into secure websocket URLs', () => {
    expect(resolveSocketBaseUrl('https://backend.example.com/api')).toBe('wss://backend.example.com/api');
    expect(buildSocketUrl('/telemedicine/ws', 'https://backend.example.com/api')).toBe('wss://backend.example.com/api/telemedicine/ws');
  });

  it('preserves already-configured websocket endpoints', () => {
    expect(buildSocketUrl('/ws/location/7', 'wss://backend.example.com/api')).toBe('wss://backend.example.com/api/ws/location/7');
  });
});
