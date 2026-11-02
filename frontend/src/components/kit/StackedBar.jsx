import { cn } from '@/lib/utils';

// One horizontal bar split into parts, with every part's count written out
// in the legend, so the chart never depends on colour. Static on purpose.
//   segments: [{ label, value, className }]  (className sets the fill)
export default function StackedBar({ segments, total, label, className }) {
  const sum = total ?? segments.reduce((acc, segment) => acc + (Number(segment.value) || 0), 0);
  const summary = segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(', ');
  return (
    <figure className={cn('m-0', className)}>
      <div role="img" aria-label={`${label}: ${summary}, of ${sum}`} className="flex h-4 w-full overflow-hidden rounded-full bg-surface-sunken">
        {sum > 0 && segments.map((segment) => (
          segment.value > 0 && <span key={segment.label} className={cn('h-full border-r-2 border-card last:border-r-0', segment.className)} style={{ width: `${(segment.value / sum) * 100}%` }} />
        ))}
      </div>
      <figcaption>
        <dl className="m-0 mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('size-3 shrink-0 rounded-[3px]', segment.className)} />
              <dt className="text-text-muted">{segment.label}</dt>
              <dd className="m-0 ml-auto font-mono font-semibold tabular-nums">{segment.value}</dd>
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  );
}
