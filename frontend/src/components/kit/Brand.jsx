import { cn } from '@/lib/utils';

// The mark: a parking-sign tile whose "P" stem is a painted bay line, with a
// road-paint dot in the counter for the destination. Same geometry as
// public/favicon.svg.
export function Logomark({ className }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-logo-tile" />
      <path
        d="M11 25V7.5h5.25a5.5 5.5 0 0 1 0 11H11"
        fill="none"
        className="stroke-logo-glyph"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.25" cy="13" r="1.9" className="fill-road-yellow" />
    </svg>
  );
}

const sizes = {
  sm: { mark: 'size-7', word: 'text-base' },
  md: { mark: 'size-8', word: 'text-lg' },
  lg: { mark: 'size-10', word: 'text-2xl' },
};

// Mark + wordmark. The visible "ParkSmart" text is the accessible name, so the
// mark stays hidden from assistive tech; wrap it in a Link for navigation.
export default function Brand({ size = 'md', className }) {
  const s = sizes[size] || sizes.md;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} translate="no">
      <Logomark className={s.mark} />
      <span className={cn('font-display font-bold tracking-[-0.02em] text-foreground', s.word)}>ParkSmart</span>
    </span>
  );
}
