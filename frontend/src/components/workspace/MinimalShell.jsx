import { Link } from 'react-router-dom';
import Brand from '@/components/kit/Brand';
import ThemeToggle from '@/components/kit/ThemeToggle';
import { cn } from '@/lib/utils';

// Frame for pages outside a workspace (the vendor application and its
// status): brand, theme toggle and an optional action, then one column.
export default function MinimalShell({ actions, children, className }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#minimal-main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2">Skip to content</a>
      <header className="border-b bg-surface-raised">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/dashboard" aria-label="ParkSmart, back to your dashboard" className="rounded-md"><Brand /></Link>
          <div className="flex items-center gap-2">{actions}<ThemeToggle /></div>
        </div>
      </header>
      <main id="minimal-main" className={cn('mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14', className)}>{children}</main>
    </div>
  );
}
