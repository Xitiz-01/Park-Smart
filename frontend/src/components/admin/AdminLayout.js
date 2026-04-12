import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, MapPin, CalendarDays, Users, LogOut, Car, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/admin',          icon: <LayoutDashboard size={18} />, label: 'Dashboard', end: true },
  { to: '/admin/slots',    icon: <MapPin size={18} />,          label: 'Slots' },
  { to: '/admin/bookings', icon: <CalendarDays size={18} />,    label: 'Bookings' },
  { to: '/admin/users',    icon: <Users size={18} />,           label: 'Users' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 240, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Car color="var(--accent)" size={24} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
              PARK<span style={{ color: 'var(--accent)' }}>SMART</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
            <Shield size={12} color="var(--yellow)" />
            <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600 }}>Admin Panel</span>
          </div>
        </div>

        {/* Admin info */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Signed in as</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px' }}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 'var(--radius-sm)', marginBottom: 4, fontSize: 14, fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                transition: 'all 0.15s',
              })}>
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 14,
            color: 'var(--text-muted)', background: 'none', transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
        <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
