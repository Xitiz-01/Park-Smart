import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Brand from '@/components/kit/Brand';
import ThemeToggle from '@/components/kit/ThemeToggle';
import { cn } from '@/lib/utils';

export const LANDING_SECTIONS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#who-its-for', label: 'Who it’s for' },
  { href: '#faq', label: 'FAQ' },
];

// Sticky nav: transparent over the hero, glass once the page scrolls.
export default function LandingNav({ primary }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200',
        scrolled ? 'border-border bg-surface/80 backdrop-blur-lg supports-[backdrop-filter]:bg-surface/70' : 'border-transparent bg-transparent',
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="ParkSmart home" className="rounded-md"><Brand /></Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {LANDING_SECTIONS.map((section) => (
            <li key={section.href}>
              <a href={section.href} className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:text-foreground">{section.label}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
          <Button asChild className="hidden sm:inline-flex"><Link to={primary.to}>{primary.label}</Link></Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,90vw)]">
              <SheetHeader>
                <SheetTitle><Brand size="sm" /></SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
              </SheetHeader>
              <ul className="grid gap-1 px-4">
                {LANDING_SECTIONS.map((section) => (
                  <li key={section.href}>
                    <SheetClose asChild>
                      <a href={section.href} className="block rounded-lg px-3 py-3 text-base text-foreground hover:bg-muted">{section.label}</a>
                    </SheetClose>
                  </li>
                ))}
              </ul>
              <div className="mt-auto grid gap-2 p-4">
                <Button asChild size="lg"><Link to={primary.to}>{primary.label}</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/login">Sign in</Link></Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
