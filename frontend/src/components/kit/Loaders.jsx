import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Skeletons shaped like the content they stand in for, so nothing jumps when
// data arrives. Each wrapper carries the one accessible "Loading…" label.

function LoadingRegion({ label = 'Loading…', className, children }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="contents">{children}</div>
    </div>
  );
}

export function MetricGridSkeleton({ count = 4, className }) {
  return (
    <LoadingRegion className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border bg-card p-5">
          <Skeleton className="size-10 rounded-lg" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

export function ListSkeleton({ rows = 3, className }) {
  return (
    <LoadingRegion className={cn('grid gap-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function TableSkeleton({ rows = 5, columns = 4, className }) {
  return (
    <LoadingRegion className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex gap-4 border-b bg-surface-sunken px-4 py-3">
        {Array.from({ length: columns }, (_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b px-4 py-4 last:border-0">
          {Array.from({ length: columns }, (_, c) => <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-32')} />)}
        </div>
      ))}
    </LoadingRegion>
  );
}

export function CardGridSkeleton({ count = 3, className }) {
  return (
    <LoadingRegion className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="mt-3 h-9 w-full rounded-lg" />
        </div>
      ))}
    </LoadingRegion>
  );
}

// Inline loader in the bay-line motif: three painted dashes filling in turn.
// Static under reduced motion (the global rule stops the animation).
export function BayLoader({ label = 'Loading…', className }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-1', className)}>
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-1 w-3 animate-pulse rounded-full bg-brand"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
