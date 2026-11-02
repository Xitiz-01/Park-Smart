import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { vehicleCatalogAPI, vehiclesAPI } from '../../services/api';
import {
  applyCatalogDetails,
  isElectricVehicle,
  physicalVehicleType,
  vehicleFormPayload,
} from '../../utils/hybridParking';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { CardGridSkeleton } from '@/components/kit/Loaders';
import NumberPlate from '@/components/kit/NumberPlate';
import PageHeader from '@/components/kit/PageHeader';
import SearchableSelect from '@/components/kit/SearchableSelect';
import StatusBadge from '@/components/kit/StatusBadge';
import VehicleBrandLogo from '@/components/kit/VehicleBrandLogo';
import { optionLabel, vehicleLabel } from '@/lib/vehicles';

const VEHICLE_TYPES = ['car', 'motorcycle'];
const BODY_STYLES = ['hatchback', 'sedan', 'suv', 'crossover', 'coupe', 'wagon', 'convertible', 'pickup', 'van', 'mpv', 'other'];
const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'hybrid', 'electric'];

const emptyForm = {
  licensePlate: '', make: '', brand: '', model: '', modelYear: '',
  vehicleType: '', bodyStyle: '', fuelType: '', color: '', isDefault: false,
};



function VehicleCard({ vehicle, onEdit, onRemove }) {
  const electric = isElectricVehicle(vehicle);
  const make = vehicle.make || vehicle.brand;
  const name = [make, vehicle.model, vehicle.modelYear].filter(Boolean).join(' ');
  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-hairline">
      <div className="flex items-start justify-between gap-3">
        <NumberPlate plate={vehicle.licensePlate} electric={electric} />
        {vehicle.isDefault && <StatusBadge tone="info">Default</StatusBadge>}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <VehicleBrandLogo make={make} vehicleType={physicalVehicleType(vehicle)} electric={electric} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-semibold">{name || 'Vehicle details not set'}</h2>
          <p className="text-sm text-text-muted">{vehicleLabel(vehicle)}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-text-muted">Colour</dt>
        <dd className="m-0">{vehicle.color || 'Not set'}</dd>
        <dt className="text-text-muted">Parks in</dt>
        <dd className="m-0">{electric ? 'An exact EV bay' : 'Any free space'}</dd>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button variant="outline" size="sm" onClick={() => onEdit(vehicle)}>
          <Pencil data-icon="inline-start" />Edit<span className="sr-only"> {vehicle.licensePlate}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => onRemove(vehicle)}>
          <Trash2 data-icon="inline-start" />Remove<span className="sr-only"> {vehicle.licensePlate}</span>
        </Button>
      </div>
    </article>
  );
}

export default function VehiclesPage() {
  const confirm = useConfirm();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [makeError, setMakeError] = useState('');
  const [modelError, setModelError] = useState('');
  const [yearError, setYearError] = useState('');

  const fetchVehicles = useCallback(() => {
    setFailed(false);
    return vehiclesAPI.getAll()
      .then((res) => setVehicles(res.data.vehicles))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const loadMakes = useCallback(async () => {
    setMakesLoading(true); setMakeError('');
    try {
      const { data } = await vehicleCatalogAPI.getBrands();
      setMakes(data.makes || data.brands || []);
    } catch (error) {
      setMakeError(error.response?.data?.message || 'Unable to load vehicle makes');
    } finally { setMakesLoading(false); }
  }, []);

  const loadModels = useCallback(async (make, legacyModel = '') => {
    if (!make) { setModels([]); return; }
    setModelsLoading(true); setModelError('');
    try {
      const { data } = await vehicleCatalogAPI.getModels({ make });
      setModels(data.models || []);
    } catch (error) {
      if (legacyModel) setModels([{ make, model: legacyModel }]);
      setModelError(error.response?.data?.message || 'Unable to load models');
    } finally { setModelsLoading(false); }
  }, []);

  const loadYears = useCallback(async (make, model, legacyYear = '') => {
    if (!make || !model) { setYears([]); return; }
    setYearsLoading(true); setYearError('');
    try {
      const { data } = await vehicleCatalogAPI.getYears({ make, model });
      setYears(data.years || []);
    } catch (error) {
      setYears(legacyYear ? [Number(legacyYear)] : []);
      setYearError(error.response?.data?.message || 'Model years unavailable; enter one if known');
    } finally { setYearsLoading(false); }
  }, []);

  useEffect(() => { if (showForm) loadMakes(); }, [showForm, loadMakes]);

  const makeOptions = useMemo(() => (
    editingId && form.make && !makes.includes(form.make) ? [form.make, ...makes] : makes
  ), [makes, editingId, form.make]);
  const modelOptions = useMemo(() => models.map((item) => item.model), [models]);

  const selectMake = (make) => {
    setForm((current) => ({ ...current, make, brand: make, model: '', modelYear: '', bodyStyle: '', fuelType: '' }));
    setYears([]);
    loadModels(make);
  };

  const fetchAndApplyDetails = useCallback(async (make, model, modelYear) => {
    try {
      const { data } = await vehicleCatalogAPI.getDetails({ make, model, ...(modelYear ? { modelYear } : {}) });
      setForm((current) => applyCatalogDetails(current, data.vehicle));
    } catch (error) {
      setModelError(error.response?.data?.message || 'Unable to load model details');
    }
  }, []);

  const selectModel = (model) => {
    setForm((current) => ({ ...current, model, modelYear: '' }));
    if (!model) { setYears([]); return; }
    loadYears(form.make, model);
    fetchAndApplyDetails(form.make, model, '');
  };

  const selectYear = (modelYear) => {
    setForm((current) => ({ ...current, modelYear }));
    if (modelYear) fetchAndApplyDetails(form.make, form.model, modelYear);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const handleSave = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = vehicleFormPayload(form);
      if (editingId) await vehiclesAPI.update(editingId, payload);
      else await vehiclesAPI.add(payload);
      toast.success(editingId ? 'Vehicle updated' : 'Vehicle added');
      closeForm(); fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save vehicle');
    } finally { setSaving(false); }
  };

  const startAdd = () => {
    setEditingId(null); setForm(emptyForm); setModels([]); setYears([]); setShowForm(true);
  };

  const startEdit = (vehicle) => {
    const make = vehicle.make || vehicle.brand || '';
    setEditingId(vehicle._id);
    setForm({
      licensePlate: vehicle.licensePlate || '', make, brand: make, model: vehicle.model || '',
      modelYear: vehicle.modelYear || '', vehicleType: physicalVehicleType(vehicle),
      bodyStyle: vehicle.bodyStyle || (vehicle.vehicleType === 'suv' ? 'suv' : ''),
      fuelType: vehicle.fuelType || (isElectricVehicle(vehicle) ? 'electric' : ''),
      color: vehicle.color || '', isDefault: Boolean(vehicle.isDefault),
    });
    setShowForm(true);
    loadModels(make, vehicle.model);
    loadYears(make, vehicle.model, vehicle.modelYear);
  };

  const handleDelete = async (vehicle) => {
    if (!(await confirm({
      title: `Remove ${vehicle.licensePlate}?`,
      description: 'Existing bookings for it stay as they are. You can add it again later.',
      confirmLabel: 'Remove vehicle',
      cancelLabel: 'Keep vehicle',
      tone: 'danger',
    }))) return;
    try {
      await vehiclesAPI.delete(vehicle._id); toast.success('Vehicle removed'); fetchVehicles();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to remove'); }
  };

  const canSave = form.make && form.model && form.vehicleType && form.bodyStyle && form.fuelType;

  return (
    <>
      <PageHeader
        eyebrow="Driver"
        title="My vehicles"
        description={loading ? 'Loading your vehicles…' : `${vehicles.length} registered vehicle${vehicles.length === 1 ? '' : 's'}. Electric vehicles book an exact EV bay; everything else books a guaranteed space.`}
        actions={<Button onClick={startAdd}><Plus data-icon="inline-start" />Add vehicle</Button>}
      />

      {loading ? <CardGridSkeleton count={3} /> : failed ? (
        <ErrorState description="Your vehicles didn’t load. Check your connection and try again." onRetry={fetchVehicles} />
      ) : vehicles.length === 0 ? (
        <EmptyState title="No vehicles yet" description="Add the vehicle you drive so you can book a space for it.">
          <Button onClick={startAdd}><Plus data-icon="inline-start" />Add vehicle</Button>
        </EmptyState>
      ) : (
        <ul aria-label="Vehicles" className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <li key={vehicle._id} className="min-w-0">
              <VehicleCard vehicle={vehicle} onEdit={startEdit} onRemove={handleDelete} />
            </li>
          ))}
        </ul>
      )}

      <Sheet open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg">{editingId ? 'Edit vehicle' : 'Add a vehicle'}</SheetTitle>
            <SheetDescription>Pick the make and model; body style and fuel fill in from the catalogue where we know them.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 content-start gap-5 overflow-y-auto overscroll-contain p-4">
              <FormField label="Registration number" required>
                <Input
                  name="licensePlate"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="MH12AB1234…"
                  className="font-mono uppercase"
                  value={form.licensePlate}
                  onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
                />
              </FormField>
              <div className="grid gap-5 sm:grid-cols-2">
                <SearchableSelect label="Make" value={form.make} options={makeOptions} onChange={selectMake} placeholder="Search makes" loading={makesLoading} error={makeError} onRetry={loadMakes} required />
                <SearchableSelect label="Model" value={form.model} options={modelOptions} onChange={selectModel} placeholder={form.make ? 'Search models' : 'Choose a make first'} loading={modelsLoading} error={modelError} onRetry={() => loadModels(form.make, form.model)} disabled={!form.make} required />
              </div>
              <FormField label="Model year" description={yearError ? undefined : 'Optional'}>
                {years.length ? (
                  <NativeSelect className="w-full" value={form.modelYear} onChange={(e) => selectYear(e.target.value)} disabled={yearsLoading}>
                    <NativeSelectOption value="">Not specified</NativeSelectOption>
                    {years.map((year) => <NativeSelectOption key={year} value={year}>{year}</NativeSelectOption>)}
                  </NativeSelect>
                ) : (
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1886"
                    max={new Date().getFullYear() + 2}
                    placeholder={yearsLoading ? 'Loading…' : 'Enter year if known'}
                    value={form.modelYear}
                    onChange={(e) => selectYear(e.target.value)}
                    disabled={!form.model || yearsLoading}
                  />
                )}
              </FormField>
              {yearError && (
                <div role="alert" className="-mt-3 flex items-center justify-between gap-2 text-sm text-danger">
                  <span>{yearError}</span>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => loadYears(form.make, form.model, form.modelYear)}>
                    <RefreshCw data-icon="inline-start" />Retry
                  </Button>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField label="Type" required>
                  <NativeSelect className="w-full" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                    <NativeSelectOption value="" disabled>Select</NativeSelectOption>
                    {VEHICLE_TYPES.map((type) => <NativeSelectOption key={type} value={type}>{optionLabel(type)}</NativeSelectOption>)}
                  </NativeSelect>
                </FormField>
                <FormField label="Body style" required>
                  <NativeSelect className="w-full" value={form.bodyStyle} onChange={(e) => setForm({ ...form, bodyStyle: e.target.value })}>
                    <NativeSelectOption value="" disabled>Select</NativeSelectOption>
                    {BODY_STYLES.map((style) => <NativeSelectOption key={style} value={style}>{optionLabel(style)}</NativeSelectOption>)}
                  </NativeSelect>
                </FormField>
                <FormField label="Fuel" required>
                  <NativeSelect className="w-full" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                    <NativeSelectOption value="" disabled>Select</NativeSelectOption>
                    {FUEL_TYPES.map((type) => <NativeSelectOption key={type} value={type}>{optionLabel(type)}</NativeSelectOption>)}
                  </NativeSelect>
                </FormField>
              </div>
              {form.fuelType && (
                <p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-text-muted">
                  {form.fuelType === 'electric'
                    ? 'Electric: you’ll pick an exact EV charging bay when you book.'
                    : 'You’ll get a guaranteed space; the bay is assigned when you arrive.'}
                </p>
              )}
              <FormField label="Colour">
                <Input name="color" autoComplete="off" placeholder="White, black…" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </FormField>
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm({ ...form, isDefault: checked === true })} />
                Use as my default vehicle when booking
              </label>
            </div>
            <SheetFooter className="flex-row justify-end border-t">
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={saving || !canSave}>
                {saving && <Spinner data-icon="inline-start" />}
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add vehicle'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
