import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';
import ParkingLocationForm from '../../components/vendor/ParkingLocationForm';

export default function ParkingLocationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (id) vendorsAPI.getLocation(id).then(({ data }) => setLocation(data.location)).catch((error) => toast.error(error.response?.data?.message || 'Unable to load location')).finally(() => setLoading(false)); }, [id]);
  const save = async (payload) => { setSaving(true); try { if (id) await vendorsAPI.updateLocation(id, payload); else await vendorsAPI.createLocation(payload); toast.success(id ? 'Parking location updated' : 'Parking location created'); navigate('/vendor/locations'); } catch (error) { toast.error(error.response?.data?.message || 'Unable to save parking location'); } finally { setSaving(false); } };
  const deactivate = async () => { if (!window.confirm('Deactivate this parking location? Existing history will be retained.')) return; try { await vendorsAPI.deactivateLocation(id); toast.success('Parking location deactivated'); navigate('/vendor/locations'); } catch (error) { toast.error(error.response?.data?.message || 'Unable to deactivate location'); } };
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return <div className="fade-in"><div className="page-header flex items-center justify-between"><div><h1>{id ? 'Manage Parking Location' : 'Add Parking Location'}</h1><p>Configure the address, map position, pricing, hours, and amenities</p></div>{id && location?.status === 'active' && <button className="btn btn-danger" onClick={deactivate}>Deactivate</button>}</div><ParkingLocationForm initialLocation={location} onSubmit={save} saving={saving} /></div>;
}
