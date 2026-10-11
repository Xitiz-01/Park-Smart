import { cn } from '@/lib/utils';
import { statusLabel, statusTone } from '@/lib/status';

const tones = {
  success: 'bg-slot-available-soft text-slot-available',
  warning: 'bg-slot-reserved-soft text-slot-reserved',
  danger: 'bg-slot-occupied-soft text-slot-occupied',
  info: 'bg-brand-soft text-brand-strong',
  neutral: 'bg-slot-maintenance-soft text-slot-maintenance',
  ev: 'bg-slot-ev-soft text-slot-ev',
};

// The one status badge: a small sign plate with a square "lamp" and a text
// label, so the state never depends on colour alone. Pass `tone` only to
// override the shared vocabulary in lib/status.js.
export default function StatusBadge({ status, tone, children, className }) {
  const resolvedTone = tone || statusTone(status);
  return (
    <span
      data-tone={resolvedTone}
      className={cn(
        'inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap',
        tones[resolvedTone] || tones.info,
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-[1px] bg-current" />
      {children || statusLabel(status)}
    </span>
  );
}
