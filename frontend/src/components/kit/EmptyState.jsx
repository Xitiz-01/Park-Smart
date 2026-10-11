import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

// An empty parking bay seen from above: two painted lines and a kerb stop.
export function EmptyBayIllustration({ className }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-16 text-border-strong', className)}>
      <path d="M14 8v48M50 8v48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 56h36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 6" />
      <rect x="24" y="12" width="16" height="4" rx="2" className="fill-road-yellow" />
    </svg>
  );
}

// Empty screens are an invitation to act: say what is missing and put the
// next action (children) right there.
export default function EmptyState({ icon, title, description, children, className }) {
  return (
    <Empty className={cn('border border-dashed bg-card', className)}>
      <EmptyHeader>
        <EmptyMedia>{icon || <EmptyBayIllustration />}</EmptyMedia>
        <EmptyTitle className="font-display text-lg">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

// Load failures used to leave a blank screen (audit R). Say what failed and
// offer the retry right there.
export function ErrorState({ title = 'This didn’t load', description, onRetry, className }) {
  return (
    <Empty role="alert" className={cn('border border-dashed border-danger/40 bg-card', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-danger-soft text-danger"><AlertTriangle /></EmptyMedia>
        <EmptyTitle className="font-display text-lg">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}><RefreshCw data-icon="inline-start" />Try again</Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
