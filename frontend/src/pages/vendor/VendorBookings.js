import React, { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';

export default function VendorBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { vendorsAPI.getBookings().then(({ data }) => setBookings(data.bookings)).catch((error) => toast.error(error.response?.data?.message || 'Unable to load bookings')).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return <div className="fade-in"><div className="page-header"><h1>Vendor Bookings</h1><p>Bookings for slots at your parking locations</p></div><div className="card"><div className="table-wrapper"><table><thead><tr><th>Booking</th><th>Customer</th><th>Vehicle</th><th>Location</th><th>Slot</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking._id}><td>{booking.bookingCode}</td><td>{booking.user?.name}<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{booking.user?.email}</span></td><td>{booking.vehicle?.licensePlate}</td><td>{booking.slot?.parkingLocation?.name}</td><td>{booking.slot?.slotNumber}</td><td>{format(new Date(booking.startTime), 'dd MMM yy, HH:mm')}</td><td>{format(new Date(booking.expectedEndTime), 'dd MMM yy, HH:mm')}</td><td><span className="badge badge-info">{booking.status}</span></td></tr>)}</tbody></table>{bookings.length === 0 && <div className="empty-state"><CalendarDays size={40} /><h3>No bookings for your locations yet.</h3></div>}</div></div></div>;
}
