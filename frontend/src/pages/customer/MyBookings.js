import React, { useEffect, useState } from 'react';
import { bookingsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { CalendarDays, MapPin, Car, XCircle } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const map = {
    upcoming:  { cls: 'badge-blue',   label: 'Upcoming' },
    active:    { cls: 'badge-green',  label: 'Active' },
    completed: { cls: 'badge-purple', label: 'Completed' },
    cancelled: { cls: 'badge-red',    label: 'Cancelled' },
  };
  const s = map[status] || { cls: 'badge-blue', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};
const PaymentBadge = ({ status }) => {
  const map = {
    paid: { cls: 'badge-green', label: 'Paid' },
    pending: { cls: 'badge-yellow', label: 'Pending' },
    refunded: { cls: 'badge-purple', label: 'Refunded' },
  };
  const s = map[status] || { cls: 'badge-yellow', label: status || 'pending' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const PAYMENT_METHOD_LABELS = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const fetchBookings = () => {
    bookingsAPI.getMyBookings()
      .then((res) => setBookings(res.data.bookings))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancelling(id);
    try {
      await bookingsAPI.cancel(id);
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  const filtered = filter ? bookings.filter(b => b.status === filter) : bookings;

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>My Bookings</h1>
        <p>{bookings.length} total booking{bookings.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['', 'upcoming', 'active', 'completed', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: filter === s ? 'var(--accent)' : 'var(--bg-card)',
            color: filter === s ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${filter === s ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <CalendarDays size={40} style={{ margin: '0 auto 12px' }} />
          <h3>No bookings found</h3>
          <p>Your bookings will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((b) => (
            <div key={b._id} className="card" style={{ transition: 'border-color 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                {/* Left */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
                      Slot {b.slot?.slotNumber}
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                      <MapPin size={14} /> Zone {b.slot?.zone} · Floor {b.slot?.floor}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                      <Car size={14} /> {b.vehicle?.licensePlate}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span>From: {format(new Date(b.startTime), 'dd MMM yy, hh:mm a')}</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span>To: {format(new Date(b.expectedEndTime), 'dd MMM yy, hh:mm a')}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    #{b.bookingCode}
                  </div>
                </div>

                {/* Right */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    ₹{b.totalAmount}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <PaymentBadge status={b.paymentStatus} />
                  </div>
                  <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    {PAYMENT_METHOD_LABELS[b.paymentMethod] || 'Method unavailable'}
                  </div>
                  {(b.status === 'upcoming' || b.status === 'active') && (
                    <button onClick={() => handleCancel(b._id)} disabled={cancelling === b._id}
                      className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <XCircle size={14} />
                      {cancelling === b._id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
