import React, { useEffect, useState } from 'react';
import { CalendarDays, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';

export default function VendorBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const load = () => { setLoading(true); vendorsAPI.getBookings().then(({ data }) => setBookings(data.bookings)).catch((error) => toast.error(error.response?.data?.message || 'Unable to load bookings')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const act = async (booking, action) => {
    setActing(`${booking._id}:${action}`);
    try {
      if (action === 'in') await vendorsAPI.checkInBooking(booking._id);
      else await vendorsAPI.checkOutBooking(booking._id);
      toast.success(action === 'in' ? 'Customer checked in' : 'Customer checked out');
      load();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update booking'); }
    finally { setActing(''); }
  };
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return <div className="fade-in"><div className="page-header flex items-center justify-between"><div><h1>Vendor Bookings</h1><p>Capacity and EV reservations at your locations</p></div><button className="btn btn-outline" onClick={load}><RefreshCw size={14} /> Refresh</button></div><div className="card"><div className="table-wrapper"><table><thead><tr><th>Booking</th><th>Customer</th><th>Vehicle</th><th>Location</th><th>Assignment</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking._id}><td>{booking.bookingCode}</td><td>{booking.user?.name}<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{booking.user?.email}</span></td><td>{booking.vehicle?.licensePlate}<br /><span style={{ textTransform: 'capitalize', fontSize: 12 }}>{booking.vehicleType}</span></td><td>{booking.parkingLocation?.name || booking.slot?.parkingLocation?.name || 'Legacy parking'}</td><td>{booking.bookingType === 'regular' ? 'Capacity reservation' : booking.slot?.slotNumber || 'Legacy slot'}</td><td>{format(new Date(booking.startTime), 'dd MMM yy, HH:mm')}</td><td>{format(new Date(booking.expectedEndTime), 'dd MMM yy, HH:mm')}</td><td><span className="badge badge-info">{booking.status}</span></td><td>{booking.status === 'upcoming' && <button className="btn btn-primary btn-sm" disabled={acting === `${booking._id}:in`} onClick={() => act(booking, 'in')}><LogIn size={13} /> Check in</button>}{booking.status === 'active' && <button className="btn btn-outline btn-sm" disabled={acting === `${booking._id}:out`} onClick={() => act(booking, 'out')}><LogOut size={13} /> Check out</button>}</td></tr>)}</tbody></table>{bookings.length === 0 && <div className="empty-state"><CalendarDays size={40} /><h3>No bookings for your locations yet.</h3></div>}</div></div></div>;
}
