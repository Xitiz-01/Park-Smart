import { Bike, Car, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Reserved slot for a maker's logo. Logo lookups (e.g. Logo.dev) come in a
// later phase; until then a generic vehicle icon stands in.
export default function VehicleBrandLogo({ make, vehicleType, electric = false, className }) {
  const Icon = vehicleType === 'motorcycle' ? Bike : Car;
  return (
    <span title={make || undefined} className={cn('relative grid size-11 shrink-0 place-items-center rounded-lg bg-surface-sunken text-text-muted', className)}>
      <Icon aria-hidden="true" className="size-5" />
      {electric && <Zap aria-hidden="true" className="absolute -right-1 -bottom-1 size-4 rounded-full bg-surface-raised p-0.5 text-slot-ev" />}
    </span>
  );
}
