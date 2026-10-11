import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Eye, RefreshCw, Store } from 'lucide-react';
import { adminAPI } from '../../services/api';

const badgeFor = (status) => ({ active: 'badge-green', pending: 'badge-yellow', rejected: 'badge-red', suspended: 'badge-red' }[status] || 'badge-info');

export default function AdminVendors() {
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = () => {
    setLoading(true);
    adminAPI.getVendors()
      .then(({ data }) => setVendors(data.vendors))
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load vendors'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (vendor, action) => {
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${vendor.businessName}?`)) return;
    setActing(`${vendor._id}:${action}`);
    try {
      const response = await ({
        approve: adminAPI.approveVendor,
        reject: adminAPI.rejectVendor,
        suspend: adminAPI.suspendVendor,
      }[action])(vendor._id);
      setSelected(response.data.vendor);
      toast.success(response.data.message);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || `Unable to ${action} vendor`);
    } finally {
      setActing(null);
    }
  };

  const actions = (vendor) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button className="btn btn-sm btn-outline" onClick={() => setSelected(vendor)}><Eye size={13} /> View</button>
      {vendor.vendorStatus !== 'active' && <button className="btn btn-sm btn-primary" disabled={!!acting} onClick={() => act(vendor, 'approve')}>Approve</button>}
      {vendor.vendorStatus === 'pending' && <button className="btn btn-sm btn-danger" disabled={!!acting} onClick={() => act(vendor, 'reject')}>Reject</button>}
      {vendor.vendorStatus === 'active' && <button className="btn btn-sm btn-danger" disabled={!!acting} onClick={() => act(vendor, 'suspend')}>Suspend</button>}
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div><h1>Vendor Management</h1><p>Review and manage vendor applications</p></div>
        <button className="btn btn-outline" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {selected && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(20,125,111,.38)' }}>
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <h2 style={{ fontSize: 18 }}>{selected.businessName}</h2>
            <button className="btn btn-sm btn-outline" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginTop: 18 }}>
            <div><div className="form-label">Owner</div><div>{selected.userId?.name || '—'}</div></div>
            <div><div className="form-label">Email</div><div>{selected.userId?.email || '—'}</div></div>
            <div><div className="form-label">Phone</div><div>{selected.phone}</div></div>
            <div><div className="form-label">Business Type</div><div>{selected.businessType}</div></div>
            <div style={{ gridColumn: '1 / -1' }}><div className="form-label">Address</div><div>{selected.address}, {selected.city}, {selected.state} {selected.pincode}</div></div>
          </div>
          <div style={{ marginTop: 18 }}>{actions(selected)}</div>
        </div>
      )}
      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <div className="card"><div className="table-wrapper"><table>
          <thead><tr><th>Business</th><th>Owner</th><th>Location</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{vendors.map((vendor) => <tr key={vendor._id}>
            <td style={{ fontWeight: 600 }}>{vendor.businessName}<br /><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{vendor.businessType}</span></td>
            <td>{vendor.userId?.name || '—'}<br /><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{vendor.userId?.email}</span></td>
            <td>{vendor.city}, {vendor.state}</td>
            <td>{format(new Date(vendor.createdAt), 'dd MMM yyyy')}</td>
            <td><span className={`badge ${badgeFor(vendor.vendorStatus)}`}>{vendor.vendorStatus}</span></td>
            <td>{actions(vendor)}</td>
          </tr>)}</tbody>
        </table>{vendors.length === 0 && <div className="empty-state"><Store size={40} /><h3>No vendor applications</h3></div>}</div></div>
      )}
    </div>
  );
}
