import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../utils/authRouting';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureBento from '@/components/landing/FeatureBento';
import Audiences from '@/components/landing/Audiences';
import Trust from '@/components/landing/Trust';
import Faq from '@/components/landing/Faq';
import FinalCta from '@/components/landing/FinalCta';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const { user } = useAuth();
  // Signed-in visitors go straight to their workspace; everyone else signs up.
  const primary = user
    ? { to: user.role === 'customer' ? '/dashboard/nearby' : getDefaultRoute(user), label: user.role === 'customer' ? 'Find parking' : 'Open your workspace' }
    : { to: '/register', label: 'Find parking' };
  let secondary = { to: '/register', label: 'List your parking' };
  if (user) secondary = user.role === 'customer' ? { to: '/vendor/apply', label: 'List your parking' } : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main" className="sr-only z-50 rounded-md bg-brand px-4 py-2 text-brand-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <LandingNav primary={user ? primary : { to: '/register', label: 'Get started' }} />
      <main id="main">
        <Hero primary={primary} secondary={secondary} />
        <HowItWorks />
        <FeatureBento />
        <Audiences />
        <Trust />
        <Faq />
        <FinalCta primary={user ? primary : { to: '/register', label: 'Get started' }} />
      </main>
      <LandingFooter />
    </div>
  );
}
