import React, { useEffect, useState } from 'react';
import { bookingsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const map = { upcoming: 'badge-blue', active: 'badge-green', completed: 'badge-purple', cancelled: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-blue'}`}>{status}</span>;
};
const PaymentBadge = ({ status }) => {
  const map = { paid: 'badge-green', pending: 'badge-yellow', refunded: 'badge-purple' };
  return <span className={`badge ${map[status] || 'badge-yellow'}`}>{status || 'pending'}</span>;
};

const PAYMENT_METHOD_LABELS = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [acting, setActing] = useState(null);

  const fetchBookings = () => {
    setLoading(true);
    const params = {};
    if (filter) params.status = filter;
    bookingsAPI.getAll(params)
      .then(res => setBookings(res.data.bookings))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, [filter]);

  const handleCheckIn = async (id) => {
    setActing(id + 'in');
    try {
      await bookingsAPI.checkIn(id);
      toast.success('Customer checked in');
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActing(null); }
  };

  const handleCheckOut = async (id) => {
    setActing(id + 'out');
    try {
      await bookingsAPI.checkOut(id);
      toast.success('Customer checked out');
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActing(null); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await bookingsAPI.cancel(id);
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Manage Bookings</h1>
          <p>Check-in, check-out, and monitor all reservations</p>
        </div>
        <button onClick={fetchBookings} className="btn btn-outline"><RefreshCw size={15} /> Refresh</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['', 'upcoming', 'active', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: filter === s ? 'var(--accent)' : 'var(--bg-card)',
            color: filter === s ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${filter === s ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Customer</th><th>Slot</th><th>Vehicle</th><th>Start</th><th>Expected End</th><th>Amount</th><th>Payment</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b._id}>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--accent)' }}>#{b.bookingCode}</td>
                    <td style={{ color: 'var(--text-primary)' }}>
                      {b.user?.name}
                      <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.user?.phone}</span>
                    </td>
                    <td>{b.slot?.slotNumber}<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Zone {b.slot?.zone}</span></td>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: 13 }}>{b.vehicle?.licensePlate}</td>
                    <td style={{ fontSize: 13 }}>{format(new Date(b.startTime), 'dd MMM, hh:mm a')}</td>
                    <td style={{ fontSize: 13 }}>{format(new Date(b.expectedEndTime), 'dd MMM, hh:mm a')}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>₹{b.totalAmount}</td>
                    <td>
                      <PaymentBadge status={b.paymentStatus} />
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        {PAYMENT_METHOD_LABELS[b.paymentMethod] || 'N/A'}
                      </div>
                    </td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {b.status === 'upcoming' && (
                          <button onClick={() => handleCheckIn(b._id)} disabled={acting === b._id + 'in'}
                            className="btn btn-primary btn-sm" title="Check In">
                            <LogIn size={13} /> {acting === b._id + 'in' ? '...' : 'In'}
                          </button>
                        )}
                        {b.status === 'active' && (
                          <button onClick={() => handleCheckOut(b._id)} disabled={acting === b._id + 'out'}
                            className="btn btn-outline btn-sm" title="Check Out">
                            <LogOut size={13} /> {acting === b._id + 'out' ? '...' : 'Out'}
                          </button>
                        )}
                        {(b.status === 'upcoming' || b.status === 'active') && (
                          <button onClick={() => handleCancel(b._id)} className="btn btn-danger btn-sm">✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookings.length === 0 && (
              <div className="empty-state"><p>No bookings found.</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
