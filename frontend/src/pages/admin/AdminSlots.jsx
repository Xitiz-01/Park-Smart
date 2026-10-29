import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { slotsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import DataTable from '@/components/kit/DataTable';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';

const emptyForm = { slotNumber: '', floor: 'G', zone: 'A', type: 'standard', status: 'available', pricePerHour: 30, features: { hasCCTV: true, hasCover: false, hasEVCharger: false } };

const FLOORS = ['G', '1', '2', '3'];
const ZONES = ['A', 'B', 'C', 'D'];
const TYPES = [['standard', 'Standard'], ['compact', 'Compact'], ['disabled', 'Accessible'], ['ev', 'EV']];
const STATUSES = ['available', 'occupied', 'reserved', 'maintenance'];
// Was shown as 📷 🏠 ⚡, which screen readers read out (audit I).
const FEATURES = [['hasCCTV', 'CCTV'], ['hasCover', 'Covered'], ['hasEVCharger', 'EV charger']];
const typeLabel = (type) => (TYPES.find(([value]) => value === type) || [type, type])[1];
const cap = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default function AdminSlots() {
  const confirm = useConfirm();
  const [slots, setSlots] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [filters, setFilters] = useState({ zone: '', status: '' });

  const fetchSlots = useCallback(() => {
    const params = {};
    if (filters.zone) params.zone = filters.zone;
    if (filters.status) params.status = filters.status;
    setFailed(false);
    slotsAPI.getAll(params)
      .then((res) => { setSlots(res.data.slots); setStats(res.data.stats); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(fetchSlots, [fetchSlots]);

  const openAdd = () => { setEditSlot(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = useCallback((slot) => {
    setEditSlot(slot);
    setForm({ slotNumber: slot.slotNumber, floor: slot.floor, zone: slot.zone, type: slot.type, status: slot.status, pricePerHour: slot.pricePerHour, features: { ...slot.features } });
    setShowForm(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editSlot) {
        await slotsAPI.update(editSlot._id, form);
        toast.success('Bay updated');
      } else {
        await slotsAPI.create(form);
        toast.success('Bay added');
      }
      setShowForm(false);
      fetchSlots();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = useCallback(async (slot) => {
    if (!(await confirm({ title: `Delete bay ${slot.slotNumber}?`, description: 'This can’t be undone.', confirmLabel: 'Delete bay', cancelLabel: 'Keep bay', tone: 'danger' }))) return;
    try {
      await slotsAPI.delete(slot._id);
      toast.success('Bay deleted');
      fetchSlots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  }, [confirm, fetchSlots]);

  const handleSeed = async () => {
    if (!(await confirm({ title: 'Replace legacy bays with 60 sample bays?', description: 'Legacy admin-managed bays are replaced. Bays that belong to operators’ locations are kept.', confirmLabel: 'Replace with 60 bays', cancelLabel: 'Cancel', tone: 'danger' }))) return;
    setSeeding(true);
    try {
      const res = await slotsAPI.seed();
      toast.success(res.data.message);
      fetchSlots();
    } catch { toast.error('Seeding failed'); }
    finally { setSeeding(false); }
  };

  const columns = useMemo(() => [
    { id: 'bay', accessorKey: 'slotNumber', header: 'Bay', meta: { mobile: 'title' }, cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { id: 'status', accessorKey: 'status', header: 'Status', meta: { mobile: 'subtitle' }, cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
    {
      // Operator bays belong to a location; legacy bays have a floor and zone.
      id: 'where', accessorFn: (s) => (s.parkingLocation ? s.parkingLocation.name : `Floor ${s.floor}, zone ${s.zone}`), header: 'Where',
      cell: ({ row, getValue }) => <span><span className="block">{getValue()}</span><span className="block text-xs text-text-muted">{row.original.parkingLocation ? 'Operator location' : 'Legacy bay'}</span></span>,
    },
    { id: 'type', accessorFn: (s) => typeLabel(s.type), header: 'Type' },
    { id: 'rate', accessorFn: (s) => Number(s.pricePerHour) || 0, header: 'Rate', cell: ({ getValue }) => <span className="font-mono">₹{getValue()}/hr</span> },
    { id: 'features', accessorFn: (s) => FEATURES.filter(([key]) => s.features?.[key]).map(([, label]) => label).join(', ') || 'None', header: 'Features' },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' },
      cell: ({ row }) => (
        // Icon-only buttons had no name (audit F).
        <div className="flex gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={`Edit bay ${row.original.slotNumber}`} title="Edit" onClick={() => openEdit(row.original)}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" className="text-danger hover:text-danger" aria-label={`Delete bay ${row.original.slotNumber}`} title="Delete" onClick={() => handleDelete(row.original)}><Trash2 /></Button>
        </div>
      ),
    },
  ], [handleDelete, openEdit]);

  const setField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Tracked bays"
        description={loading ? 'Loading bays…' : `${stats.available ?? 0} free, ${stats.occupied ?? 0} occupied, ${stats.total ?? 0} in total. Individually tracked bays: operators’ EV bays and legacy admin bays.`}
        actions={(
          <>
            <Button variant="outline" onClick={handleSeed} disabled={seeding}>{seeding ? <Spinner data-icon="inline-start" /> : <Database data-icon="inline-start" />}{seeding ? 'Replacing…' : 'Replace with 60 bays'}</Button>
            <Button variant="outline" onClick={fetchSlots}><RefreshCw data-icon="inline-start" />Refresh</Button>
            <Button onClick={openAdd}><Plus data-icon="inline-start" />Add bay</Button>
          </>
        )}
      />

      {/* These filters had no labels (audit E). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:flex">
        <FormField label="Zone" className="sm:w-44">
          <NativeSelect className="w-full" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
            <NativeSelectOption value="">All zones</NativeSelectOption>
            {ZONES.map((z) => <NativeSelectOption key={z} value={z}>Zone {z}</NativeSelectOption>)}
          </NativeSelect>
        </FormField>
        <FormField label="Status" className="sm:w-44">
          <NativeSelect className="w-full" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            {STATUSES.map((s) => <NativeSelectOption key={s} value={s}>{cap(s)}</NativeSelectOption>)}
          </NativeSelect>
        </FormField>
      </div>

      {failed ? (
        <ErrorState description="Bays didn’t load. Check your connection and try again." onRetry={fetchSlots} />
      ) : (
        <DataTable
          columns={columns}
          data={slots}
          getRowId={(s) => s._id}
          loading={loading}
          pageSize={20}
          searchLabel="Search bays"
          searchPlaceholder="Bay, location or type…"
          empty={slots.length ? undefined : <EmptyState title="No bays match" description={filters.zone || filters.status ? 'Try other filters.' : 'Add a bay, or replace legacy bays with 60 sample bays.'} />}
        />
      )}

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg">{editSlot ? `Edit bay ${editSlot.slotNumber}` : 'Add a bay'}</SheetTitle>
            <SheetDescription>Legacy admin-managed bay. Operators manage their EV bays themselves.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
              <FormField label="Bay number" required description={editSlot ? 'Bay numbers can’t be changed.' : undefined}>
                <Input className="font-mono" autoComplete="off" spellCheck={false} placeholder="e.g. AG01…" value={form.slotNumber} onChange={setField('slotNumber')} disabled={Boolean(editSlot)} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Floor">
                  <NativeSelect className="w-full" value={form.floor} onChange={setField('floor')}>{FLOORS.map((f) => <NativeSelectOption key={f} value={f}>Floor {f}</NativeSelectOption>)}</NativeSelect>
                </FormField>
                <FormField label="Zone">
                  <NativeSelect className="w-full" value={form.zone} onChange={setField('zone')}>{ZONES.map((z) => <NativeSelectOption key={z} value={z}>Zone {z}</NativeSelectOption>)}</NativeSelect>
                </FormField>
                <FormField label="Type">
                  <NativeSelect className="w-full" value={form.type} onChange={setField('type')}>{TYPES.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect>
                </FormField>
                <FormField label="Status">
                  <NativeSelect className="w-full" value={form.status} onChange={setField('status')}>{STATUSES.map((s) => <NativeSelectOption key={s} value={s}>{cap(s)}</NativeSelectOption>)}</NativeSelect>
                </FormField>
              </div>
              <FormField label="Rate, ₹ per hour" required>
                <Input type="number" inputMode="numeric" min={1} className="font-mono" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: Number(e.target.value) })} />
              </FormField>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 text-sm font-medium">Features</legend>
                <div className="flex flex-wrap gap-4">
                  {FEATURES.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={Boolean(form.features[key])} onCheckedChange={(checked) => setForm({ ...form, features: { ...form.features, [key]: checked === true } })} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <SheetFooter className="flex-row justify-end border-t">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Spinner data-icon="inline-start" />}{saving ? 'Saving…' : editSlot ? 'Save changes' : 'Add bay'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
