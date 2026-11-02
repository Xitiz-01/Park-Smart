import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Receipt, Settings, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';

// Pages listed in the operator nav that the product doesn't have yet. Each
// says plainly what is missing and where the related, real data is today.
// No sample figures (audit #11).
const SECTIONS = {
  transactions: {
    title: 'Transactions',
    icon: Receipt,
    summary: 'A list of payments for bookings at your locations isn’t available yet.',
    today: 'Each booking’s amount and status are on the Bookings page.',
    links: [['/vendor/bookings', 'Open bookings']],
  },
  earnings: {
    title: 'Earnings',
    icon: Wallet,
    summary: 'Payouts and an earnings breakdown aren’t available yet.',
    today: 'The overview shows the total value of completed bookings. That is not a payout figure.',
    links: [['/vendor', 'Open the overview']],
  },
  settings: {
    title: 'Settings',
    icon: Settings,
    summary: 'There are no account settings to change here yet.',
    today: 'Your business name, type and phone are on Business profile; each location’s prices and hours are in its editor.',
    links: [['/vendor/profile', 'Business profile'], ['/vendor/locations', 'Parking locations']],
  },
};

export default function VendorPlaceholder() {
  const { section } = useParams();
  const page = SECTIONS[section];

  if (!page) {
    return (
      <>
        <PageHeader eyebrow="Operator" title="Page not found" description="There’s no operator page at this address." />
        <Button asChild><Link to="/vendor">Go to the overview</Link></Button>
      </>
    );
  }

  const Icon = page.icon;
  return (
    <>
      <PageHeader eyebrow="Operator" title={page.title} />
      <section aria-labelledby="soon-title" className="max-w-2xl rounded-2xl border border-dashed bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-sunken text-text-muted"><Icon className="size-6" /></span>
          <div className="min-w-0">
            <StatusBadge tone="neutral">Not available yet</StatusBadge>
            <h2 id="soon-title" className="mt-3 font-display text-xl font-semibold text-balance">{page.summary}</h2>
            <p className="mt-2 text-text-muted">{page.today}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {page.links.map(([to, label], index) => (
                <Button key={to} asChild variant={index === 0 ? 'default' : 'outline'}>
                  <Link to={to}>{label}{index === 0 && <ArrowRight data-icon="inline-end" />}</Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
