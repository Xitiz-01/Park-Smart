import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Radio, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LiveLot = lazy(() => import('@/components/lot/LiveLot'));

const proof = [
  { icon: Radio, label: 'Live bay status' },
  { icon: Zap, label: 'EV bay booking' },
  { icon: ShieldCheck, label: 'Verified operators' },
];

// Same box as the lot (header + 8-column board + step bar) so loading it
// causes no layout shift.
function LotPlaceholder() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-lot-asphalt shadow-overlay">
      <div className="h-14" />
      <div className="aspect-[512/468] sm:aspect-[704/468]" />
      <div className="h-12" />
    </div>
  );
}

export default function Hero({ primary, secondary }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:px-8 lg:pt-20 lg:pb-24">
        <div className="max-w-xl">
          <h1 id="hero-title" className="font-display text-display-2xl font-bold text-balance text-foreground">
            Parking, without the searching.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg text-pretty text-text-muted">
            See which bays are free near you, reserve one for the time you need, and drive straight in.
            Driving electric? Pick the exact charging bay.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link to={primary.to}>{primary.label}</Link></Button>
            {secondary && <Button asChild size="lg" variant="outline"><Link to={secondary.to}>{secondary.label}</Link></Button>}
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="What ParkSmart does">
            {proof.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 rounded-lg border bg-surface-raised px-3 py-1.5 text-sm text-foreground shadow-hairline">
                <Icon aria-hidden="true" className="size-4 text-brand" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <Suspense fallback={<LotPlaceholder />}>
          <LiveLot />
        </Suspense>
      </div>
    </section>
  );
}
