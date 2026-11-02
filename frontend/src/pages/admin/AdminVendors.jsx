import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Ban, Check, Eye, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import DataTable from '@/components/kit/DataTable';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';

const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['active', 'Active'], ['rejected', 'Rejected'], ['suspended', 'Suspended']];

const ACTIONS = {
  approve: {
    run: adminAPI.approveVendor, label: 'Approve', icon: Check, tone: 'default',
    title: (v) => `Approve ${v.businessName}?`, description: 'They can add parking locations straight away. Publishing still needs verification.',
  },
  reject: {
    run: adminAPI.rejectVendor, label: 'Reject', icon: X, tone: 'danger',
    title: (v) => `Reject ${v.businessName}?`, description: 'They keep their driver account and see the rejection on their status page.',
  },
  suspend: {
    run: adminAPI.suspendVendor, label: 'Suspend', icon: Ban, tone: 'danger',
    title: (v) => `Suspend ${v.businessName}?`, description: 'They lose access to the operator workspace until approved again.',
  },
};

// Same rules as before: approve anything not active, reject pending, suspend active.
const actionsFor = (vendor) => [
  vendor.vendorStatus !== 'active' && 'approve',
  vendor.vendorStatus === 'pending' && 'reject',
  vendor.vendorStatus === 'active' && 'suspend',
].filter(Boolean);

const address = (v) => [v.address, v.city, v.state, v.pincode].filter(Boolean).join(', ');

export default function AdminVendors() {
  const confirm = useConfirm();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [acting, setActing] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = FILTERS.some(([value]) => value === searchParams.get('status')) ? searchParams.get('status') : 'all';
  const setFilter = (value) => setSearchParams((params) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('status'); else next.set('status', value);
    return next;
  }, { replace: true });

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    adminAPI.getVendors()
      .then(({ data }) => setVendors(data.vendors))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const act = useCallback(async (vendor, action) => {
    const config = ACTIONS[action];
    if (!(await confirm({ title: config.title(vendor), description: config.description, confirmLabel: config.label, cancelLabel: 'Cancel', tone: config.tone }))) return;
    setActing(`${vendor._id}:${action}`);
    try {
      const response = await config.run(vendor._id);
      toast.success(response.data.message);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || `Unable to ${action} vendor`);
    } finally {
      setActing('');
    }
  }, [confirm, load]);

  const renderActions = useCallback((vendor, size = 'sm') => actionsFor(vendor).map((action) => {
    const { label, icon: Icon, tone } = ACTIONS[action];
    const busy = acting === `${vendor._id}:${action}`;
    return (
      <Button key={action} size={size} variant={tone === 'danger' ? 'outline' : 'default'} className={tone === 'danger' ? 'text-danger hover:text-danger' : undefined} disabled={Boolean(acting)} onClick={() => act(vendor, action)}>
        {busy ? <Spinner data-icon="inline-start" /> : <Icon data-icon="inline-start" />}{label}<span className="sr-only"> {vendor.businessName}</span>
      </Button>
    );
  }), [act, acting]);

  const columns = useMemo(() => [
    {
      id: 'business', accessorFn: (v) => `${v.businessName} ${v.businessType || ''}`, header: 'Business', meta: { mobile: 'title' },
      cell: ({ row }) => <span><span className="block font-medium">{row.original.businessName}</span><span className="block text-xs text-text-muted">{row.original.businessType}</span></span>,
    },
    {
      id: 'owner', accessorFn: (v) => `${v.userId?.name || ''} ${v.userId?.email || ''}`, header: 'Owner', meta: { mobile: 'subtitle' },
      cell: ({ row }) => <span className="min-w-0"><span className="block">{row.original.userId?.name || '—'}</span><span className="block truncate text-xs text-text-muted">{row.original.userId?.email}</span></span>,
    },
    { id: 'city', accessorFn: (v) => [v.city, v.state].filter(Boolean).join(', '), header: 'City' },
    { id: 'applied', accessorFn: (v) => new Date(v.createdAt).getTime(), header: 'Applied', cell: ({ row }) => <span className="whitespace-nowrap">{format(new Date(row.original.createdAt), 'd MMM yyyy')}</span> },
    { id: 'status', accessorKey: 'vendorStatus', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSelectedId(row.original._id)}><Eye data-icon="inline-start" />Details<span className="sr-only"> for {row.original.businessName}</span></Button>
          {renderActions(row.original)}
        </div>
      ),
    },
  ], [renderActions]);

  const counts = Object.fromEntries(FILTERS.map(([value]) => [value, value === 'all' ? vendors.length : vendors.filter((v) => v.vendorStatus === value).length]));
  const rows = filter === 'all' ? vendors : vendors.filter((v) => v.vendorStatus === filter);
  const selected = vendors.find((v) => v._id === selectedId);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Vendors"
        description="Operator applications and accounts. Approval lets a vendor add locations; publishing also needs verification."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw data-icon="inline-start" />Refresh</Button>}
      />
      {failed ? (
        <ErrorState description="Vendors didn’t load. Check your connection and try again." onRetry={load} />
      ) : (
        <>
          <Tabs value={filter} onValueChange={setFilter} className="mb-4">
            <TabsList aria-label="Filter vendors by status" className="h-auto w-full justify-start overflow-x-auto sm:w-fit">
              {FILTERS.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="gap-1.5 px-3">{label}<span className="font-mono text-xs text-text-muted">{counts[value]}</span></TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(v) => v._id}
            loading={loading && !vendors.length}
            searchLabel="Search vendors"
            searchPlaceholder="Business, owner or email…"
            empty={rows.length ? undefined : <EmptyState title={filter === 'all' ? 'No vendor applications yet' : 'Nothing with this status'} description={filter === 'all' ? 'Applications appear here when drivers apply to list parking.' : 'Try another status.'} />}
          />
        </>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="font-display text-lg">{selected.businessName}</SheetTitle>
                <SheetDescription>{selected.businessType}</SheetDescription>
                <div><StatusBadge status={selected.vendorStatus} /></div>
              </SheetHeader>
              <dl className="m-0 grid flex-1 content-start gap-x-4 gap-y-3 overflow-y-auto p-4 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="text-text-muted">Owner</dt><dd className="m-0">{selected.userId?.name || '—'}</dd>
                <dt className="text-text-muted">Email</dt><dd className="m-0 break-words">{selected.userId?.email || '—'}</dd>
                <dt className="text-text-muted">Phone</dt><dd className="m-0 font-mono">{selected.phone || '—'}</dd>
                <dt className="text-text-muted">Address</dt><dd className="m-0">{address(selected) || '—'}</dd>
                <dt className="text-text-muted">Applied</dt><dd className="m-0">{format(new Date(selected.createdAt), 'd MMM yyyy, HH:mm')}</dd>
              </dl>
              {actionsFor(selected).length > 0 && (
                <SheetFooter className="flex-row flex-wrap justify-end border-t">
                  {renderActions(selected, 'default')}
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
