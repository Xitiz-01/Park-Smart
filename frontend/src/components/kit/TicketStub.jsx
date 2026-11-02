import { cn } from '@/lib/utils';

// A booking as a parking ticket: details on the left, a perforated tear line,
// and a stub carrying the bay. Used for bookings and confirmations.
//
//   <TicketStub stubLabel="Bay" stubValue="B4">…details…</TicketStub>
// `stub` replaces the label/value pair with custom content (e.g. a mini lot).
export default function TicketStub({ stubLabel = 'Bay', stubValue, stub, children, className }) {
  return (
    <article className={cn('relative flex overflow-hidden rounded-xl border bg-card shadow-hairline', className)}>
      <div className="min-w-0 flex-1 p-4">{children}</div>
      <div aria-hidden="true" className="relative w-px self-stretch border-l border-dashed border-border-strong/60">
        <span className="absolute -top-2 -left-2 size-4 rounded-full border bg-background" />
        <span className="absolute -bottom-2 -left-2 size-4 rounded-full border bg-background" />
      </div>
      {stub ? <div className="w-24 shrink-0 p-2 sm:w-28">{stub}</div> : (
        <div className="grid w-20 shrink-0 place-content-center gap-0.5 bg-surface-sunken/60 px-2 text-center sm:w-24">
          <span className="text-xs text-text-muted">{stubLabel}</span>
          <span className="font-mono text-xl font-semibold text-foreground">{stubValue}</span>
        </div>
      )}
    </article>
  );
}
