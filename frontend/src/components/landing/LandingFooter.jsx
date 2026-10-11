import { Link } from 'react-router-dom';
import Brand from '@/components/kit/Brand';
import { LANDING_SECTIONS } from './LandingNav';

export default function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <Link to="/" aria-label="ParkSmart home" className="inline-block rounded-md"><Brand size="sm" /></Link>
          <p className="mt-3 max-w-sm text-sm text-text-muted">Live parking availability, reservations and EV bay booking.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
          {LANDING_SECTIONS.map((section) => (
            <a key={section.href} href={section.href} className="text-text-muted hover:text-foreground">{section.label}</a>
          ))}
          <Link to="/login" className="text-text-muted hover:text-foreground">Sign in</Link>
          <Link to="/register" className="text-text-muted hover:text-foreground">Create an account</Link>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-6 text-sm text-text-muted sm:px-6 lg:px-8">© 2026 ParkSmart</p>
      </div>
    </footer>
  );
}
