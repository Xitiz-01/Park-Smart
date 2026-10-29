import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Check, Download, FileText, MapPin, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import { statusLabel } from '@/lib/status';
import { cn } from '@/lib/utils';
import { VERIFICATION_STATUSES, metadataValue, verificationLabel } from '@/lib/verification';

const REVIEW_ACTIONS = {
  approve: { label: 'Approve', icon: Check, verb: 'Approve' },
  resubmit: { label: 'Ask to resubmit', icon: RotateCcw, verb: 'Ask for resubmission of' },
  reject: { label: 'Reject', icon: X, verb: 'Reject' },
};

const CHECKS = [['identityStatus', 'Identity'], ['businessStatus', 'Business'], ['bankStatus', 'Bank']];

function EvidenceCard({ item, onReview, onDownload, downloading }) {
  const metadata = Object.entries(item.safeMetadata || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const reason = item.rejectionReason || item.resubmissionReason;
  const Icon = item.evidenceType === 'authorization' ? MapPin : FileText;
  return (
    <li className="rounded-xl border bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-text-muted"><Icon className="size-4" /></span>
          <div className="min-w-0">
            <h4 className="font-medium">{verificationLabel(item.documentType)}</h4>
            <p className="text-sm text-text-muted">
              {item.evidenceType === 'authorization' ? item.context : verificationLabel(item.context)} · {verificationLabel(item.provider || 'MANUAL')}
            </p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      {metadata.length > 0 && (
        <dl className="m-0 mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
          {metadata.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-text-muted">{verificationLabel(key)}</dt>
              <dd className="m-0 font-mono break-all">{metadataValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {reason && <p className="mt-3 rounded-lg bg-slot-reserved-soft px-3 py-2 text-sm text-slot-reserved">Reason given: {reason}</p>}
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        {item.safeMetadata?.mimeType && (
          <Button size="sm" variant="outline" disabled={downloading} onClick={() => onDownload(item)}>
            {downloading ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}Download private file
          </Button>
        )}
        <span className="flex-1" />
        {Object.entries(REVIEW_ACTIONS).map(([action, { label, icon: ActionIcon }]) => (
          <Button
            key={action}
            size="sm"
            variant={action === 'approve' ? 'default' : 'outline'}
            className={action === 'reject' ? 'text-danger hover:text-danger' : undefined}
            onClick={() => onReview(item, action)}
          >
            <ActionIcon data-icon="inline-start" />{label}<span className="sr-only"> {verificationLabel(item.documentType)}</span>
          </Button>
        ))}
      </div>
    </li>
  );
}

export default function AdminVerifications() {
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesFailed, setCasesFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', vendor: '', type: '' });
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState('');
  const detailRef = useRef(null);

  const loadCases = useCallback(async () => {
    setCasesFailed(false);
    try {
      const { data } = await adminAPI.getVerificationCases({ status: filters.status || undefined, vendor: filters.vendor || undefined, type: filters.type || undefined });
      setCases(data.cases || []);
    } catch { setCasesFailed(true); }
    finally { setCasesLoading(false); }
  }, [filters.status, filters.vendor, filters.type]);

  const loadDetail = useCallback(async (vendorId) => {
    if (!vendorId) return;
    setDetailLoading(true);
    try { const { data } = await adminAPI.getVerificationCase(vendorId); setDetail(data); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to load this case'); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { const timer = setTimeout(loadCases, 250); return () => clearTimeout(timer); }, [loadCases]);
  useEffect(() => { loadDetail(selected?.vendor?._id); }, [selected, loadDetail]);

  const choose = (item) => {
    setDetail(null);
    setSelected(item);
    // On narrow screens the detail sits below the list.
    window.requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 1023px)').matches) detailRef.current?.scrollIntoView({ block: 'start' });
    });
  };

  const evidence = useMemo(() => {
    const items = [
      ...(detail?.documents || []).map((item) => ({ ...item, evidenceType: 'document', context: item.category })),
      ...(detail?.parkingAuthorizations || []).map((item) => ({ ...item, evidenceType: 'authorization', context: item.parkingLocation?.name || 'Parking location' })),
    ];
    return filters.type ? items.filter((item) => item.evidenceType === filters.type) : items;
  }, [detail, filters.type]);

  const openReview = (item, action) => { setReview({ item, action }); setReason(''); setReasonError(''); };

  const act = async (event) => {
    event.preventDefault();
    if (!review) return;
    if (review.action !== 'approve' && !reason.trim()) { setReasonError('Give the vendor a reason, so they know what to fix.'); return; }
    setBusy(true);
    try {
      await adminAPI.reviewVerificationEvidence(review.item.evidenceType, review.item._id, review.action, reason);
      toast.success('Review decision saved');
      setReview(null); setReason('');
      await Promise.all([loadCases(), loadDetail(selected.vendor._id)]);
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save decision'); }
    finally { setBusy(false); }
  };

  // Unchanged private download: the file comes through the API as a blob and
  // never gets a public URL.
  const download = async (item) => {
    setDownloading(item._id);
    try {
      const { data } = await adminAPI.getVerificationDocument(item.evidenceType, item._id);
      const url = URL.createObjectURL(data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'verification-document'; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to access private document'); }
    finally { setDownloading(''); }
  };

  const verification = detail?.verification;
  const reviewAction = review && REVIEW_ACTIONS[review.action];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Verification review" description="Vendor and location evidence, each decision recorded in the case history." />

      <section aria-label="Filter cases" className="mb-6 grid gap-3 sm:grid-cols-3">
        <FormField label="Vendor">
          <Input type="search" autoComplete="off" placeholder="Name or email…" value={filters.vendor} onChange={(event) => setFilters({ ...filters, vendor: event.target.value })} />
        </FormField>
        <FormField label="Case status">
          <NativeSelect className="w-full" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            {VERIFICATION_STATUSES.map((value) => <NativeSelectOption key={value} value={value}>{statusLabel(value)}</NativeSelectOption>)}
          </NativeSelect>
        </FormField>
        <FormField label="Evidence">
          <NativeSelect className="w-full" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <NativeSelectOption value="">All evidence</NativeSelectOption>
            <NativeSelectOption value="document">{verificationLabel('document')}</NativeSelectOption>
            <NativeSelectOption value="authorization">{verificationLabel('authorization')}</NativeSelectOption>
          </NativeSelect>
        </FormField>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section aria-labelledby="cases-title" className="min-w-0">
          <h2 id="cases-title" className="mb-3 font-display text-lg font-semibold">Cases{!casesLoading && <span className="ml-2 font-mono text-sm font-normal text-text-muted">{cases.length}</span>}</h2>
          {casesLoading ? <ListSkeleton rows={3} /> : casesFailed ? (
            <ErrorState description="Cases didn’t load. Check your connection and try again." onRetry={loadCases} />
          ) : cases.length === 0 ? (
            <EmptyState title="No matching cases" description="Try other filters." />
          ) : (
            <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0">
              {cases.map((item) => {
                const active = selected?._id === item._id;
                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => choose(item)}
                      className={cn(
                        'flex w-full items-start justify-between gap-3 rounded-xl border bg-card p-3 text-left shadow-hairline transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus',
                        active && 'border-brand bg-brand-soft hover:bg-brand-soft',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.vendor?.businessName || item.vendor?.userId?.name || 'Vendor'}</span>
                        <span className="block truncate text-xs text-text-muted">{item.vendor?.userId?.email || item.vendor?.businessEmail}</span>
                      </span>
                      <StatusBadge status={item.overallStatus} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section ref={detailRef} aria-labelledby="case-title" aria-busy={detailLoading || undefined} className="min-w-0 scroll-mt-20 rounded-2xl border bg-card p-5 shadow-hairline sm:p-6">
          {!selected ? (
            <EmptyState icon={<ShieldCheck className="size-10 text-text-muted" />} title="Pick a case" description="Its evidence and history show here." className="border-0" />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-muted">Vendor</p>
                  <h2 id="case-title" className="font-display text-xl font-semibold break-words">{selected.vendor?.businessName || selected.vendor?.userId?.name}</h2>
                </div>
                <StatusBadge status={verification?.overallStatus || selected.overallStatus} />
              </div>

              {detailLoading && !detail ? <ListSkeleton rows={2} className="mt-6" /> : (
                <>
                  <dl className="m-0 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {CHECKS.map(([key, label]) => (
                      <div key={key} className="rounded-lg bg-surface-sunken p-3">
                        <dt className="text-sm text-text-muted">{label}</dt>
                        <dd className="m-0 mt-1.5"><StatusBadge status={verification?.[key]} /></dd>
                      </div>
                    ))}
                  </dl>

                  <h3 className="mt-8 mb-3 font-display text-base font-semibold">Evidence</h3>
                  {evidence.length ? (
                    <ul className="m-0 grid list-none gap-3 p-0">
                      {evidence.map((item) => (
                        <EvidenceCard key={`${item.evidenceType}-${item._id}`} item={item} onReview={openReview} onDownload={download} downloading={downloading === item._id} />
                      ))}
                    </ul>
                  ) : <p className="text-sm text-text-muted">No evidence{filters.type ? ' of this kind' : ''} yet.</p>}

                  <h3 className="mt-8 mb-3 font-display text-base font-semibold">History</h3>
                  {detail?.audit?.length ? (
                    <ol className="m-0 list-none border-l-2 p-0 pl-5">
                      {detail.audit.map((item) => (
                        <li key={item._id} className="relative pb-4 last:pb-0">
                          <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-text-muted" />
                          <p className="text-sm font-medium">{verificationLabel(item.action)}</p>
                          <p className="text-xs text-text-muted">
                            <time dateTime={item.createdAt}>{format(new Date(item.createdAt), 'd MMM yyyy, HH:mm')}</time>
                            {item.newStatus && <> · {item.previousStatus ? `${statusLabel(item.previousStatus)} → ` : ''}{statusLabel(item.newStatus)}</>}
                          </p>
                          {item.note && <p className="mt-0.5 text-sm text-text-muted">{item.note}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-sm text-text-muted">No history yet.</p>}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* A real modal now: focus trap, Escape, focus returned (audit G). */}
      <Dialog open={Boolean(review)} onOpenChange={(open) => { if (!open && !busy) setReview(null); }}>
        <DialogContent>
          {review && (
            <form onSubmit={act} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{reviewAction.verb} {verificationLabel(review.item.documentType)}?</DialogTitle>
                <DialogDescription>
                  {review.action === 'approve'
                    ? 'Confirm this evidence meets ParkSmart’s verification requirements.'
                    : 'The vendor sees this reason on their Verification page.'}
                </DialogDescription>
              </DialogHeader>
              {review.action !== 'approve' && (
                <FormField label="Reason" error={reasonError} required>
                  <Textarea rows={4} value={reason} onChange={(event) => { setReason(event.target.value); if (reasonError) setReasonError(''); }} autoFocus />
                </FormField>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReview(null)} disabled={busy}>Cancel</Button>
                <Button type="submit" variant={review.action === 'reject' ? 'destructive' : 'default'} disabled={busy}>
                  {busy && <Spinner data-icon="inline-start" />}{reviewAction.label}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
