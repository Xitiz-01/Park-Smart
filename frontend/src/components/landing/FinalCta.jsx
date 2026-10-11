import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { m, useInView, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';

// Asphalt band whose bay lines paint themselves in once, when it scrolls into
// view (static under reduced motion).
function BayLines() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  // Bays sit on the right half so the headline stays on clean asphalt.
  const lines = Array.from({ length: 7 }, (_, i) => 560 + i * 80);
  return (
    <svg ref={ref} viewBox="0 0 1040 220" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" className="absolute inset-0 size-full">
      {lines.map((x, i) => (
        <m.line
          key={x}
          x1={x} x2={x} y1="0" y2="120"
          className="stroke-lot-line"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.18"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: inView || reduce ? 1 : 0 }}
          transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
        />
      ))}
      <m.line
        x1="520" x2="1040" y1="180" y2="180"
        className="stroke-lot-dash" strokeWidth="5" strokeDasharray="34 26" opacity="0.5"
        initial={{ opacity: reduce ? 0.5 : 0 }}
        animate={{ opacity: inView || reduce ? 0.5 : 0 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.5 }}
      />
    </svg>
  );
}

export default function FinalCta({ primary }) {
  return (
    <section aria-labelledby="cta-title" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-lot-asphalt text-lot-text">
        <BayLines />
        <div className="relative grid gap-8 px-6 py-14 sm:px-12 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 id="cta-title" className="max-w-xl font-display text-display-xl font-semibold text-balance">Find a bay before you set off.</h2>
            <p className="mt-4 max-w-md text-lg text-lot-text-muted">Free to sign up. Search, reserve and drive straight in.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-lot-text text-lot-asphalt hover:bg-lot-text/90"><Link to={primary.to}>{primary.label}</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-lot-text hover:bg-white/10 hover:text-lot-text"><Link to="/login">Sign in</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
