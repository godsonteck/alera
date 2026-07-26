import { useQuery } from '@tanstack/react-query';

export type ContinuityEvent = {
  id: string;
  type: string;
  timestamp: string;
  actor?: { id: string; name?: string; role?: string };
  summary?: string;
  details?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
};

export type ContinuityThread = {
  threadId: string;
  patientId: string;
  title?: string;
  currentState?: string;
  events: ContinuityEvent[];
};

async function fetchContinuity(patientId?: string): Promise<ContinuityThread[]> {
  const url = new URL('/api/continuity/threads', window.location.origin);
  if (patientId) url.searchParams.set('patientId', patientId);
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Continuity fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}

export function useContinuity(patientId?: string, enabled = true) {
  return useQuery<ContinuityThread[], Error>(
    ['continuity', patientId],
    () => fetchContinuity(patientId),
    {
      enabled: !!enabled,
      staleTime: 30_000,
      retry: 1,
    }
  );
}
