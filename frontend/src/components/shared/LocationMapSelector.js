import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#3b82f6;border:3px solid white;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.45)"></div>',
  iconSize: [28, 28], iconAnchor: [14, 28],
});

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => { map.setView(position, 16); }, [map, position]);
  return null;
}

function DraggableMarker({ position, onMove }) {
  const markerRef = useRef(null);
  const handlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const point = marker.getLatLng();
        onMove({ latitude: point.lat, longitude: point.lng });
      }
    },
  }), [onMove]);
  return <Marker draggable position={position} icon={markerIcon} eventHandlers={handlers} ref={markerRef} />;
}

export default function LocationMapSelector({ latitude, longitude, onMove }) {
  const position = useMemo(() => [Number(latitude), Number(longitude)], [latitude, longitude]);
  if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null;
  return (
    <div style={{ height: 310, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 12 }}>
      <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter position={position} />
        <DraggableMarker position={position} onMove={onMove} />
      </MapContainer>
    </div>
  );
}
