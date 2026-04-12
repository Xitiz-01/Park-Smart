import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Users, RefreshCw, UserCheck, UserX } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    adminAPI.getUsers()
      .then(res => setUsers(res.data.users))
      .finally(() => setLoading(false));
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
          <p>{users.length} registered customer{users.length !== 1 ? 's' : ''}</p>
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
                  <th>Name</th><th>Email</th><th>Phone</th><th>Registered</th><th>Status</th><th>Action</th>
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
                    <td>{u.phone || '—'}</td>
                    <td style={{ fontSize: 13 }}>{format(new Date(u.createdAt), 'dd MMM yyyy')}</td>
                    <td>
                      {u.isActive
                        ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-red">Inactive</span>}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggle(u._id, u.name, u.isActive)}
                        disabled={toggling === u._id}
                        className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-primary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {toggling === u._id ? '...' : u.isActive
                          ? <><UserX size={13} /> Deactivate</>
                          : <><UserCheck size={13} /> Activate</>}
                      </button>
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
