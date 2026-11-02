import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Power } from 'lucide-react';
import { toast } from 'sonner';
import { vendorsAPI } from '../../services/api';
import ParkingLocationForm from '../../components/vendor/ParkingLocationForm';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import { ErrorState } from '@/components/kit/EmptyState';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';

export default function ParkingLocationEditor() {
  const confirm = useConfirm();
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    vendorsAPI.getLocation(id)
      .then(({ data }) => setLocation(data.location))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  const save = async (payload) => {
    setSaving(true);
    try {
      if (id) await vendorsAPI.updateLocation(id, payload);
      else await vendorsAPI.createLocation(payload);
      toast.success(id ? 'Parking location updated' : 'Parking location created');
      navigate('/vendor/locations');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save parking location');
    } finally { setSaving(false); }
  };

  const deactivate = async () => {
    if (!(await confirm({
      title: `Deactivate ${location?.name || 'this location'}?`,
      description: 'Drivers can no longer book it and its available EV bays go into maintenance. Booking history is kept.',
      confirmLabel: 'Deactivate location', cancelLabel: 'Keep it live', tone: 'danger',
    }))) return;
    try {
      await vendorsAPI.deactivateLocation(id);
      toast.success('Parking location deactivated');
      navigate('/vendor/locations');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to deactivate location'); }
  };

  const header = (
    <PageHeader
      eyebrow="Operator"
      title={id ? (location?.name || 'Edit location') : 'Add a location'}
      description="Details, address, prices and hours, then capacity. Review everything before saving."
      actions={id && location?.status === 'active' && (
        <Button variant="outline" className="text-danger hover:text-danger" onClick={deactivate}><Power data-icon="inline-start" />Deactivate</Button>
      )}
    />
  );

  if (loading) return <>{header}<ListSkeleton rows={2} /></>;
  if (failed) return <>{header}<ErrorState description="This location didn’t load. Check your connection and try again." onRetry={load} /></>;
  return <>{header}<ParkingLocationForm initialLocation={location} onSubmit={save} saving={saving} /></>;
}
