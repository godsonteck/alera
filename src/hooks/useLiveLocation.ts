import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { liveLocationApi } from '@/lib/apiService';
import { normalizeUserRole } from '@/lib/roleUtils';
import { buildSocketUrl } from '@/lib/socketUrl';

export interface LocationData {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  user_id?: string | number;
  role?: string;
  timestamp?: string;
}

type UseLiveLocationOptions = {
  requestId?: string;
  enabled?: boolean;
  shouldShare?: boolean;
  myRole?: string;
};

type LiveLocationTransportMode = 'idle' | 'connecting' | 'socket' | 'polling';

const SNAPSHOT_POLL_INTERVAL_MS = 5000;
const SOCKET_RECONNECT_DELAY_MS = 5000;

export const useLiveLocation = ({
  requestId,
  enabled = false,
  shouldShare = false,
  myRole,
}: UseLiveLocationOptions) => {
  const [myLocation, setMyLocation] = useState<LocationData | null>(null);
  const [patientLocation, setPatientLocation] = useState<LocationData | null>(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState<LocationData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<LiveLocationTransportMode>('idle');
  const socketRef = useRef<WebSocket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const snapshotPollTimerRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  const setRoleLocation = useCallback((payload: LocationData) => {
    const normalizedRole = normalizeUserRole(payload.role) ?? payload.role;
    if (normalizedRole === 'patient') {
      setPatientLocation(payload);
    } else if (normalizedRole === 'ambulance') {
      setAmbulanceLocation(payload);
    }
  }, []);

  const pushLocationToBackend = useCallback(async (location: LocationData) => {
    try {
      await liveLocationApi.updateMine({
        latitude: location.lat,
        longitude: location.lng,
        sharing_enabled: true,
      });
    } catch (locationError) {
      console.error('Failed to persist live location:', locationError);
    }
  }, []);

  const connect = useCallback(() => {
    if (!requestId || socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setTransportMode((currentMode) => currentMode === 'socket' ? currentMode : 'connecting');
    const socket = new WebSocket(buildSocketUrl(`/ws/location/${requestId}`));

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      setTransportMode('socket');
      if (snapshotPollTimerRef.current !== null) {
        window.clearInterval(snapshotPollTimerRef.current);
        snapshotPollTimerRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LocationData & { type?: string };
        if (data.type === 'location_update' || data.type === 'location_snapshot') {
          setRoleLocation(data);
        }
      } catch (parseError) {
        console.error('Failed to parse location message', parseError);
      }
    };

    socket.onclose = (event) => {
      setIsConnected(false);
      socketRef.current = null;
      setTransportMode(enabled ? 'polling' : 'idle');
      if (event.code !== 1000 && enabled) {
        reconnectTimerRef.current = window.setTimeout(() => {
          if (isMounted.current) {
            connect();
          }
        }, SOCKET_RECONNECT_DELAY_MS);
      }
    };

    socket.onerror = () => {
      setError('Realtime connection is unavailable. Tracking will keep refreshing automatically.');
      setTransportMode('polling');
    };

    socketRef.current = socket;
  }, [enabled, requestId, setRoleLocation]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (shouldShare) {
      try {
        await liveLocationApi.disableMine();
      } catch (disableError) {
        console.error('Failed to disable live location sharing:', disableError);
      }
    }
  }, [shouldShare]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          role: myRole,
          timestamp: new Date().toISOString(),
        };
        setMyLocation(nextLocation);
        setRoleLocation(nextLocation);
        void pushLocationToBackend(nextLocation);

        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'location_update',
            ...nextLocation,
          }));
        }
      },
      (geoError) => {
        setError(`Geolocation error: ${geoError.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, [myRole, pushLocationToBackend, setRoleLocation]);

  const refreshSnapshot = useCallback(async () => {
    if (!requestId) return;
    try {
      const snapshot = await liveLocationApi.getRequestTracking(requestId);
      if (snapshot.patient_location?.latitude != null && snapshot.patient_location.longitude != null) {
        setPatientLocation({
          lat: snapshot.patient_location.latitude,
          lng: snapshot.patient_location.longitude,
          user_id: snapshot.patient_location.user_id,
          role: snapshot.patient_location.role,
          timestamp: snapshot.patient_location.last_updated ?? undefined,
        });
      }
      if (snapshot.ambulance_location?.latitude != null && snapshot.ambulance_location.longitude != null) {
        setAmbulanceLocation({
          lat: snapshot.ambulance_location.latitude,
          lng: snapshot.ambulance_location.longitude,
          user_id: snapshot.ambulance_location.user_id,
          role: snapshot.ambulance_location.role,
          timestamp: snapshot.ambulance_location.last_updated ?? undefined,
        });
      }
    } catch (snapshotError) {
      console.error('Failed to fetch live location snapshot:', snapshotError);
    }
  }, [requestId]);

  const startSnapshotPolling = useCallback((runImmediately: boolean = false) => {
    if (!requestId) {
      return;
    }

    if (snapshotPollTimerRef.current !== null) {
      window.clearInterval(snapshotPollTimerRef.current);
    }

    if (runImmediately) {
      void refreshSnapshot();
    }

    snapshotPollTimerRef.current = window.setInterval(() => {
      void refreshSnapshot();
    }, SNAPSHOT_POLL_INTERVAL_MS);

    setTransportMode((currentMode) => currentMode === 'socket' ? currentMode : 'polling');
  }, [refreshSnapshot, requestId]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !requestId) {
      setTransportMode('idle');
      return undefined;
    }

    startSnapshotPolling(true);
    connect();
    if (shouldShare) {
      startTracking();
    }

    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (snapshotPollTimerRef.current !== null) {
        window.clearInterval(snapshotPollTimerRef.current);
        snapshotPollTimerRef.current = null;
      }
      void stopTracking();
      if (socketRef.current) {
        socketRef.current.close(1000);
        socketRef.current = null;
      }
    };
  }, [connect, enabled, requestId, shouldShare, startSnapshotPolling, startTracking, stopTracking]);

  const peerLocation = useMemo(() => {
    const normalizedRole = normalizeUserRole(myRole) ?? myRole;
    return normalizedRole === 'patient' ? ambulanceLocation : patientLocation;
  }, [ambulanceLocation, myRole, patientLocation]);

  return {
    myLocation,
    peerLocation,
    patientLocation,
    ambulanceLocation,
    isConnected,
    error,
    transportMode,
    reconnect: connect,
  };
};
