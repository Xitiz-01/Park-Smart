import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { addHours, format } from 'date-fns';
import { io } from 'socket.io-client';
import { LocateFixed, MapPin, Search, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { parkingLocationsAPI } from '../../services/api';
import { parkingDetailsPath } from '../../utils/hybridParking';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 18.5204, lng: 73.8567 };
const CACHE_KEY = 'parksmart-location-discovery-v1';
const dateInput = (date) => format(date, "yyyy-MM-dd'T'HH:mm");
const markerIcon = (available) => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:999px;background:${available ? '#147d6f' : '#c94a4a'};border:3px solid white;box-shadow:0 0 0 2px rgba(37,37,37,.2)"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lng], 14); }, [center, map]);
  return null;
}

export default function NearbyMapPage() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [filters, setFilters] = useState({
    radiusKm: 10, vehicleType: 'car', startTime: dateInput(addHours(new Date(), 1)),
    endTime: dateInput(addHours(new Date(), 3)), sort: 'nearest', amenities: '',
    maxPrice: '', available: true,
  });

  const fetchLocations = useCallback(async (coords = center, next = filters) => {
    try {
      setLoading(true);
      const params = {
        ...next, lat: coords.lat, lng: coords.lng,
        startTime: new Date(next.startTime).toISOString(), endTime: new Date(next.endTime).toISOString(),
        amenities: next.amenities, available: next.available,
      };
      if (!params.maxPrice) delete params.maxPrice;
      const { data } = await parkingLocationsAPI.getNearby(params);
      setLocations(data.locations || []);
      setCached(false);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ center: coords, filters: next, locations: data.locations, savedAt: new Date().toISOString() }));
    } catch (error) {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const value = JSON.parse(saved);
        setLocations(value.locations || []);
        setCenter(value.center || coords);
        setCached(true);
        toast('Showing last synced discovery results');
      } else toast.error(error.response?.data?.message || 'Unable to discover parking');
    } finally { setLoading(false); }
  }, [center, filters]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return fetchLocations(DEFAULT_CENTER);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude };
      setCenter(next);
      fetchLocations(next);
    }, () => {
      toast('Location access was unavailable. Showing Pune.');
      fetchLocations(DEFAULT_CENTER);
    }, { enableHighAccuracy: true, timeout: 10000 });
  }, [fetchLocations]);

  useEffect(() => { locate(); }, []);
  useEffect(() => {
    const socket = io((process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, ''), { transports: ['websocket'], withCredentials: true });
    let timer;
    socket.on('availability:changed', () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchLocations(), 300);
    });
    return () => { clearTimeout(timer); socket.disconnect(); };
  }, [fetchLocations]);

  const queryFor = useCallback((location) => parkingDetailsPath(location._id, { ...filters, distanceKm: location.distanceKm }), [filters]);

  const resultText = useMemo(() => loading ? 'Checking live capacity…' : `${locations.length} reservable location${locations.length === 1 ? '' : 's'}`, [loading, locations.length]);

  return <div className="fade-in">
    <div className="page-header"><h1>Find Parking</h1><p>{resultText}{cached ? ' • cached result' : ' • live vendor inventory'}</p></div>
    <form className="card" style={{ marginBottom: 16 }} onSubmit={(event) => { event.preventDefault(); fetchLocations(); }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div className="form-group"><label className="form-label">Vehicle</label><select className="form-input" value={filters.vehicleType} onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}><option value="car">Car</option><option value="motorcycle">Motorcycle</option><option value="bike">Bike</option><option value="suv">SUV</option><option value="ev">EV</option></select></div>
        <div className="form-group"><label className="form-label">Arrive</label><input className="form-input" type="datetime-local" value={filters.startTime} onChange={(e) => setFilters({ ...filters, startTime: e.target.value })} required /></div>
        <div className="form-group"><label className="form-label">Leave</label><input className="form-input" type="datetime-local" value={filters.endTime} onChange={(e) => setFilters({ ...filters, endTime: e.target.value })} required /></div>
        <div className="form-group"><label className="form-label">Radius</label><select className="form-input" value={filters.radiusKm} onChange={(e) => setFilters({ ...filters, radiusKm: e.target.value })}><option value="2">2 km</option><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select></div>
        <div className="form-group"><label className="form-label">Sort</label><select className="form-input" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="nearest">Nearest</option><option value="lowest_price">Lowest price</option><option value="highest_availability">Most availability</option></select></div>
        <div className="form-group"><label className="form-label">Max ₹ / hr</label><input className="form-input" type="number" min="0" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder="Any" /></div>
        <div className="form-group"><label className="form-label">Amenities</label><select className="form-input" value={filters.amenities} onChange={(e) => setFilters({ ...filters, amenities: e.target.value })}><option value="">Any</option><option value="covered">Covered</option><option value="cctv">CCTV</option><option value="security_guard">Security guard</option><option value="accessible">Accessible</option><option value="ev_charging">EV charging</option></select></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42 }}><input type="checkbox" checked={filters.available} onChange={(e) => setFilters({ ...filters, available: e.target.checked })} /> Available only</label>
        <button className="btn btn-primary" style={{ height: 42 }}><Search size={16} /> Search</button>
        <button className="btn btn-outline" type="button" onClick={locate} style={{ height: 42 }}><LocateFixed size={16} /> My location</button>
      </div>
    </form>

    <div className="map-workspace">
      <aside className="map-results" aria-label="Parking search results">
        <div className="map-results-head"><div><strong>Parking locations</strong><span>For your selected time</span></div><span className="badge badge-info">{locations.length}</span></div>
        <div className="map-result-list">
          {locations.map((location) => <article className="map-result-item" key={location._id}>
            <div className="map-result-title"><strong>{location.name}</strong><span className={`badge ${location.availability.available ? 'badge-green' : 'badge-red'}`}>{location.availability.isOpen ? `${location.availability.available} available` : 'Closed'}</span></div>
            <p><MapPin size={12} /> {location.address?.formattedAddress}</p>
            <div className="map-result-meta"><span>{location.distanceKm} km</span><strong>₹{location.pricePerHour}/hr</strong></div>
            {filters.vehicleType === 'ev' && <p><Zap size={12} /> Exact charging slot selected at booking</p>}
            <Link className="btn btn-primary btn-sm" to={queryFor(location)}>View & reserve</Link>
          </article>)}
          {!loading && locations.length === 0 && <div className="empty-state"><MapPin size={34} /><h3>No parking matches this time</h3><p>Try a wider radius, another time, or clear a filter.</p></div>}
        </div>
      </aside>
      <div className="map-canvas"><MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: 600, width: '100%' }}>
        <Recenter center={center} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle center={[center.lat, center.lng]} radius={Number(filters.radiusKm) * 1000} pathOptions={{ color: '#147d6f', fillOpacity: 0.05 }} />
        <Marker position={[center.lat, center.lng]} icon={markerIcon(true)}><Popup>Your search origin</Popup></Marker>
        {locations.map((location) => <Marker key={location._id} position={[location.location.coordinates[1], location.location.coordinates[0]]} icon={markerIcon(location.availability.available > 0)}><Popup><strong>{location.name}</strong><br />{location.availability.available} available<br />₹{location.pricePerHour}/hr<br /><Link to={queryFor(location)}>Reserve</Link></Popup></Marker>)}
      </MapContainer></div>
    </div>
  </div>;
}
