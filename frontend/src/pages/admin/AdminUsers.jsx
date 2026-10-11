import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Users, RefreshCw, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsers() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [changingRole, setChangingRole] = useState(null);
  const [search, setSearch] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    adminAPI.getUsers()
      .then(res => setUsers(res.data.users))
      .finally(() => setLoading(false));
  };

  const handleRole = async (user, role) => {
    const action = role === 'admin' ? 'promote to Admin' : 'demote to Customer';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.name}?`)) return;
    setChangingRole(user._id);
    try {
      await adminAPI.setUserRole(user._id, role);
      toast.success(role === 'admin' ? 'Admin access granted' : 'Admin access removed');
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Role change failed'); }
    finally { setChangingRole(null); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggle = async (id, name, isActive) => {
    const action = isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${name}?`)) return;
    setToggling(id);
    try {
      await adminAPI.toggleUser(id);
      toast.success(`User ${action}d`);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setToggling(null); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Manage Users</h1>
          <p>{users.length} registered account{users.length !== 1 ? 's' : ''}{isSuperAdmin ? ' · admin roles unlocked' : ''}</p>
        </div>
        <button onClick={fetchUsers} className="btn btn-outline"><RefreshCw size={15} /> Refresh</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input className="form-input" style={{ maxWidth: 360 }} placeholder="Search by name, email or phone..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Registered</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'var(--accent-glow)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-display)',
                          fontWeight: 700, fontSize: 14, flexShrink: 0,
                        }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${['admin', 'super_admin'].includes(u.role) ? 'badge-info' : u.role === 'vendor' ? 'badge-warning' : 'badge-green'}`}>{u.role.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 13 }}>{format(new Date(u.createdAt), 'dd MMM yyyy')}</td>
                    <td>
                      {u.isActive
                        ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-red">Inactive</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {u.role !== 'super_admin' && u._id !== currentUser?._id && (u.role !== 'admin' || isSuperAdmin) && (
                          <button
                            onClick={() => handleToggle(u._id, u.name, u.isActive)}
                            disabled={toggling === u._id}
                            className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-primary'}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {toggling === u._id ? '...' : u.isActive
                              ? <><UserX size={13} /> Deactivate</>
                              : <><UserCheck size={13} /> Activate</>}
                          </button>
                        )}
                        {isSuperAdmin && u.role === 'customer' && u.authUserId && u._id !== currentUser?._id && (
                          <button className="btn btn-sm btn-outline" disabled={changingRole === u._id} onClick={() => handleRole(u, 'admin')}>
                            <ShieldCheck size={13} /> Promote to Admin
                          </button>
                        )}
                        {isSuperAdmin && u.role === 'admin' && u._id !== currentUser?._id && (
                          <button className="btn btn-sm btn-outline" disabled={changingRole === u._id} onClick={() => handleRole(u, 'customer')}>
                            <ShieldOff size={13} /> Demote Admin
                          </button>
                        )}
                        {u.role === 'super_admin' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bootstrap protected</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <Users size={40} style={{ margin: '0 auto 12px' }} />
                <h3>{search ? 'No users match your search' : 'No users yet'}</h3>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
