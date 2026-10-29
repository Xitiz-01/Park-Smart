import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import MinimalShell from '../../components/workspace/MinimalShell';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/kit/StatusBadge';
import { cn } from '@/lib/utils';

const statusCopy = {
  pending: 'Your application has been submitted and is awaiting approval.',
  rejected: 'Your vendor application was not approved. Contact support if you need more information.',
  suspended: 'Your vendor access is suspended. Contact support for assistance.',
};

// Applied → reviewed → approved, from the one status the API returns.
const steps = (status) => [
  { label: 'Application sent', state: 'done' },
  { label: 'Administrator review', state: status === 'pending' ? 'current' : status === 'rejected' ? 'failed' : 'done' },
  { label: status === 'suspended' ? 'Access suspended' : 'Approved to add locations', state: status === 'suspended' ? 'failed' : 'todo' },
];

export default function VendorStatus() {
  const { user, refreshUser, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const profile = user?.vendorProfile;

  if (!profile) return <Navigate to="/vendor/apply" replace />;
  if (user.role === 'vendor' && profile.vendorStatus === 'active') return <Navigate to="/vendor" replace />;

  const status = statusCopy[profile.vendorStatus] ? profile.vendorStatus : 'pending';
  const refresh = async () => {
    setRefreshing(true);
    try { await refreshUser(); toast.success('Application status refreshed'); }
    catch { toast.error('Unable to refresh status'); }
    finally { setRefreshing(false); }
  };

  return (
    <MinimalShell actions={<Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>}>
      <p className="mb-2 text-sm font-medium text-text-muted">Operator application</p>
      <h1 className="font-display text-display-lg font-semibold text-balance">{profile.businessName}</h1>
      <div className="mt-3"><StatusBadge status={status} /></div>
      <p className="mt-4 max-w-prose text-text-muted">{statusCopy[status]}</p>

      <ol aria-label="Application progress" className="m-0 mt-8 grid list-none gap-0 p-0">
        {steps(status).map((step, index, all) => (
          <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className="relative flex gap-4 pb-6 last:pb-0">
            {index < all.length - 1 && <span aria-hidden="true" className="absolute top-8 left-[0.9375rem] h-[calc(100%-2rem)] w-0.5 bg-border" />}
            <span aria-hidden="true" className={cn(
              'relative grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold',
              step.state === 'done' && 'border-slot-available bg-slot-available-soft text-slot-available',
              step.state === 'current' && 'border-slot-reserved bg-slot-reserved-soft text-slot-reserved',
              step.state === 'failed' && 'border-slot-occupied bg-slot-occupied-soft text-slot-occupied',
              step.state === 'todo' && 'border-border bg-surface-raised text-text-muted',
            )}>
              {step.state === 'done' ? <Check className="size-4" /> : step.state === 'failed' ? <X className="size-4" /> : index + 1}
            </span>
            <span className="pt-1">
              <span className={cn('block font-medium', step.state === 'todo' && 'text-text-muted')}>{step.label}</span>
              <span className="block text-sm text-text-muted">
                {{ done: 'Done', current: 'In progress', failed: 'Stopped', todo: 'Not yet' }[step.state]}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={refresh} disabled={refreshing}><RefreshCw data-icon="inline-start" className={cn(refreshing && 'motion-safe:animate-spin')} />{refreshing ? 'Refreshing…' : 'Refresh status'}</Button>
        <Button asChild variant="outline"><Link to="/dashboard">Driver dashboard</Link></Button>
      </div>
    </MinimalShell>
  );
}
