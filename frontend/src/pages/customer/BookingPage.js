import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { slotsAPI, bookingsAPI, vehiclesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format, addHours } from 'date-fns';
import { MapPin, CreditCard, Smartphone, Landmark, Wallet } from 'lucide-react';

const PAYMENT_METHODS = [
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'upi', label: 'UPI', icon: Smartphone },
  { key: 'netbanking', label: 'Net Banking', icon: Landmark },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
];

export default function BookingPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const [slot, setSlot] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const now = new Date();
  const defaultStart = format(now, "yyyy-MM-dd'T'HH:mm");
  const defaultEnd = format(addHours(now, 2), "yyyy-MM-dd'T'HH:mm");

  const [form, setForm] = useState({ vehicleId: '', startTime: defaultStart, expectedEndTime: defaultEnd });
  const [payment, setPayment] = useState({
    method: 'card',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    upiId: '',
    bankName: '',
    walletProvider: '',
  });

  useEffect(() => {
    Promise.all([slotsAPI.getById(slotId), vehiclesAPI.getAll()])
      .then(([slotRes, vRes]) => {
        setSlot(slotRes.data.slot);
        setVehicles(vRes.data.vehicles);
        const def = vRes.data.vehicles.find(v => v.isDefault) || vRes.data.vehicles[0];
        if (def) setForm(f => ({ ...f, vehicleId: def._id }));
      })
      .catch(() => { toast.error('Slot not found'); navigate('/dashboard/slots'); })
      .finally(() => setLoading(false));
  }, [slotId, navigate]);

  const hours = form.startTime && form.expectedEndTime
    ? Math.max(1, Math.ceil((new Date(form.expectedEndTime) - new Date(form.startTime)) / (1000 * 60 * 60)))
    : 0;

  const estimatedCost = slot ? hours * slot.pricePerHour : 0;
  const validateBookingDetails = () => {
    if (!form.vehicleId) {
      toast.error('Please select a vehicle');
      return false;
    }
    if (new Date(form.expectedEndTime) <= new Date(form.startTime)) {
      toast.error('End time must be after start time');
      return false;
    }
    return true;
  };

  const validatePaymentDetails = () => {
    if (payment.method === 'card') {
      const digits = payment.cardNumber.replace(/\s/g, '');
      if (payment.cardName.trim().length < 2) {
        toast.error('Enter name on card');
        return false;
      }
      if (!/^\d{16}$/.test(digits)) {
        toast.error('Card number must be 16 digits');
        return false;
      }
      if (!/^\d{2}\/\d{2}$/.test(payment.expiry)) {
        toast.error('Expiry must be in MM/YY');
        return false;
      }
      if (!/^\d{3}$/.test(payment.cvv)) {
        toast.error('CVV must be 3 digits');
        return false;
      }
    }

    if (payment.method === 'upi' && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(payment.upiId)) {
      toast.error('Enter a valid UPI ID');
      return false;
    }

    if (payment.method === 'netbanking' && payment.bankName.trim().length < 2) {
      toast.error('Enter bank name');
      return false;
    }

    if (payment.method === 'wallet' && payment.walletProvider.trim().length < 2) {
      toast.error('Enter wallet provider');
      return false;
    }

    return true;
  };

  const openPaymentWindow = (e) => {
    e.preventDefault();
    if (!validateBookingDetails()) return;
    setPaymentOpen(true);
  };

  const handlePaymentAndReserve = async (e) => {
    e.preventDefault();
    if (!validateBookingDetails() || !validatePaymentDetails()) return;
    setSubmitting(true);
    try {
      await bookingsAPI.create({
        slotId,
        ...form,
        paymentMethod: payment.method,
        paymentReference: `PAY${Date.now().toString().slice(-10)}`,
      });
      toast.success('Payment successful. Slot reserved!');
      navigate('/dashboard/bookings');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!slot) return null;

  return (
    <div className="fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <h1>Reserve Slot</h1>
        <p>Fill in your booking details</p>
      </div>

      {/* Slot summary */}
      <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent-glow)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin color="var(--accent)" size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{slot.slotNumber}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Floor {slot.floor} · Zone {slot.zone} · {slot.type}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>₹{slot.pricePerHour}/hr</div>
          </div>
        </div>
      </div>

      <form onSubmit={openPaymentWindow} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card parking-card">
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}>Booking Details</h3>

          {/* Vehicle */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Select Vehicle</label>
            {vehicles.length === 0 ? (
              <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-muted)' }}>
                No vehicles found. <a href="/dashboard/vehicles" style={{ color: 'var(--accent)' }}>Add a vehicle first →</a>
              </div>
            ) : (
              <select className="form-input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
                <option value="">Choose vehicle</option>
                {vehicles.map(v => (
                  <option key={v._id} value={v._id}>
                    {v.licensePlate} — {v.brand} {v.model} ({v.vehicleType})
                    {v.isDefault ? ' ★' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input type="datetime-local" className="form-input" value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Expected End Time</label>
              <input type="datetime-local" className="form-input" value={form.expectedEndTime}
                onChange={(e) => setForm({ ...form, expectedEndTime: e.target.value })} required />
            </div>
          </div>
        </div>

        {/* Cost summary */}
        <div className="card" style={{ borderColor: 'var(--border-light)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Cost Estimate</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Duration', value: `${hours} hour${hours !== 1 ? 's' : ''}` },
              { label: 'Rate', value: `₹${slot.pricePerHour}/hr` },
              { label: 'Estimated Total', value: `₹${estimatedCost}`, bold: true },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: i < 2 ? '1px solid var(--border)' : 'none', paddingBottom: i < 2 ? 10 : 0 }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: r.bold ? 700 : 500, color: r.bold ? 'var(--accent)' : 'var(--text-primary)', fontFamily: r.bold ? 'var(--font-display)' : 'inherit' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting || vehicles.length === 0}>
            {submitting ? 'Processing...' : 'Proceed to Payment'}
          </button>
        </div>
      </form>

      {paymentOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 10, 20, 0.72)',
          backdropFilter: 'blur(3px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div className="card" style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', borderColor: 'var(--border-light)' }}>
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 6 }}>Payment Window</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Complete payment to lock Slot {slot.slotNumber} for your selected duration.
              </p>
            </div>

            <form onSubmit={handlePaymentAndReserve} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 6 }}>
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isActive = payment.method === method.key;
                    return (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => setPayment((prev) => ({ ...prev, method: method.key }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          justifyContent: 'center',
                          padding: '10px 12px',
                          background: isActive ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <Icon size={15} />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {payment.method === 'card' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name on Card</label>
                    <input
                      className="form-input"
                      type="text"
                      value={payment.cardName}
                      onChange={(e) => setPayment((prev) => ({ ...prev, cardName: e.target.value }))}
                      placeholder="Card holder name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Card Number</label>
                    <input
                      className="form-input"
                      type="text"
                      value={payment.cardNumber}
                      onChange={(e) => setPayment((prev) => ({ ...prev, cardNumber: e.target.value.replace(/[^\d\s]/g, '').slice(0, 19) }))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Expiry (MM/YY)</label>
                      <input
                        className="form-input"
                        type="text"
                        value={payment.expiry}
                        onChange={(e) => setPayment((prev) => ({ ...prev, expiry: e.target.value.replace(/[^\d/]/g, '').slice(0, 5) }))}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CVV</label>
                      <input
                        className="form-input"
                        type="password"
                        value={payment.cvv}
                        onChange={(e) => setPayment((prev) => ({ ...prev, cvv: e.target.value.replace(/[^\d]/g, '').slice(0, 3) }))}
                        placeholder="***"
                        maxLength={3}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {payment.method === 'upi' && (
                <div className="form-group">
                  <label className="form-label">UPI ID</label>
                  <input
                    className="form-input"
                    type="text"
                    value={payment.upiId}
                    onChange={(e) => setPayment((prev) => ({ ...prev, upiId: e.target.value.trim() }))}
                    placeholder="example@upi"
                    required
                  />
                </div>
              )}

              {payment.method === 'netbanking' && (
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={payment.bankName}
                    onChange={(e) => setPayment((prev) => ({ ...prev, bankName: e.target.value }))}
                    placeholder="Your bank"
                    required
                  />
                </div>
              )}

              {payment.method === 'wallet' && (
                <div className="form-group">
                  <label className="form-label">Wallet Provider</label>
                  <input
                    className="form-input"
                    type="text"
                    value={payment.walletProvider}
                    onChange={(e) => setPayment((prev) => ({ ...prev, walletProvider: e.target.value }))}
                    placeholder="Paytm / PhonePe / Amazon Pay"
                    required
                  />
                </div>
              )}

              <div className="card" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <span>Duration</span>
                  <span>{hours} hour{hours !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>
                  <span>Rate</span>
                  <span>₹{slot.pricePerHour}/hr</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Amount Payable</span>
                  <strong style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 18 }}>₹{estimatedCost}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentOpen(false)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  Back
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
                  {submitting ? 'Processing Payment...' : `Pay ₹${estimatedCost} & Reserve`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
