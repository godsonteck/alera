import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ambulance, Eye, LocateFixed, MapPin, Navigation, RefreshCcw, Route, ShieldCheck, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { LiveLocationMap } from '@/components/maps/LiveLocationMap';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { type AmbulanceRequest } from '@/data/mockData';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { ambulanceApi } from '@/lib/apiService';

type RequestDraft = {
  priority: AmbulanceRequest['priority'];
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });

const reverseGeocode = async (latitude: number, longitude: number) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    return payload.display_name as string | undefined;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return undefined;
  }
};

const describeStatus = (request: AmbulanceRequest, isPatientView: boolean) => {
  switch (request.status) {
    case 'requested': return isPatientView ? 'Request pending acceptance' : 'Awaiting dispatch confirmation';
    case 'accepted': return isPatientView ? 'Request accepted, preparing dispatch' : 'Dispatch started';
    case 'dispatched': return isPatientView ? 'Ambulance dispatched' : 'Unit deployed';
    case 'en-route': return isPatientView ? 'Responder navigating to location' : 'En route to coordinates';
    case 'arrived': return 'Unit on site';
    case 'completed': return 'Incident resolved';
    case 'cancelled': return 'Incident aborted';
    default: return 'Incident active';
  }
};

const AmbulancePage = () => {
  const { user, getUsers } = useAuth();
  const { ambulanceRequests, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RequestDraft>({ priority: 'critical', location: '' });
  const [trackingRequestId, setTrackingRequestId] = useState<string | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);

  const users = getUsers();
  const focusId = searchParams.get('focus');
  const isPatientView = user?.role === 'patient';
  const canDispatch = user?.role === 'ambulance';

  const visibleRequests = useMemo(() => {
    return ambulanceRequests.filter((request) => {
      if (user?.role === 'patient') return request.patientId === user.id;
      if (user?.role === 'ambulance' || user?.role === 'hospital' || user?.role === 'doctor') return true;
      return false;
    });
  }, [ambulanceRequests, user?.id, user?.role]);

  const activeOwnRequest = useMemo(() => {
    if (!isPatientView || !user) return null;
    return visibleRequests.find((request) => request.patientId === user.id && !['completed', 'cancelled'].includes(request.status)) ?? null;
  }, [isPatientView, user, visibleRequests]);

  useEffect(() => {
    if (activeOwnRequest && !trackingRequestId) setTrackingRequestId(activeOwnRequest.id);
  }, [activeOwnRequest, trackingRequestId]);

  useEffect(() => {
    const interval = window.setInterval(() => { void refreshAppData(); }, 5000);
    return () => window.clearInterval(interval);
  }, [refreshAppData]);

  const trackingRequest = visibleRequests.find((request) => request.id === trackingRequestId) ?? null;
  const shouldShareLiveLocation = Boolean(
    trackingRequest && user &&
    ((user.role === 'patient' && trackingRequest.patientId === user.id) || (user.role === 'ambulance' && trackingRequest.assignedAmbulanceId === user.id)) &&
    !['completed', 'cancelled'].includes(trackingRequest.status)
  );

  const { ambulanceLocation, patientLocation, error: wsError, transportMode } = useLiveLocation({
    requestId: trackingRequest?.id,
    enabled: Boolean(trackingRequest),
    shouldShare: shouldShareLiveLocation,
    myRole: user?.role,
  });

  const captureLocation = async () => {
    if (!navigator.geolocation) { setRequestError('Location services are unavailable in this environment.'); return; }
    setIsCapturingLocation(true);
    setRequestError(null);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const label = await reverseGeocode(latitude, longitude);
      setDraft(cur => ({ ...cur, latitude, longitude, address: label, location: label || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` }));
    } catch (error) {
      setRequestError(error instanceof GeolocationPositionError ? error.message : 'GPS triangulation failed.');
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const handleRequest = async () => {
    if (!draft.latitude || !draft.longitude || !draft.location) { setRequestError('GPS coordinates required prior to dispatch request.'); return; }
    setActionRequestId('create');
    setRequestError(null);
    try {
      const created = await ambulanceApi.createRequest({
        location_name: draft.location, address: draft.address, latitude: draft.latitude, longitude: draft.longitude,
        description: `Dispatch requested: ${draft.location}`, priority: draft.priority,
      });
      await refreshAppData();
      setTrackingRequestId(String(created.id));
      setShowForm(false);
      setDraft({ priority: 'critical', location: '' });
      addNotification({
        title: `Emergency request sent (${draft.priority})`,
        message: `Coordinates secured for ${created.location_name}.`,
        type: 'emergency', priority: draft.priority, audience: 'personal', targetRoles: ['ambulance', 'hospital', 'doctor'],
        actionUrlByRole: {
          patient: `/dashboard/ambulance?focus=${created.id}`, ambulance: `/dashboard/requests?focus=${created.id}`,
          hospital: `/dashboard/requests?focus=${created.id}`, doctor: `/dashboard/requests?focus=${created.id}`,
        },
      });
    } catch (error) {
      setRequestError('We could not send your request. Call your local emergency number if help is urgent.');
    } finally {
      setActionRequestId(null);
    }
  };

  const updateStatus = async (requestId: string, updateData: Parameters<typeof ambulanceApi.updateRequest>[1]) => {
    setActionRequestId(requestId);
    try {
      await ambulanceApi.updateRequest(requestId, updateData);
      await refreshAppData();
      setTrackingRequestId(requestId);
    } catch (error) {
      console.error('Status update failed:', error);
    } finally {
      setActionRequestId(null);
    }
  };

  const handleAccept = async (request: AmbulanceRequest) => {
    await updateStatus(request.id, { status: 'dispatched', assigned_ambulance_id: Number(user?.id) });
    addNotification({
      title: 'Unit Dispatched', message: `Unit en route to ${request.patientName}.`, type: 'emergency', priority: request.priority,
      audience: 'personal', targetEmails: users.find(a => a.id === request.patientId)?.email ? [users.find(a => a.id === request.patientId)!.email] : [],
      actionUrlByRole: { patient: `/dashboard/ambulance?focus=${request.id}`, ambulance: `/dashboard/requests?focus=${request.id}` },
    });
  };

  const renderActions = (request: AmbulanceRequest) => {
    const isActive = actionRequestId === request.id;
    const trackButton = (
      <button onClick={() => setTrackingRequestId(request.id)} className="px-3 py-1 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold rounded-[2px] transition-colors uppercase tracking-wider text-[10px] flex items-center gap-1">
        <Eye className="w-3 h-3" /> TRACK
      </button>
    );

    if (user?.role === 'ambulance') {
      return (
        <>
          {trackButton}
          {request.status === 'requested' && <button onClick={() => void handleAccept(request)} disabled={isActive} className="px-3 py-1 bg-amber-950/60 border border-amber-600/60 text-amber-300 font-bold rounded-[2px] hover:bg-amber-900 transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30">ACCEPT</button>}
          {(request.status === 'accepted' || request.status === 'dispatched') && <button onClick={() => void updateStatus(request.id, { status: 'en_route' })} disabled={isActive} className="px-3 py-1 bg-cyan-950/60 border border-cyan-600/60 text-cyan-300 font-bold rounded-[2px] hover:bg-cyan-900 transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30">EN ROUTE</button>}
          {request.status === 'en-route' && <button onClick={() => void updateStatus(request.id, { status: 'arrived' })} disabled={isActive} className="px-3 py-1 bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 font-bold rounded-[2px] hover:bg-emerald-900 transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30">ARRIVED</button>}
          {(['arrived', 'en-route', 'dispatched'].includes(request.status)) && <button onClick={() => void updateStatus(request.id, { status: 'completed' })} disabled={isActive} className="px-3 py-1 bg-[#151922] border border-slate-600/60 text-slate-300 font-bold rounded-[2px] hover:bg-slate-800 transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30">COMPLETE</button>}
        </>
      );
    }
    return trackButton;
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">
            {isPatientView ? 'Request an ambulance' : 'Ambulance requests'}
          </span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isPatientView ? 'Share your location with a connected ambulance team.' : 'See active requests, locations, and updates.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refreshAppData()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold rounded-[2px] transition-colors uppercase tracking-wider text-[10px]">
            <RefreshCcw className="w-3 h-3" /> SYNC
          </button>
          {isPatientView && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-600/60 text-red-300 font-bold rounded-[2px] transition-colors uppercase tracking-wider text-[10px]">
              <AlertTriangle className="w-3 h-3" /> INITIATE DISPATCH
            </button>
          )}
        </div>
      </div>

      {isPatientView && (
        <div role="alert" className="border border-red-400/60 bg-red-950/40 p-4 text-sm leading-6 text-red-100">
          <p className="font-semibold text-red-200">For a life-threatening emergency, call your local emergency number now.</p>
          <p className="mt-1">Alera sends a request to a connected ambulance team. It does not replace emergency services and cannot promise that an ambulance is available.</p>
        </div>
      )}

      {showForm && (
        <div className="p-4 bg-[#090D14] border border-red-500/40 rounded-[4px] space-y-4">
          <div className="flex items-center justify-between border-b border-red-900/40 pb-2">
            <span className="text-xs font-bold uppercase text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Emergency request</span>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-3">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">GPS COORDINATES</span>
              <div className="text-[11px] text-slate-300 font-mono break-all">{draft.location || 'Waiting for location'}</div>
              {draft.latitude && draft.longitude && (
                <div className="text-[10px] text-cyan-400 font-mono">LAT: {draft.latitude.toFixed(5)} | LON: {draft.longitude.toFixed(5)}</div>
              )}
              <button onClick={() => void captureLocation()} disabled={isCapturingLocation} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold rounded-[2px] transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30">
                <LocateFixed className="w-3.5 h-3.5" /> {isCapturingLocation ? 'ACQUIRING SIGNAL...' : 'ACQUIRE GPS SIGNAL'}
              </button>
            </div>

            <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-3">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">INCIDENT PRIORITY</span>
              <select value={draft.priority} onChange={(e) => setDraft((cur) => ({ ...cur, priority: e.target.value as AmbulanceRequest['priority'] }))} className="w-full bg-[#151922] border border-[#2F3542] rounded-[2px] p-2 text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
                <option value="low">LOW PRIORITY</option>
                <option value="medium">MEDIUM PRIORITY</option>
                <option value="high">HIGH PRIORITY</option>
                <option value="critical">CRITICAL PRIORITY</option>
              </select>
              <div className="text-[9px] text-slate-500 uppercase leading-relaxed">Priority helps the team send the right response. Location updates begin once the request is confirmed.</div>
            </div>
          </div>

          {requestError && <div className="p-2 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300 font-bold">[ERROR] {requestError}</div>}

          <button onClick={() => void handleRequest()} disabled={actionRequestId === 'create' || !draft.latitude || !draft.longitude} className="w-full bg-red-950/80 hover:bg-red-900 border border-red-600/60 text-red-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-30">
            {actionRequestId === 'create' ? 'TRANSMITTING REQUEST...' : 'TRANSMIT DISPATCH REQUEST'}
          </button>
        </div>
      )}

      {trackingRequest && (
        <div className="space-y-4">
          <div className="p-4 bg-[#090D14] border border-cyan-500/40 rounded-[4px] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-900/40 pb-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-cyan-400 flex items-center gap-2"><Navigation className="w-4 h-4" /> Live location</span>
                <div className="flex gap-1.5">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border rounded-[2px] ${
                    trackingRequest.priority === 'critical' ? 'bg-red-950/50 border-red-600/60 text-red-400' : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                  }`}>
                    {trackingRequest.priority}
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] rounded-[2px] text-[9px] font-bold uppercase text-slate-300">
                    {trackingRequest.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-bold uppercase tracking-wider ${transportMode === 'socket' ? 'text-emerald-400' : transportMode === 'polling' ? 'text-cyan-400' : 'text-amber-400'}`}>
                  [{transportMode === 'socket' ? 'LINK SECURE' : transportMode === 'polling' ? 'POLLING MODE' : 'NEGOTIATING LINK'}]
                </span>
                <button onClick={() => setTrackingRequestId(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">TARGET</span>
                <span className="text-xs font-bold text-[#ECEEF2] truncate block">{trackingRequest.patientName}</span>
              </div>
              <div className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">UNIT</span>
                <span className="text-xs font-bold text-[#ECEEF2] truncate block">{trackingRequest.assignedAmbulanceId ? users.find(a => a.id === trackingRequest.assignedAmbulanceId)?.name || `UNIT-${trackingRequest.assignedAmbulanceId}` : '[UNASSIGNED]'}</span>
              </div>
              <div className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">SIGNAL</span>
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {shouldShareLiveLocation ? 'TRANSMITTING' : 'VIEW ONLY'}</span>
              </div>
            </div>
          </div>

          <div className="relative border border-[#252A35] rounded-[4px] overflow-hidden bg-[#090D14]">
            <LiveLocationMap patientLocation={patientLocation} ambulanceLocation={ambulanceLocation} />
            <div className="absolute top-2 left-2 bg-[#090D14]/90 border border-[#252A35] p-2 rounded-[2px] backdrop-blur max-w-[250px]">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 uppercase">
                <Route className="w-3.5 h-3.5" /> {describeStatus(trackingRequest, isPatientView)}
              </div>
              {wsError && <div className="mt-1 text-[9px] font-bold text-red-400 uppercase">[WARN] {wsError}</div>}
            </div>
          </div>
        </div>
      )}

      {visibleRequests.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          NO DISPATCH INCIDENTS LOGGED
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleRequests.map((request) => (
            <div key={request.id} className={`p-3 bg-[#090D14] border rounded-[2px] flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${focusId === request.id ? 'border-cyan-500/60' : 'border-[#252A35]'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 border rounded-[2px] mt-0.5 ${request.priority === 'critical' ? 'bg-red-950/40 border-red-600/60 text-red-400' : 'bg-[#151922] border-[#2F3542] text-cyan-400'}`}>
                  <Ambulance className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2] text-xs uppercase">{request.patientName}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {request.location}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{request.date} at {request.time}</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex gap-1.5">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border rounded-[2px] ${
                    request.priority === 'critical' ? 'bg-red-950/50 border-red-600/60 text-red-400' : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                  }`}>
                    {request.priority}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border rounded-[2px] ${
                    request.status === 'completed' ? 'bg-[#151922] border-slate-600/60 text-slate-300' : 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300'
                  }`}>
                    {request.status}
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">{describeStatus(request, isPatientView)}</div>
                <div className="flex gap-1.5 mt-1">{renderActions(request)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AmbulancePage;
