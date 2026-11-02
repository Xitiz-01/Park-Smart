import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import DataTable from '@/components/kit/DataTable';
import { ErrorState } from '@/components/kit/EmptyState';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';

export default function AdminUsers() {
  const confirm = useConfirm();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState('');

  // Load failures used to leave an empty table (audit R).
  const fetchUsers = useCallback(() => {
    setLoading(true);
    setFailed(false);
    adminAPI.getUsers()
      .then((res) => setUsers(res.data.users))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(fetchUsers, [fetchUsers]);

  const handleRole = useCallback(async (user, role) => {
    const promote = role === 'admin';
    if (!(await confirm({
      title: promote ? `Make ${user.name} an admin?` : `Remove ${user.name}’s admin access?`,
      description: promote ? 'Admins can manage users, vendors, bookings and verification.' : 'They keep their account as a customer.',
      confirmLabel: promote ? 'Make admin' : 'Remove admin access',
      cancelLabel: 'Cancel',
      tone: promote ? 'default' : 'danger',
    }))) return;
    setBusy(`${user._id}:role`);
    try {
      await adminAPI.setUserRole(user._id, role);
      toast.success(promote ? 'Admin access granted' : 'Admin access removed');
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Role change failed'); }
    finally { setBusy(''); }
  }, [confirm, fetchUsers]);

  const handleToggle = useCallback(async (user) => {
    const deactivate = user.isActive;
    if (!(await confirm({
      title: deactivate ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`,
      description: deactivate ? 'They won’t be able to sign in until reactivated.' : 'They can sign in again straight away.',
      confirmLabel: deactivate ? 'Deactivate' : 'Reactivate',
      cancelLabel: 'Cancel',
      tone: deactivate ? 'danger' : 'default',
    }))) return;
    setBusy(`${user._id}:toggle`);
    try {
      await adminAPI.toggleUser(user._id);
      toast.success(deactivate ? 'User deactivated' : 'User reactivated');
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setBusy(''); }
  }, [confirm, fetchUsers]);

  const columns = useMemo(() => [
    {
      // Name, email and phone in one column so search covers all three.
      id: 'user', accessorFn: (u) => `${u.name} ${u.email} ${u.phone || ''}`, header: 'User', meta: { mobile: 'title' },
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken font-display text-sm font-semibold">{row.original.name.charAt(0).toUpperCase()}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{row.original.name}</span>
            <span className="block truncate text-xs text-text-muted">{row.original.email}</span>
          </span>
        </span>
      ),
    },
    { id: 'role', accessorKey: 'role', header: 'Role', cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
    { id: 'phone', accessorFn: (u) => u.phone || '—', header: 'Phone', cell: ({ getValue }) => <span className="font-mono text-sm">{getValue()}</span> },
    { id: 'joined', accessorFn: (u) => new Date(u.createdAt).getTime(), header: 'Joined', cell: ({ row }) => <span className="whitespace-nowrap">{format(new Date(row.original.createdAt), 'd MMM yyyy')}</span> },
    { id: 'status', accessorFn: (u) => (u.isActive ? 'Active' : 'Inactive'), header: 'Access', cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' },
      cell: ({ row }) => {
        const u = row.original;
        const self = u._id === currentUser?._id;
        // Same rules as before: the bootstrap super admin and yourself are
        // protected; only super admins manage admins.
        const canToggle = u.role !== 'super_admin' && !self && (u.role !== 'admin' || isSuperAdmin);
        const canPromote = isSuperAdmin && u.role === 'customer' && u.authUserId && !self;
        const canDemote = isSuperAdmin && u.role === 'admin' && !self;
        if (u.role === 'super_admin') return <span className="text-sm text-text-muted">Protected</span>;
        if (self) return <span className="text-sm text-text-muted">You</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {canToggle && (
              <Button size="sm" variant={u.isActive ? 'outline' : 'default'} className={u.isActive ? 'text-danger hover:text-danger' : undefined} disabled={busy === `${u._id}:toggle`} onClick={() => handleToggle(u)}>
                {busy === `${u._id}:toggle` ? <Spinner data-icon="inline-start" /> : u.isActive ? <UserX data-icon="inline-start" /> : <UserCheck data-icon="inline-start" />}
                {u.isActive ? 'Deactivate' : 'Reactivate'}<span className="sr-only"> {u.name}</span>
              </Button>
            )}
            {canPromote && (
              <Button size="sm" variant="outline" disabled={busy === `${u._id}:role`} onClick={() => handleRole(u, 'admin')}>
                <ShieldCheck data-icon="inline-start" />Make admin<span className="sr-only"> {u.name}</span>
              </Button>
            )}
            {canDemote && (
              <Button size="sm" variant="outline" disabled={busy === `${u._id}:role`} onClick={() => handleRole(u, 'customer')}>
                <ShieldOff data-icon="inline-start" />Remove admin<span className="sr-only"> {u.name}</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ], [busy, currentUser?._id, handleRole, handleToggle, isSuperAdmin]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description={loading ? 'Loading accounts…' : `${users.length} account${users.length === 1 ? '' : 's'}${isSuperAdmin ? '. As super admin you can also manage admin roles.' : '.'}`}
        actions={<Button variant="outline" onClick={fetchUsers} disabled={loading}><RefreshCw data-icon="inline-start" />Refresh</Button>}
      />
      {failed ? (
        <ErrorState description="Users didn’t load. Check your connection and try again." onRetry={fetchUsers} />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          getRowId={(u) => u._id}
          loading={loading && !users.length}
          searchLabel="Search users"
          searchPlaceholder="Name, email or phone…"
        />
      )}
    </>
  );
}
