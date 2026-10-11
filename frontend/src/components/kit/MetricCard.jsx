import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

const iconTones = {
  brand: 'bg-brand-soft text-brand-strong',
  available: 'bg-slot-available-soft text-slot-available',
  reserved: 'bg-slot-reserved-soft text-slot-reserved',
  occupied: 'bg-slot-occupied-soft text-slot-occupied',
  ev: 'bg-slot-ev-soft text-slot-ev',
  neutral: 'bg-surface-sunken text-text-muted',
};

const defaultFormat = (value) => new Intl.NumberFormat('en-IN').format(Math.round(value));

// Counts up from 0 the first time the card scrolls into view. Reduced motion
// (or a non-numeric value) shows the final value straight away.
function CountUp({ value, format }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const [shown, setShown] = useState(numeric && !reduceMotion ? 0 : value);

  useEffect(() => {
    if (!numeric || reduceMotion) { setShown(value); return undefined; }
    if (!inView) return undefined;
    const controls = animate(0, value, { duration: 0.8, ease: [0.2, 0.8, 0.2, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [value, numeric, inView, reduceMotion]);

  return <span ref={ref}>{numeric ? format(shown) : value}</span>;
}

export default function MetricCard({ label, value, detail, icon, tone = 'brand', format = defaultFormat, className }) {
  return (
    <article className={cn('flex items-start gap-4 rounded-xl border bg-card p-5 shadow-hairline', className)}>
      {icon && (
        <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5', iconTones[tone] || iconTones.brand)}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-text-muted">{label}</p>
        {/* The live region is the static final value so screen readers never hear the count. */}
        <p className="mt-1 font-display text-display-md font-semibold tabular-nums text-foreground">
          <span className="sr-only">{typeof value === 'number' ? format(value) : value}</span>
          <span aria-hidden="true"><CountUp value={value} format={format} /></span>
        </p>
        {detail && <p className="mt-1 text-sm text-text-muted">{detail}</p>}
      </div>
    </article>
  );
}
