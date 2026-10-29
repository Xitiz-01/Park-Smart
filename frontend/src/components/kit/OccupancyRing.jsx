import { cn } from '@/lib/utils';

// Free vs taken as a ring, with the numbers written out beside it so the chart
// never depends on colour. Blue and orange stay distinguishable for the common
// colour-vision deficiencies. Static on purpose: no stroke animation.
export default function OccupancyRing({ free = 0, total = 0, freeLabel = 'Free', takenLabel = 'Taken', className }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeFree = Math.min(safeTotal, Math.max(0, Number(free) || 0));
  const taken = safeTotal - safeFree;
  const takenShare = safeTotal ? taken / safeTotal : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(takenShare * 100);

  return (
    <figure className={cn('m-0 flex flex-wrap items-center gap-6', className)}>
      <svg viewBox="0 0 128 128" role="img" aria-label={`${safeFree} ${freeLabel.toLowerCase()} and ${taken} ${takenLabel.toLowerCase()} of ${safeTotal}`} className="size-36 shrink-0">
        <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="14" className="stroke-chart-1" />
        {taken > 0 && (
          <circle
            cx="64" cy="64" r={radius} fill="none" strokeWidth="14"
            strokeDasharray={`${circumference * takenShare} ${circumference}`}
            transform="rotate(-90 64 64)"
            className="stroke-chart-2"
          />
        )}
        <text x="64" y="64" textAnchor="middle" className="fill-foreground font-display text-[22px] font-semibold">{percent}%</text>
        <text x="64" y="80" textAnchor="middle" className="fill-text-muted text-[10px]">taken</text>
      </svg>
      <figcaption>
        <dl className="m-0 grid gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="size-3 rounded-[3px] bg-chart-1" />
            <dt className="text-text-muted">{freeLabel}</dt>
            <dd className="m-0 ml-auto pl-4 font-mono font-semibold tabular-nums">{safeFree}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="size-3 rounded-[3px] bg-chart-2" />
            <dt className="text-text-muted">{takenLabel}</dt>
            <dd className="m-0 ml-auto pl-4 font-mono font-semibold tabular-nums">{taken}</dd>
          </div>
          <div className="flex items-center gap-2.5 border-t pt-3">
            <span aria-hidden="true" className="size-3" />
            <dt className="text-text-muted">Total</dt>
            <dd className="m-0 ml-auto pl-4 font-mono font-semibold tabular-nums">{safeTotal}</dd>
          </div>
        </dl>
      </figcaption>
    </figure>
  );
}
