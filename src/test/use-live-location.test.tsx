import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveLocation } from '@/hooks/useLiveLocation';

const {
  getRequestTracking,
  updateMine,
  disableMine,
} = vi.hoisted(() => ({
  getRequestTracking: vi.fn(),
  updateMine: vi.fn(),
  disableMine: vi.fn(),
}));

vi.mock('@/lib/apiService', () => ({
  liveLocationApi: {
    getRequestTracking,
    updateMine,
    disableMine,
  },
}));

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send = vi.fn();

  close(code?: number) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 } as CloseEvent);
  }

  static instances: FakeWebSocket[] = [];
}

const HookHarness = () => {
  const { transportMode, error } = useLiveLocation({
    requestId: 'request-7',
    enabled: true,
    shouldShare: false,
    myRole: 'doctor',
  });

  return (
    <div>
      <span data-testid="mode">{transportMode}</span>
      <span data-testid="error">{error ?? 'none'}</span>
    </div>
  );
};

describe('useLiveLocation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    getRequestTracking.mockResolvedValue({
      patient_location: null,
      ambulance_location: null,
    });
    updateMine.mockResolvedValue({});
    disableMine.mockResolvedValue({});
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('falls back to polling when the realtime socket cannot connect', async () => {
    render(<HookHarness />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(getRequestTracking).toHaveBeenCalledTimes(1);

    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();

    await act(async () => {
      socket.onerror?.(new Event('error'));
      socket.onclose?.({ code: 1006 } as CloseEvent);
      await Promise.resolve();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('polling');
    expect(screen.getByTestId('error')).toHaveTextContent('Tracking will keep refreshing automatically.');

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(getRequestTracking).toHaveBeenCalledTimes(2);
  });
});
