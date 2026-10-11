// How an operator goes from sign-up to taking bookings, drawn as a route with
// stops. Mirrors the real onboarding and verification rules (README, Phase 5A).

const stops = [
  { title: 'Apply', body: 'An operator creates an account and applies with their business details.' },
  { title: 'Approval', body: 'A ParkSmart admin reviews the application before the operator gets a workspace.' },
  { title: 'Private verification', body: 'Identity, business and bank evidence is reviewed privately. Documents are never shown publicly.' },
  { title: 'Location authorisation', body: 'Each parking location needs its own proof that the operator may run it.' },
  { title: 'Live', body: 'Only a verified operator with an authorised location can publish it and take bookings.' },
];

export default function Trust() {
  return (
    <section aria-labelledby="trust-title" className="border-t">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <h2 id="trust-title" className="max-w-2xl font-display text-display-xl font-semibold text-balance">Every operator is checked.</h2>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">A location only appears in search after its operator and the site itself have been verified.</p>
        <ol className="relative mt-12 grid gap-8 lg:grid-cols-5 lg:gap-6">
          {/* the route the stops sit on */}
          <span aria-hidden="true" className="absolute top-2 bottom-2 left-[15px] border-l-2 border-dashed border-border-strong/50 lg:top-[15px] lg:right-[calc(20%-35px)] lg:bottom-auto lg:left-4 lg:border-t-2 lg:border-l-0" />
          {stops.map((stop, index) => (
            <li key={stop.title} className="relative flex gap-4 lg:block">
              <span
                aria-hidden="true"
                className={index === stops.length - 1
                  ? 'relative grid size-8 shrink-0 place-items-center rounded-full bg-slot-available text-sm font-semibold text-surface-raised'
                  : 'relative grid size-8 shrink-0 place-items-center rounded-full border-2 border-brand bg-background font-mono text-sm font-semibold text-brand'}
              >
                {index + 1}
              </span>
              <div className="lg:mt-5">
                <h3 className="font-display text-lg font-semibold"><span className="sr-only">Step {index + 1}: </span>{stop.title}</h3>
                <p className="mt-1.5 text-pretty text-text-muted">{stop.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
