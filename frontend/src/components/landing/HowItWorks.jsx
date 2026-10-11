import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { BEAT_FOR_STEP } from '@/components/lot/lotTimeline';

const LiveLot = lazy(() => import('@/components/lot/LiveLot'));

const steps = [
  {
    id: 'find',
    title: 'Find',
    body: 'Search around you or where you’re headed. Choose your vehicle and the time you need, and ParkSmart lists locations with room for it: live counts, distance and the hourly rate.',
  },
  {
    id: 'reserve',
    title: 'Reserve',
    body: 'Pick a location and confirm. Cars and motorcycles take a space from the lot’s capacity; electric vehicles choose the exact charging bay. The rate is fixed when you reserve.',
  },
  {
    id: 'park',
    title: 'Park',
    body: 'Drive in during your window. The operator checks you in and out, and the space is released for the next driver straight away.',
  },
];

// Desktop: the lot stays pinned while the three steps scroll past, and the
// step in the middle of the screen sets the lot's beat. Below lg the steps
// are a plain list (the hero already shows the lot).
export default function HowItWorks() {
  const [active, setActive] = useState('find');
  const refs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (visible.length) setActive(visible[0].target.dataset.step);
    }, { rootMargin: '-45% 0px -45% 0px' });
    Object.values(refs.current).forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-16 border-t bg-surface-raised">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <h2 id="how-title" className="max-w-2xl font-display text-display-xl font-semibold text-balance">Find, reserve, park.</h2>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">Three steps, and you know where you’re parking before you set off.</p>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <ol className="grid gap-6 lg:gap-0">
            {steps.map((step, index) => (
              <li
                key={step.id}
                ref={(node) => { refs.current[step.id] = node; }}
                data-step={step.id}
                className="lg:flex lg:min-h-[26rem] lg:items-center lg:last:min-h-[20rem]"
              >
                <div className="flex items-start gap-5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg font-mono text-base font-semibold transition-colors duration-200',
                    active === step.id ? 'bg-brand text-brand-foreground' : 'bg-surface-sunken text-text-muted',
                  )}
                >
                  {index + 1}
                </span>
                <div className="max-w-md">
                  <h3 className="font-display text-display-md font-semibold">
                    <span className="sr-only">Step {index + 1}: </span>{step.title}
                  </h3>
                  <p className="mt-2 text-pretty text-text-muted">{step.body}</p>
                </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <Suspense fallback={<div className="rounded-2xl bg-lot-asphalt" style={{ aspectRatio: '704 / 524' }} />}>
                <LiveLot variant="story" beat={BEAT_FOR_STEP[active]} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
