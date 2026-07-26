import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { type LocationData } from '@/hooks/useLiveLocation';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const ambulanceIcon = L.divIcon({
  html: `<div class="bg-primary text-primary-foreground px-2 py-1 rounded-full border-2 border-background shadow-lg text-[10px] font-semibold">Ambulance</div>`,
  className: '',
  iconSize: [78, 28],
  iconAnchor: [39, 14],
});

const patientIcon = L.divIcon({
  html: `<div class="bg-destructive text-destructive-foreground px-2 py-1 rounded-full border-2 border-background shadow-lg text-[10px] font-semibold">Patient</div>`,
  className: '',
  iconSize: [64, 28],
  iconAnchor: [32, 14],
});

type LiveLocationMapProps = {
  patientLocation: LocationData | null;
  ambulanceLocation: LocationData | null;
  className?: string;
};

const MapUpdater: React.FC<{ patientLocation: LocationData | null; ambulanceLocation: LocationData | null }> = ({
  patientLocation,
  ambulanceLocation,
}) => {
  const map = useMap();

  useEffect(() => {
    if (patientLocation && ambulanceLocation) {
      const bounds = L.latLngBounds([
        [patientLocation.lat, patientLocation.lng],
        [ambulanceLocation.lat, ambulanceLocation.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      return;
    }

    const active = patientLocation ?? ambulanceLocation;
    if (active) {
      map.setView([active.lat, active.lng], 15);
    }
  }, [ambulanceLocation, map, patientLocation]);

  return null;
};

const useRouteLine = (patientLocation: LocationData | null, ambulanceLocation: LocationData | null) => {
  const [routePoints, setRoutePoints] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    let isCancelled = false;

    const loadRoute = async () => {
      if (!patientLocation || !ambulanceLocation) {
        setRoutePoints([]);
        return;
      }

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${ambulanceLocation.lng},${ambulanceLocation.lat};${patientLocation.lng},${patientLocation.lat}?overview=full&geometries=geojson`,
        );
        const payload = await response.json();
        const coordinates = payload.routes?.[0]?.geometry?.coordinates;
        if (!isCancelled && Array.isArray(coordinates)) {
          setRoutePoints(coordinates.map((entry: [number, number]) => [entry[1], entry[0]]));
        }
      } catch (routeError) {
        if (!isCancelled) {
          setRoutePoints([
            [ambulanceLocation.lat, ambulanceLocation.lng],
            [patientLocation.lat, patientLocation.lng],
          ]);
        }
        console.error('Failed to fetch route line:', routeError);
      }
    };

    void loadRoute();

    return () => {
      isCancelled = true;
    };
  }, [ambulanceLocation, patientLocation]);

  return routePoints;
};

export const LiveLocationMap: React.FC<LiveLocationMapProps> = ({
  patientLocation,
  ambulanceLocation,
  className = 'h-[480px] w-full overflow-hidden rounded-2xl border border-border bg-muted/20',
}) => {
  const defaultPosition: [number, number] = [5.6037, -0.187];
  const center = patientLocation
    ? [patientLocation.lat, patientLocation.lng]
    : ambulanceLocation
      ? [ambulanceLocation.lat, ambulanceLocation.lng]
      : defaultPosition;
  const routePoints = useRouteLine(patientLocation, ambulanceLocation);

  return (
    <div className={className}>
      <MapContainer center={center as [number, number]} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routePoints.length >= 2 && (
          <Polyline positions={routePoints} pathOptions={{ color: '#0f766e', weight: 5, opacity: 0.75 }} />
        )}

        {patientLocation && (
          <Marker position={[patientLocation.lat, patientLocation.lng]} icon={patientIcon}>
            <Popup>
              <div className="text-sm font-semibold">Patient live location</div>
            </Popup>
          </Marker>
        )}

        {ambulanceLocation && (
          <Marker position={[ambulanceLocation.lat, ambulanceLocation.lng]} icon={ambulanceIcon}>
            <Popup>
              <div className="text-sm font-semibold">Ambulance live location</div>
            </Popup>
          </Marker>
        )}

        <MapUpdater patientLocation={patientLocation} ambulanceLocation={ambulanceLocation} />
      </MapContainer>
    </div>
  );
};
