import React from 'react';
import { useParams } from 'react-router-dom';
import { useContinuity } from '../../hooks/useContinuity';

export default function ContinuityPageImpl(): JSX.Element {
  const { patientId } = useParams<{ patientId?: string }>();
  const { data, isLoading, isError, error, refetch } = useContinuity(patientId);

  return (
    <main aria-labelledby="continuity-title" style={{ padding: 20 }}>
      <h1 id="continuity-title">Continuity Thread</h1>

      {isLoading && (
        <section aria-live="polite">
          <p>Loading continuity threads…</p>
        </section>
      )}

      {isError && (
        <section role="alert">
          <p>Unable to load continuity threads.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error?.message}</pre>
          <button onClick={() => refetch()}>Retry</button>
        </section>
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <section>
          <p>No continuity threads found{patientId ? ` for patient ${patientId}` : ''}.</p>
        </section>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <section aria-label="continuity-threads">
          {data.map((thread) => (
            <article
              key={thread.threadId}
              aria-labelledby={`thread-${thread.threadId}-title`}
              style={{
                marginBottom: 20,
                padding: 12,
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <h2 id={`thread-${thread.threadId}-title`}>{thread.title || `Thread ${thread.threadId}`}</h2>
              <p>State: {thread.currentState || 'unknown'}</p>

              <ol aria-label={`events-${thread.threadId}`} style={{ paddingLeft: 16 }}>
                {thread.events.map((ev) => (
                  <li key={ev.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: '#111' }}>
                      <strong>{ev.type}</strong>{' '}
                      <span style={{ color: '#666', fontSize: 12 }}>
                        — {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {ev.summary && <div style={{ color: '#222' }}>{ev.summary}</div>}
                    {ev.actor && <div style={{ color: '#555', fontSize: 13 }}>By {ev.actor.name || ev.actor.id} ({ev.actor.role})</div>}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
