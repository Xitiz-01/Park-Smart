import { CalendarDays, Clock, MapPin, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/kit/StatusBadge';
import TicketStub from '@/components/kit/TicketStub';
import { SlotBoard, SlotTile } from '@/components/kit/SlotBoard';

// One product, three workspaces. Each tab shows a small working slice of that
// workspace built from the real kit, with illustrative data.

const audiences = [
  {
    id: 'drivers',
    label: 'Drivers',
    title: 'Book the space, not the search',
    points: [
      'Search by place and time, filtered to your vehicle',
      'Reserve capacity, or an exact EV charging bay',
      'Keep vehicles and bookings in one place, and cancel upcoming bookings yourself',
    ],
  },
  {
    id: 'operators',
    label: 'Operators',
    title: 'Run every location from one workspace',
    points: [
      'Set capacity, hours, vehicle types and hourly rates per location',
      'Manage EV bays, including taking a bay out for maintenance',
      'Check drivers in and out, and see occupancy on your dashboard',
    ],
  },
  {
    id: 'admins',
    label: 'Admins',
    title: 'Keep the network trustworthy',
    points: [
      'Review operator applications and verification evidence',
      'Approve, reject or ask for resubmission, with a full audit trail',
      'Oversee users, bookings and operators across the platform',
    ],
  },
];

function DriverPreview() {
  return (
    <div className="grid gap-3">
      <TicketStub stubValue="B4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">Riverside Multilevel</p>
          <StatusBadge status="upcoming" />
        </div>
        <ul className="mt-2 grid gap-1 text-sm text-text-muted">
          <li className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4" />Today</li>
          <li className="flex items-center gap-2"><Clock aria-hidden="true" className="size-4" /><span className="font-mono">10:00–12:00</span></li>
          <li className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-4" />0.4 km away</li>
        </ul>
      </TicketStub>
      <TicketStub stubValue="EV02">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">Station Road EV Hub</p>
          <StatusBadge status="completed" />
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-text-muted"><Zap aria-hidden="true" className="size-4 text-slot-ev" />60 kW · CCS2</p>
      </TicketStub>
    </div>
  );
}

function OperatorPreview() {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Riverside Multilevel</p>
          <p className="text-sm text-text-muted">Cars, motorcycles and EVs</p>
        </div>
        <StatusBadge status="active" />
      </div>
      <div>
        <div className="flex justify-between text-sm"><span className="text-text-muted">Car capacity in use</span><span><span className="font-mono font-semibold">28</span> of <span className="font-mono">40</span></span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true"><div className="h-full w-[70%] rounded-full bg-brand" /></div>
      </div>
      <SlotBoard label="Sample EV bays at this location" className="grid-cols-3 sm:grid-cols-3">
        <SlotTile id="EV01" powerKw={22} detail="22 kW" state="occupied" ev />
        <SlotTile id="EV02" powerKw={60} detail="60 kW" state="available" ev />
        <SlotTile id="EV03" powerKw={22} detail="22 kW" state="maintenance" ev />
      </SlotBoard>
    </div>
  );
}

const applications = [
  { name: 'Riverside Parking Co.', status: 'under_review' },
  { name: 'Station Road Lots', status: 'verified' },
  { name: 'Hilltop Garage', status: 'resubmission_required' },
];

function AdminPreview() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <p className="border-b bg-surface-sunken px-4 py-2.5 text-sm font-medium text-text-muted">Operator verification</p>
      <ul>
        {applications.map((app) => (
          <li key={app.name} className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-0">
            <span className="min-w-0 truncate font-medium">{app.name}</span>
            <StatusBadge status={app.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const previews = { drivers: DriverPreview, operators: OperatorPreview, admins: AdminPreview };

export default function Audiences() {
  return (
    <section id="who-its-for" aria-labelledby="audiences-title" className="scroll-mt-16 border-t bg-surface-raised">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <h2 id="audiences-title" className="max-w-2xl font-display text-display-xl font-semibold text-balance">One platform, three workspaces.</h2>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">Drivers, parking operators and administrators each get a workspace built for their job.</p>
        <Tabs defaultValue="drivers" className="mt-10">
          <TabsList aria-label="Who it’s for" className="h-11">
            {audiences.map((a) => <TabsTrigger key={a.id} value={a.id} className="px-4">{a.label}</TabsTrigger>)}
          </TabsList>
          {audiences.map((a) => {
            const Preview = previews[a.id];
            return (
              <TabsContent key={a.id} value={a.id} className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-14">
                <div>
                  <h3 className="font-display text-display-md font-semibold">{a.title}</h3>
                  <ul className="mt-5 grid gap-3">
                    {a.points.map((point) => (
                      <li key={point} className="flex gap-3 text-pretty">
                        <span aria-hidden="true" className="mt-2.5 h-0.5 w-4 shrink-0 rounded-full bg-road-yellow" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-xs text-text-muted">Illustrative</p>
                  <Preview />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </section>
  );
}
