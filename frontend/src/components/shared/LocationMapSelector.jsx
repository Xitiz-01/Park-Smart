import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import '@/styles/leaflet.css';
import L from 'leaflet';

const markerIcon = L.divIcon({
  className: '',
  html: '<span class="ps-drop-pin"></span>',
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
  return <Marker draggable position={position} icon={markerIcon} eventHandlers={handlers} ref={markerRef} title="Entrance pin. Drag to move it." alt="Entrance pin" />;
}

export default function LocationMapSelector({ latitude, longitude, onMove }) {
  const position = useMemo(() => [Number(latitude), Number(longitude)], [latitude, longitude]);
  if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null;
  return (
    <div className="ps-map mt-3 h-72 overflow-hidden rounded-xl border sm:h-80">
      <MapContainer center={position} zoom={16} className="size-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter position={position} />
        <DraggableMarker position={position} onMove={onMove} />
      </MapContainer>
    </div>
  );
}
