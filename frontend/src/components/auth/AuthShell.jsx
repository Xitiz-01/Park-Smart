import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import Brand from '@/components/kit/Brand';
import ThemeToggle from '@/components/kit/ThemeToggle';

const LiveLot = lazy(() => import('@/components/lot/LiveLot'));

// Sign-in and sign-up frame: the form on concrete, and on large screens an
// asphalt panel with the mini Live Lot showing what the account is for.
export default function AuthShell({ title, description, children, footer }) {
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="ParkSmart home" className="rounded-md"><Brand /></Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-display-lg font-semibold text-balance">{title}</h1>
          {description && <p className="mt-2 text-text-muted">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-text-muted">{footer}</div>}
        </div>
      </main>

      <aside aria-label="What ParkSmart does" className="relative hidden overflow-hidden bg-lot-asphalt text-lot-text lg:flex lg:flex-col lg:justify-center lg:px-14">
        <p className="max-w-md font-display text-display-md font-semibold text-balance">
          See the free bays before you arrive, and drive straight into yours.
        </p>
        <div className="mt-10 w-full max-w-xl">
          <Suspense fallback={<div className="aspect-[512/468] rounded-2xl bg-lot-aisle" />}>
            <LiveLot variant="mini" className="shadow-none ring-white/10" />
          </Suspense>
          <p className="mt-3 text-xs text-lot-text-muted">Illustrative</p>
        </div>
      </aside>
    </div>
  );
}
