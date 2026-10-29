import { Fragment, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import { ChevronsLeft, ChevronsRight, LogOut, Menu, MoreHorizontal, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Brand, { Logomark } from '@/components/kit/Brand';
import { BayLoader } from '@/components/kit/Loaders';
import ThemeToggle from '@/components/kit/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { breadcrumbsFor } from './navigation';

// The driver and operator workspaces. Sidebar on desktop (collapsible), a
// bottom tab bar for drivers on phones, a sheet menu for everything else,
// breadcrumbs, a command menu (⌘K / Ctrl+K) and a user menu.

const COLLAPSE_KEY = 'parksmart-sidebar-collapsed';
const readCollapsed = () => { try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };
const writeCollapsed = (value) => { try { window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0'); } catch { /* storage unavailable */ } };

// A thin signage stripe in the role's colour: blue for drivers, road-paint
// yellow for operators. Deliberately not a status colour.
const roleStripe = { driver: 'bg-brand', operator: 'bg-road-yellow' };

function useSignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await logout();
      toast.success('Signed out');
      navigate('/login');
    } catch {
      toast.error('Sign-out didn’t complete. Try again.');
    }
  }, [logout, navigate]);
}

function NavList({ workspace, collapsed = false, onNavigate, layoutGroup }) {
  return (
    <ul className="grid list-none gap-0.5 p-0">
      {workspace.nav.map(({ to, icon: Icon, label, end }) => {
        const link = (
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors pointer-coarse:h-11',
              isActive ? 'text-foreground' : 'text-text-muted hover:bg-surface-sunken hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <m.span
                    // Separate ids per sidebar width: the marker slides between
                    // pages, but must not animate across a collapse (the links
                    // remount while the width transitions and it stuck huge).
                    layoutId={`${layoutGroup}-${collapsed ? 'collapsed' : 'expanded'}`}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg bg-brand-soft"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  >
                    <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand" />
                  </m.span>
                )}
                <Icon aria-hidden="true" className={cn('relative size-[1.125rem] shrink-0', isActive && 'text-brand-strong')} />
                <span className={cn('relative truncate', collapsed && 'sr-only')}>{label}</span>
              </>
            )}
          </NavLink>
        );
        return (
          <li key={to}>
            {collapsed ? (
              <Tooltip>
                {/* A wrapper, not asChild on the link: Slot can't merge NavLink's
                    function className, so the link lost its classes (and the
                    active marker grew to cover the whole collapsed sidebar). */}
                <TooltipTrigger asChild><span className="block">{link}</span></TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : link}
          </li>
        );
      })}
    </ul>
  );
}

function Identity({ identity, collapsed }) {
  const initial = (identity.name || 'P').charAt(0).toUpperCase();
  return (
    <div className={cn('flex items-center gap-3 rounded-lg p-2', collapsed && 'justify-center p-0')}>
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken font-display font-semibold text-foreground">{initial}</span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{identity.name}</span>
          <span className="block truncate text-xs text-text-muted">{identity.subtitle}</span>
        </span>
      )}
    </div>
  );
}

// Defined at module level so it keeps its identity between renders (the old
// shell recreated it on every render).
function Sidebar({ workspace, identity, collapsed, onToggle }) {
  return (
    <aside
      aria-label={`${workspace.label} workspace`}
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <span aria-hidden="true" className={cn('h-1 w-full', roleStripe[workspace.id])} />
      <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center px-0' : 'justify-between')}>
        <Link to={workspace.home} aria-label="ParkSmart workspace home" className="rounded-md">
          {collapsed ? <Logomark /> : <Brand />}
        </Link>
      </div>
      {!collapsed && (
        <p className="mx-4 mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium text-text-muted">
          <span aria-hidden="true" className={cn('size-1.5 rounded-[1px]', roleStripe[workspace.id])} />
          {workspace.label}
        </p>
      )}
      <nav aria-label={`${workspace.label} navigation`} className="flex-1 overflow-y-auto px-3">
        <NavList workspace={workspace} collapsed={collapsed} layoutGroup="sidebar-active" />
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-t p-3">
        <Identity identity={identity} collapsed={collapsed} />
        <Button variant="ghost" size={collapsed ? 'icon' : 'default'} onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn(!collapsed && 'justify-start text-text-muted')}>
          {collapsed ? <ChevronsRight /> : <><ChevronsLeft data-icon="inline-start" />Collapse</>}
        </Button>
      </div>
    </aside>
  );
}

function CommandMenu({ workspace, open, onOpenChange }) {
  const navigate = useNavigate();
  const go = (to) => { onOpenChange(false); navigate(to); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Go to" description="Jump to a page or start a common task.">
      <Command>
        <CommandInput placeholder="Where to?" aria-label="Search pages and actions" />
        <CommandList>
          <CommandEmpty>Nothing matches. Try a page name like “bookings”.</CommandEmpty>
          <CommandGroup heading="Pages">
            {workspace.nav.map(({ to, icon: Icon, label }) => (
              <CommandItem key={to} value={`page ${label}`} onSelect={() => go(to)}><Icon aria-hidden="true" />{label}</CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            {workspace.actions.map(({ to, icon: Icon, label }) => (
              <CommandItem key={label} value={`action ${label}`} onSelect={() => go(to)}><Icon aria-hidden="true" />{label}</CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function UserMenu({ workspace, identity }) {
  const signOut = useSignOut();
  const profilePath = workspace.id === 'driver' ? '/dashboard/profile' : '/vendor/profile';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-lg">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-surface-sunken font-display text-sm font-semibold text-foreground">
            {(identity.name || 'P').charAt(0).toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium text-foreground">{identity.name}</span>
          <span className="block truncate text-xs text-text-muted">{identity.subtitle}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to={profilePath}><UserRound aria-hidden="true" />Profile</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Breadcrumbs({ workspace, pathname }) {
  const trail = breadcrumbsFor(workspace, pathname);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="m-0 list-none flex-nowrap p-0">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem className={cn('min-w-0', !last && 'hidden sm:inline-flex')}>
                {last ? <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  : <BreadcrumbLink asChild><Link to={crumb.to}>{crumb.label}</Link></BreadcrumbLink>}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function MobileMenu({ workspace, identity, open, onOpenChange }) {
  const signOut = useSignOut();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(18rem,85vw)] gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle><Brand size="sm" /></SheetTitle>
          <SheetDescription>{workspace.label} workspace</SheetDescription>
        </SheetHeader>
        <nav aria-label={`${workspace.label} navigation`} className="flex-1 overflow-y-auto p-3">
          <NavList workspace={workspace} onNavigate={() => onOpenChange(false)} layoutGroup="sheet-active" />
        </nav>
        <div className="grid gap-2 border-t p-3">
          <Identity identity={identity} />
          <Button variant="outline" onClick={signOut}><LogOut data-icon="inline-start" />Sign out</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Drivers get the four places they use most as a bottom tab bar on phones.
function TabBar({ workspace, onMore }) {
  const tabs = workspace.nav.filter((item) => item.tab);
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid list-none grid-cols-5 p-0">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium', isActive ? 'text-brand-strong' : 'text-text-muted')}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="max-w-full truncate px-1">{label}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMore} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-text-muted">
            <MoreHorizontal aria-hidden="true" className="size-5" />More
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default function WorkspaceShell({ workspace, identity }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const hasTabs = workspace.nav.some((item) => item.tab);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => setCollapsed((value) => { writeCollapsed(!value); return !value; });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#workspace-main" className="sr-only z-50 rounded-md bg-brand px-4 py-2 text-brand-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Sidebar workspace={workspace} identity={identity} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-surface/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:px-6">
          <Button variant="ghost" size="icon" className={cn('lg:hidden', hasTabs && 'max-lg:hidden')} aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <Link to={workspace.home} aria-label="ParkSmart workspace home" className="rounded-md lg:hidden"><Logomark className="size-7" /></Link>
          <div className="min-w-0 flex-1 px-1"><Breadcrumbs workspace={workspace} pathname={pathname} /></div>
          <Button variant="outline" className="hidden h-9 gap-2 px-3 text-text-muted sm:inline-flex" onClick={() => setCommandOpen(true)}>
            <Search data-icon="inline-start" />Go to…<Kbd className="ml-2">⌘K</Kbd>
          </Button>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Go to a page" onClick={() => setCommandOpen(true)}><Search /></Button>
          <ThemeToggle />
          <UserMenu workspace={workspace} identity={identity} />
        </header>
        <main id="workspace-main" className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8', hasTabs && 'pb-28 lg:pb-8')}>
          <Suspense fallback={<div className="grid min-h-[50vh] place-items-center"><BayLoader /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {hasTabs && <TabBar workspace={workspace} onMore={() => setMenuOpen(true)} />}
      <MobileMenu workspace={workspace} identity={identity} open={menuOpen} onOpenChange={setMenuOpen} />
      <CommandMenu workspace={workspace} open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
