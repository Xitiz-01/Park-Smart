import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { MapPin, LocateFixed, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import { slotsAPI } from '../../services/api';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };
const NEARBY_CACHE_KEY = 'nearby_slots_cache_v2';
const STATUS_COLORS = {
  available: '#10b981',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  maintenance: '#9ca3af',
};
const EXTERNAL_MARKER_COLOR = '#3b82f6';
const toRadians = (deg) => (deg * Math.PI) / 180;
const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const createSlotIcon = (status) =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:999px;background:${STATUS_COLORS[status] || '#60a5fa'};border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(0,0,0,0.2);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
const createExternalIcon = () =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:999px;background:${EXTERNAL_MARKER_COLOR};border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(0,0,0,0.2);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
const getProviderLabel = (provider) => {
  if (!provider) return '';
  if (provider.includes('nominatim')) return 'Nominatim (OpenStreetMap)';
  if (provider.includes('overpass')) return 'Overpass (OpenStreetMap)';
  return 'OpenStreetMap';
};

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center?.lat && center?.lng) {
      map.setView([center.lat, center.lng], 15);
    }
  }, [center, map]);
  return null;
}

export default function NearbyMapPage() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [slots, setSlots] = useState([]);
  const [externalPlaces, setExternalPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(2000);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showingCached, setShowingCached] = useState(false);
  const [externalProvider, setExternalProvider] = useState('');

  const readCachedNearby = () => {
    try {
      const raw = localStorage.getItem(NEARBY_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const writeCachedNearby = (cachePayload) => {
    try {
      localStorage.setItem(NEARBY_CACHE_KEY, JSON.stringify(cachePayload));
    } catch (e) {
      // ignore storage write errors
    }
  };

  const fetchNearby = async (coords, opts = {}) => {
    const nextRadius = opts.radius ?? radius;
    const nextStatus = opts.status ?? status;
    const nextType = opts.type ?? type;

    if (!navigator.onLine) {
      const cached = readCachedNearby();
      if (cached?.slots?.length || cached?.externalPlaces?.length) {
        setSlots(cached.slots || []);
        setExternalPlaces(cached.externalPlaces || []);
        setExternalProvider(cached.externalProvider || '');
        setCenter(cached.center || coords || center);
        setShowingCached(true);
        toast('Offline: showing last synced nearby parking data');
      } else {
        setSlots([]);
        setExternalPlaces([]);
        setExternalProvider('');
      }
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [internalResult, externalResult] = await Promise.allSettled([
        slotsAPI.getNearby({
          lat: coords.lat,
          lng: coords.lng,
          radius: nextRadius,
          status: nextStatus,
          type: nextType,
        }),
        slotsAPI.getExternalNearby({
          lat: coords.lat,
          lng: coords.lng,
          radius: nextRadius,
        }),
      ]);

      const hasInternal = internalResult.status === 'fulfilled';
      const hasExternal = externalResult.status === 'fulfilled';

      if (!hasInternal && !hasExternal) {
        const internalMessage = internalResult.reason?.response?.data?.message;
        const externalMessage = externalResult.reason?.response?.data?.message;
        throw new Error(externalMessage || internalMessage || 'Unable to fetch nearby parking data');
      }

      const apiSlots = hasInternal ? internalResult.value.data.slots || [] : [];
      const externalPayload = hasExternal ? externalResult.value.data : {};
      const apiExternalPlaces = hasExternal ? externalPayload.places || [] : [];
      const provider = hasExternal ? externalPayload.provider || '' : '';
      setSlots(apiSlots);
      setExternalPlaces(apiExternalPlaces);
      setExternalProvider(provider);
      setShowingCached(false);
      writeCachedNearby({
        slots: apiSlots,
        externalPlaces: apiExternalPlaces,
        externalProvider: provider,
        center: { lat: coords.lat, lng: coords.lng },
        radius: nextRadius,
        status: nextStatus,
        type: nextType,
        syncedAt: new Date().toISOString(),
      });

      if (!hasExternal) {
        toast('Live public parking provider is temporarily unavailable. Showing app slot data.');
      }
      if (!hasInternal) {
        toast('App slot feed is temporarily unavailable. Showing live public parking data.');
      }
    } catch (err) {
      const cached = readCachedNearby();
      if (cached?.slots?.length || cached?.externalPlaces?.length) {
        setSlots(cached.slots || []);
        setExternalPlaces(cached.externalPlaces || []);
        setExternalProvider(cached.externalProvider || '');
        setCenter(cached.center || coords || center);
        setShowingCached(true);
        toast('Using last synced data due to connectivity issue');
      } else {
        toast.error(err.message || err.response?.data?.message || 'Unable to fetch nearby parking data');
      }
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this browser');
      fetchNearby(center);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextCenter = { lat: coords.latitude, lng: coords.longitude };
        setCenter(nextCenter);
        fetchNearby(nextCenter);
      },
      () => {
        toast.error('Location access denied. Showing default area.');
        fetchNearby(center);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    fetchNearby(center);
  }, [radius, status, type]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online. Refreshing nearby slots...');
      fetchNearby(center);
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('You are offline. Live updates are paused.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [center, radius, status, type]);

  useEffect(() => {
    if (!isOnline) return undefined;
    const socket = io((process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace('/api', ''), {
      transports: ['websocket'],
    });

    socket.on('slot:updated', (updatedSlot) => {
      setSlots((prev) => {
        const exists = prev.some((slot) => slot._id === updatedSlot._id);
        if (exists) {
          return prev.map((slot) => {
            if (slot._id !== updatedSlot._id) return slot;
            const lat = updatedSlot.location?.lat;
            const lng = updatedSlot.location?.lng;
            if (typeof lat === 'number' && typeof lng === 'number') {
              const distanceMeters = calculateDistanceMeters(center.lat, center.lng, lat, lng);
              return {
                ...slot,
                ...updatedSlot,
                distanceMeters: Math.round(distanceMeters),
                distanceKm: Number((distanceMeters / 1000).toFixed(2)),
              };
            }
            return { ...slot, ...updatedSlot };
          });
        }
        return prev;
      });
    });

    return () => socket.disconnect();
  }, [isOnline, center]);

  const slotCountText = useMemo(() => {
    if (loading) return 'Loading nearby parking data...';
    if (!slots.length && !externalPlaces.length) return 'No nearby parking places found in selected radius';
    return `${slots.length} app slots • ${externalPlaces.length} live public parking places`;
  }, [loading, slots.length, externalPlaces.length]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Nearby Parking Map</h1>
        <p>
          {slotCountText}
          {!isOnline ? ' • Offline mode' : ''}
          {showingCached ? ' • Showing cached data' : ''}
          {externalProvider ? ` • Source: ${getProviderLabel(externalProvider)}` : ''}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label">Radius (meters)</label>
            <select className="form-input" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              <option value={1000}>1000 m</option>
              <option value={2000}>2000 m</option>
              <option value={3000}>3000 m</option>
              <option value={5000}>5000 m</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All Types</option>
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
              <option value="disabled">Accessible</option>
              <option value="ev">EV Charging</option>
            </select>
          </div>
          <button className="btn btn-outline" type="button" onClick={detectLocation} style={{ height: 42 }}>
            <LocateFixed size={16} /> Use My Location
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          Status and type filters apply to app slots only.
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: '560px', width: '100%' }}>
          <RecenterMap center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle center={[center.lat, center.lng]} radius={radius} pathOptions={{ color: '#3b82f6', fillOpacity: 0.08 }} />
          <Marker
            position={[center.lat, center.lng]}
            icon={L.divIcon({
              className: '',
              html: '<div style="width:14px;height:14px;border-radius:999px;background:#3b82f6;border:2px solid #fff;"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Popup>
              <div style={{ fontSize: 13 }}>
                <strong>Your location</strong>
              </div>
            </Popup>
          </Marker>
          {slots.map((slot) => (
            <Marker key={slot._id} position={[slot.location.lat, slot.location.lng]} icon={createSlotIcon(slot.status)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{slot.slotNumber}</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    Floor {slot.floor} • Zone {slot.zone}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {slot.location.label}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 10 }}>
                    <Navigation size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {slot.distanceKm} km away
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>₹{slot.pricePerHour}/hr</span>
                    {slot.status === 'available' ? (
                      <Link to={`/dashboard/book/${slot._id}`} className="btn btn-primary btn-sm">
                        Book
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Unavailable</span>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          {externalPlaces.map((place) => (
            <Marker key={place.id} position={[place.location.lat, place.location.lng]} icon={createExternalIcon()}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{place.name}</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {place.location.label}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                    <Navigation size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {place.distanceKm} km away
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 2, color: '#93c5fd' }}>Public parking data (OpenStreetMap)</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Capacity: {place.capacity || 'Unknown'} • Fee: {place.fee || 'Unknown'} • Access: {place.access || 'Unknown'}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
