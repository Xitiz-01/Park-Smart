import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { vendorsAPI } from '../../services/api';
import useAvailabilitySocket from '../../hooks/useAvailabilitySocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTable from '@/components/kit/DataTable';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import { EvLotMap } from '@/components/kit/lotmap';
import { slotDisplayStatus, slotStateLabel } from '@/lib/slotStates';

const emptyForm = { slotNumber: '', prefix: 'EV', count: 4, vehicleType: 'ev', evCompatible: true, chargerType: 'CCS2', connectorType: 'CCS2', chargerPowerKw: 22 };
const STATUS_LABELS = { active: 'live', draft: 'draft', inactive: 'inactive' };

export default function VendorSlots() {
  const [params] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(params.get('location') || '');
  const [slots, setSlots] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsFailed, setLocationsFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState('');
  const [mode, setMode] = useState('bulk');
  const [form, setForm] = useState(emptyForm);

  // The location list used to fail silently and leave an empty page (audit R).
  const loadLocations = useCallback(() => {
    setLocationsLoading(true);
    setLocationsFailed(false);
    vendorsAPI.getLocations().then(({ data }) => {
      const evLocations = data.locations.filter((location) => location.evSupported && location.vehicleTypes.includes('ev'));
      setLocations(evLocations);
      setLocationId((current) => (evLocations.some((item) => item._id === current) ? current : evLocations[0]?._id || ''));
    }).catch(() => setLocationsFailed(true)).finally(() => setLocationsLoading(false));
  }, []);
  useEffect(loadLocations, [loadLocations]);

  const loadSlots = useCallback(async (id = locationId) => {
    if (!id) return setSlots([]);
    setLoading(true);
    try { const { data } = await vendorsAPI.getLocationSlots(id); setSlots(data.slots); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to load EV slots'); }
    finally { setLoading(false); }
  }, [locationId]);
  useEffect(() => { if (locationId) loadSlots(locationId); }, [locationId, loadSlots]);
  useAvailabilitySocket({ enabled: Boolean(locationId), locationId, debounceMs: 180, onChange: () => loadSlots(locationId) });
  const current = locations.find((location) => location._id === locationId);
  const canCreate = current?.status === 'active';

  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      if (mode === 'bulk') await vendorsAPI.bulkCreateSlots(locationId, form);
      else await vendorsAPI.createSlot(locationId, form);
      toast.success(mode === 'bulk' ? 'EV charging slots created' : 'EV charging slot created');
      setForm((value) => ({ ...value, slotNumber: '' }));
      await loadSlots();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to create EV slots'); }
    finally { setSaving(false); }
  };
  const setStatus = async (slot, status) => {
    setUpdating(slot._id);
    try { await vendorsAPI.updateSlot(slot._id, { status }); await loadSlots(); toast.success(status === 'maintenance' ? `${slot.slotNumber} is in maintenance` : `${slot.slotNumber} is back in service`); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update slot'); }
    finally { setUpdating(''); }
  };

  const columns = useMemo(() => [
    { id: 'bay', accessorKey: 'slotNumber', header: 'Bay', meta: { mobile: 'title' }, cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { id: 'status', accessorFn: (slot) => slotStateLabel(slotDisplayStatus(slot)), header: 'Live status', meta: { mobile: 'subtitle' }, cell: ({ row }) => <StatusBadge status={slotDisplayStatus(row.original)} /> },
    { id: 'charger', accessorFn: (slot) => slot.chargerType || '—', header: 'Charger' },
    { id: 'connector', accessorFn: (slot) => slot.connectorType || '—', header: 'Connector' },
    { id: 'power', accessorFn: (slot) => Number(slot.chargerPowerKw) || 0, header: 'Power', cell: ({ getValue }) => (getValue() ? <span className="font-mono">{getValue()} kW</span> : '—') },
    { id: 'rate', accessorFn: (slot) => Number(slot.pricePerHour) || 0, header: 'Rate', cell: ({ getValue }) => <span className="font-mono">₹{getValue()}/hr</span> },
    {
      id: 'action', header: <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' },
      cell: ({ row }) => {
        const slot = row.original;
        if (!['available', 'maintenance'].includes(slot.status)) return <span className="text-sm text-text-muted">In use</span>;
        const toMaintenance = slot.status === 'available';
        return (
          <Button variant="outline" size="sm" disabled={updating === slot._id} onClick={() => setStatus(slot, toMaintenance ? 'maintenance' : 'available')}>
            {updating === slot._id ? <Spinner data-icon="inline-start" /> : toMaintenance ? <Wrench data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {toMaintenance ? 'Put in maintenance' : 'Back in service'}<span className="sr-only"> {slot.slotNumber}</span>
          </Button>
        );
      },
    },
  // setStatus is rebuilt each render; it only reads `updating` and loadSlots.
  ], [updating, loadSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <PageHeader
      eyebrow="Operator"
      title="EV bays"
      description="Exact charging bays that drivers pick when they book. Cars and motorcycles use the capacity set on each location."
      actions={locationId && <Button variant="outline" onClick={() => loadSlots()} disabled={loading}><RefreshCw data-icon="inline-start" />Refresh</Button>}
    />
  );

  if (locationsLoading) return <>{header}<ListSkeleton rows={2} /></>;
  if (locationsFailed) return <>{header}<ErrorState description="Your locations didn’t load. Check your connection and try again." onRetry={loadLocations} /></>;
  if (!locations.length) {
    return (
      <>
        {header}
        <EmptyState title="No EV-enabled locations" description="Turn on EV charging and set an EV price on a location first.">
          <Button asChild><Link to="/vendor/locations">Go to locations</Link></Button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mb-6 max-w-sm">
        <FormField label="Location">
          <NativeSelect className="w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((location) => <NativeSelectOption key={location._id} value={location._id}>{location.name} ({STATUS_LABELS[location.status] || location.status})</NativeSelectOption>)}
          </NativeSelect>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <EvLotMap
            slots={slots}
            label={`${current?.name || 'Location'} EV bays`}
            aside={<p className="text-xs text-lot-text-muted">Live for the current hour</p>}
          />
          <section aria-labelledby="bays-title" className="min-w-0">
            <h2 id="bays-title" className="mb-3 font-display text-lg font-semibold">All bays</h2>
            <DataTable
              columns={columns}
              data={slots}
              getRowId={(slot) => slot._id}
              loading={loading && !slots.length}
              searchLabel="Search bays"
              searchPlaceholder="Search bays…"
              empty={<EmptyState title="No EV bays here yet" description={canCreate ? 'Add the charging bays at this location with the form.' : 'Publish this location, then add its charging bays.'} />}
            />
          </section>
        </div>

        <form onSubmit={submit} aria-labelledby="add-bays-title" className="h-fit rounded-2xl border bg-card p-5 shadow-hairline">
          <h2 id="add-bays-title" className="font-display text-lg font-semibold">Add bays</h2>
          <Tabs value={mode} onValueChange={setMode} className="mt-3">
            <TabsList aria-label="How many bays" className="w-full">
              <TabsTrigger value="bulk" className="flex-1">Several</TabsTrigger>
              <TabsTrigger value="single" className="flex-1">One</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-4 grid gap-4">
            {mode === 'bulk' ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prefix" required>
                  <Input className="font-mono" autoComplete="off" spellCheck={false} value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} />
                </FormField>
                <FormField label="How many" required>
                  <Input type="number" inputMode="numeric" min="1" max="200" className="font-mono" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
                </FormField>
              </div>
            ) : (
              <FormField label="Bay number" required>
                <Input className="font-mono" autoComplete="off" spellCheck={false} placeholder="EV07…" value={form.slotNumber} onChange={(e) => setForm({ ...form, slotNumber: e.target.value.toUpperCase() })} />
              </FormField>
            )}
            <FormField label="Charger type">
              <Input autoComplete="off" placeholder="DC fast / AC…" value={form.chargerType} onChange={(e) => setForm({ ...form, chargerType: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Connector">
                <Input autoComplete="off" placeholder="CCS2…" value={form.connectorType} onChange={(e) => setForm({ ...form, connectorType: e.target.value })} />
              </FormField>
              <FormField label="Power (kW)">
                <Input type="number" inputMode="decimal" min="0" max="1000" step="0.1" className="font-mono" value={form.chargerPowerKw} onChange={(e) => setForm({ ...form, chargerPowerKw: e.target.value })} />
              </FormField>
            </div>
          </div>
          {!canCreate && <p className="mt-4 rounded-lg bg-surface-sunken p-3 text-sm text-text-muted">Bays can be added once this location is live.</p>}
          <Button type="submit" className="mt-5 w-full" disabled={saving || !canCreate}>
            {saving ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            {saving ? 'Adding…' : mode === 'bulk' ? `Add ${form.count || 0} bays` : 'Add bay'}
          </Button>
        </form>
      </div>
    </>
  );
}
