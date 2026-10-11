import { cn } from '@/lib/utils';

// Page title block. Same props as the legacy ui/PageHeader so screens can
// switch over without touching their content. `eyebrow` is for real context
// (the workspace or parent section), not decoration.
export default function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-sm font-medium text-text-muted">{eyebrow}</p>}
        <h1 className="font-display text-display-lg font-semibold text-balance text-foreground">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-pretty text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
