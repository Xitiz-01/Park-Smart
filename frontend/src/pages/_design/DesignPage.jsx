import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Car, Gauge, MapPin, ParkingSquare, Plus, Zap } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Brand, { Logomark } from '@/components/kit/Brand';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import DataTable from '@/components/kit/DataTable';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { BayLoader, CardGridSkeleton, ListSkeleton, MetricGridSkeleton, TableSkeleton } from '@/components/kit/Loaders';
import MetricCard from '@/components/kit/MetricCard';
import PageHeader from '@/components/kit/PageHeader';
import SearchableSelect from '@/components/kit/SearchableSelect';
import { SlotBoard, SlotLegend, SlotTile } from '@/components/kit/SlotBoard';
import StatusBadge from '@/components/kit/StatusBadge';
import ThemeToggle from '@/components/kit/ThemeToggle';
import LiveLot from '@/components/lot/LiveLot';
import { CapacityLotMap, CapacityMini, EvBayMini, EvLotMap } from '@/components/kit/lotmap';
import { STATUS_TONES } from '@/lib/status';

// Dev-only style guide (/_design). Not routed in production builds.
// Sample data on this page is illustrative.

const swatches = [
  ['surface', 'bg-surface'], ['surface-raised', 'bg-surface-raised'], ['surface-sunken', 'bg-surface-sunken'],
  ['border', 'bg-border'], ['border-strong', 'bg-border-strong'], ['text', 'bg-text'], ['text-muted', 'bg-text-muted'],
  ['brand', 'bg-brand'], ['brand-strong', 'bg-brand-strong'], ['brand-soft', 'bg-brand-soft'],
  ['road-yellow', 'bg-road-yellow'], ['asphalt', 'bg-asphalt'], ['danger', 'bg-danger'],
  ['slot-available', 'bg-slot-available'], ['slot-reserved-solid', 'bg-slot-reserved-solid'], ['slot-occupied', 'bg-slot-occupied'],
  ['slot-ev', 'bg-slot-ev'], ['slot-maintenance', 'bg-slot-maintenance'], ['slot-unavailable', 'bg-slot-unavailable'],
];

const bays = [
  { value: 'a', id: 'EV01', powerKw: 22, detail: '22 kW', meta: 'Type 2', state: 'available' },
  { value: 'b', id: 'EV02', powerKw: 60, detail: '60 kW', meta: 'CCS2', state: 'available' },
  { value: 'c', id: 'EV03', powerKw: 22, detail: '22 kW', meta: 'Type 2', state: 'reserved' },
  { value: 'd', id: 'EV04', powerKw: 22, detail: '22 kW', meta: 'Type 2', state: 'maintenance' },
  { value: 'e', id: 'EV05', powerKw: 60, detail: '60 kW', meta: 'CCS2', state: 'occupied' },
  { value: 'f', id: 'EV06', powerKw: 11, detail: '11 kW', meta: 'Type 2', state: 'unavailable' },
];

const bookings = Array.from({ length: 14 }, (_, i) => ({
  code: `PKG-DEMO-${String(i + 1).padStart(3, '0')}`,
  location: ['FC Road Multilevel', 'Deccan Surface Lot', 'Baner Tech Park'][i % 3],
  bay: i % 4 === 0 ? `EV0${(i % 6) + 1}` : 'Capacity',
  status: ['upcoming', 'active', 'completed', 'cancelled'][i % 4],
  amount: 60 + (i % 5) * 20,
}));

const columns = [
  { accessorKey: 'code', header: 'Booking', meta: { mobile: 'title' }, cell: ({ getValue }) => <span className="font-mono">{getValue()}</span> },
  { accessorKey: 'location', header: 'Location', meta: { mobile: 'subtitle' } },
  { accessorKey: 'bay', header: 'Bay', cell: ({ getValue }) => <span className="font-mono">{getValue()}</span> },
  { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
  { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => <span className="font-mono">₹{getValue()}</span> },
  { id: 'actions', header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' }, cell: () => <Button variant="outline" size="sm">View</Button> },
];

function Section({ title, children }) {
  return (
    <section className="grid gap-5 border-t py-10 first:border-t-0">
      <h2 className="font-display text-display-md font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const confirm = useConfirm();
  const [bay, setBay] = useState('a');
  const [make, setMake] = useState('');
  const [radius, setRadius] = useState([5]);
  const [date, setDate] = useState(new Date());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="ParkSmart home"><Brand /></Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-text-muted sm:inline">Style guide · dev only</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Section title="Brand">
          <div className="flex flex-wrap items-center gap-8">
            <Brand size="sm" /><Brand /><Brand size="lg" />
            <Logomark className="size-16" />
          </div>
        </Section>

        <Section title="Live Lot">
          <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
            <LiveLot />
            <LiveLot variant="mini" />
          </div>
        </Section>

        <Section title="Lot Map">
          <p className="text-sm text-text-muted">Illustrative data. On product pages the Lot Map only ever draws real availability.</p>
          <EvLotMap
            slots={bays.map((b) => ({ _id: b.value, slotNumber: b.id, chargerPowerKw: b.powerKw, connectorType: b.meta, availabilityStatus: b.state, available: b.state === 'available' }))}
            selectedId={bay}
            onSelect={setBay}
            rate={60}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <CapacityLotMap total={70} reserved={52} available={18} windowLabel="Today, 10:00–12:00" vehicleLabel="car spaces" />
            <CapacityLotMap total={12} reserved={12} available={0} windowLabel="Today, 18:00–20:00" vehicleLabel="car spaces" />
          </div>
          <div className="flex flex-wrap items-stretch gap-4">
            <CapacityMini available={18} total={70} className="w-48" />
            <EvBayMini bayId="EV02" />
          </div>
        </Section>

        <Section title="Colour tokens">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {swatches.map(([name, cls]) => (
              <li key={name} className="overflow-hidden rounded-lg border bg-card">
                <div className={`h-14 ${cls}`} />
                <p className="px-3 py-2 font-mono text-xs">{name}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <div className="grid gap-4">
            <p className="font-display text-display-2xl font-bold">Parking, without the searching.</p>
            <p className="font-display text-display-xl font-semibold">Display XL · Find a bay</p>
            <p className="font-display text-display-lg font-semibold">Display LG · Reserve it</p>
            <p className="font-display text-display-md font-semibold">Display MD · Drive straight in</p>
            <p className="max-w-prose text-pretty">Body text in Geist. Live availability updates as bays are reserved, occupied and freed, so the number you see is the number that is there.</p>
            <p className="text-sm text-text-muted">Muted supporting text for metadata and hints.</p>
            <p className="font-mono text-lg">MH12 AB 1234 · EV02 · ₹60/hr · 0123456789</p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Reserve bay</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Cancel booking</Button>
            <Button disabled>Disabled</Button>
            <Button size="lg"><Plus data-icon="inline-start" />Add vehicle</Button>
            <Button size="sm">Small</Button>
            <Button size="icon" aria-label="Locate me"><MapPin /></Button>
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Licence plate" description="As printed on the plate, e.g. MH12AB1234." required>
              <Input name="plate" autoComplete="off" spellCheck={false} placeholder="MH12AB1234…" className="font-mono uppercase" />
            </FormField>
            <FormField label="Email" error="Enter an email address like name@example.com.">
              <Input type="email" name="email" autoComplete="email" defaultValue="not-an-email" />
            </FormField>
            <SearchableSelect label="Make" value={make} onChange={setMake} options={['Tata Motors', 'Mahindra', 'Maruti Suzuki', 'Hyundai', 'MG', 'Kia']} placeholder="Choose a make" required />
            <SearchableSelect label="Model" value="" onChange={() => {}} options={[]} placeholder="Choose a model" error="Couldn’t load models." onRetry={() => toast('Retrying…')} />
            <FormField label="Vehicle type">
              <Select defaultValue="car">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Fuel (native select)">
              <NativeSelect defaultValue="petrol" className="w-full">
                <NativeSelectOption value="petrol">Petrol</NativeSelectOption>
                <NativeSelectOption value="diesel">Diesel</NativeSelectOption>
                <NativeSelectOption value="electric">Electric</NativeSelectOption>
              </NativeSelect>
            </FormField>
            <FormField label="Notes for the operator">
              <Textarea placeholder="Optional…" />
            </FormField>
            <div className="grid gap-4">
              <label className="flex items-center gap-3 text-sm"><Checkbox defaultChecked />Set as default vehicle</label>
              <label className="flex items-center gap-3 text-sm"><Switch defaultChecked />Available only</label>
              <div className="grid gap-2">
                <span id="radius-label" className="text-sm font-medium">Radius: <span className="font-mono">{radius[0]} km</span></span>
                <Slider aria-labelledby="radius-label" min={1} max={20} step={1} value={radius} onValueChange={setRadius} />
              </div>
              <ToggleGroup type="single" defaultValue="nearest" variant="outline" aria-label="Sort results">
                <ToggleGroupItem value="nearest">Nearest</ToggleGroupItem>
                <ToggleGroupItem value="cheapest">Cheapest</ToggleGroupItem>
                <ToggleGroupItem value="available">Most free</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Card className="w-fit">
              <CardContent><Calendar mode="single" selected={date} onSelect={setDate} /></CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {Object.keys(STATUS_TONES).map((status) => <StatusBadge key={status} status={status} />)}
            <StatusBadge status="ev" tone="ev">EV bay</StatusBadge>
          </div>
        </Section>

        <Section title="Bays">
          <p className="text-sm text-text-muted">Illustrative bays. Arrow keys move between free bays; Enter selects.</p>
          <SlotBoard label="EV charging bays" onValueChange={setBay}>
            {bays.map((b) => (
              <SlotTile key={b.value} {...b} ev state={b.state === 'available' && b.value === bay ? 'selected' : b.state} />
            ))}
          </SlotBoard>
          <SlotLegend />
        </Section>

        <Section title="Page header and metrics">
          <PageHeader eyebrow="Driver workspace" title="Good to see you, Asha" description="Live availability and your upcoming bookings." actions={<Button><MapPin data-icon="inline-start" />Find parking</Button>} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Free bays nearby" value={128} detail="Illustrative" icon={<ParkingSquare />} tone="available" />
            <MetricCard label="Upcoming bookings" value={3} icon={<CalendarDays />} />
            <MetricCard label="EV bays free" value={7} icon={<Zap />} tone="ev" />
            <MetricCard label="Occupancy" value={62} format={(v) => `${Math.round(v)}%`} icon={<Gauge />} tone="reserved" />
          </div>
        </Section>

        <Section title="Data table">
          <DataTable columns={columns} data={bookings} getRowId={(row) => row.code} searchLabel="Search bookings" searchPlaceholder="Search bookings…" pageSize={5} toolbar={<Button variant="outline" size="sm">Export</Button>} />
        </Section>

        <Section title="Empty, error and loading">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState title="No vehicles yet" description="Add a vehicle so we can match you with bays that fit it.">
              <Button><Car data-icon="inline-start" />Add vehicle</Button>
            </EmptyState>
            <ErrorState description="We couldn’t reach the server. Check your connection and try again." onRetry={() => toast('Retrying…')} />
          </div>
          <MetricGridSkeleton />
          <div className="grid gap-4 md:grid-cols-2"><ListSkeleton /><CardGridSkeleton count={2} className="lg:grid-cols-2" /></div>
          <TableSkeleton rows={3} />
          <div className="flex items-center gap-3 text-sm text-text-muted"><BayLoader /> Inline loader</div>
          <Progress value={64} aria-label="Upload progress" />
        </Section>

        <Section title="Overlays and feedback">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="destructive" onClick={async () => { if (await confirm({ title: 'Cancel this booking?', description: 'The bay is released straight away.', confirmLabel: 'Cancel booking', cancelLabel: 'Keep booking', tone: 'danger' })) toast.success('Booking cancelled'); }}>Confirm dialog</Button>
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Booking details</DialogTitle><DialogDescription>Bay EV02 · 60 kW · CCS2</DialogDescription></DialogHeader>
                <DialogFooter><Button>Done</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">Sheet</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Filters</SheetTitle><SheetDescription>Narrow down the results.</SheetDescription></SheetHeader>
              </SheetContent>
            </Sheet>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
              <PopoverContent>Popover content anchored to its trigger.</PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline">Tooltip</Button></TooltipTrigger>
              <TooltipContent>B4 · Available · ₹60/hr</TooltipContent>
            </Tooltip>
            <Button variant="outline" onClick={() => toast.success('Bay EV02 reserved')}>Success toast</Button>
            <Button variant="outline" onClick={() => toast.error('That bay was just taken. Pick another.')}>Error toast</Button>
            <span className="text-sm text-text-muted">Command palette <Kbd>⌘</Kbd> <Kbd>K</Kbd></span>
          </div>
          <Tabs defaultValue="drivers" className="max-w-xl">
            <TabsList>
              <TabsTrigger value="drivers">Drivers</TabsTrigger>
              <TabsTrigger value="operators">Operators</TabsTrigger>
              <TabsTrigger value="admins">Admins</TabsTrigger>
            </TabsList>
            <TabsContent value="drivers" className="pt-3 text-sm text-text-muted">Find, reserve, park.</TabsContent>
            <TabsContent value="operators" className="pt-3 text-sm text-text-muted">Publish locations and run bays.</TabsContent>
            <TabsContent value="admins" className="pt-3 text-sm text-text-muted">Review operators and bookings.</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible className="max-w-xl">
            <AccordionItem value="a">
              <AccordionTrigger>How is availability kept current?</AccordionTrigger>
              <AccordionContent>Bays update when bookings are made, started, finished or cancelled.</AccordionContent>
            </AccordionItem>
          </Accordion>
          <Card className="max-w-sm">
            <CardHeader><CardTitle>Card</CardTitle><CardDescription>Hairline border, raised surface.</CardDescription></CardHeader>
            <CardContent className="text-sm text-text-muted">Used for grouped content.</CardContent>
          </Card>
        </Section>
      </main>
    </div>
  );
}
