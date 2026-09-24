import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Brand from '../ui/Brand';
import { useAuth } from '../../context/AuthContext';

export default function AppShell({ navItems, roleLabel, identity, accent = 'blue' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.success('Signed out securely');
    navigate('/login');
  };

  const Sidebar = ({ mobile = false }) => <aside className={`ps-sidebar ${mobile ? `ps-sidebar-mobile ${open ? 'open' : ''}` : 'ps-sidebar-desktop'} role-${accent}`}>
    <div className="ps-sidebar-brand"><Brand />{mobile && <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button>}</div>
    <div className="ps-role-chip"><i />{roleLabel}</div>
    <div className="ps-identity">
      <div className="ps-avatar">{(identity?.name || user?.name || 'P').charAt(0).toUpperCase()}</div>
      <div><strong>{identity?.name || user?.name}</strong><span>{identity?.subtitle || user?.email}</span></div>
    </div>
    <nav className="ps-nav" aria-label={`${roleLabel} navigation`}>
      <span className="ps-nav-label">Workspace</span>
      {navItems.map(({ to, icon: Icon, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `ps-nav-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span><ChevronRight className="nav-chevron" size={14} /></NavLink>)}
    </nav>
    <button className="ps-logout" onClick={handleLogout}><LogOut size={17} /> Sign out</button>
  </aside>;

  return <div className="ps-app-shell">
    <Sidebar />
    <Sidebar mobile />
    {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="ps-main-wrap">
      <header className="ps-topbar">
        <button className="icon-btn mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <div className="topbar-context"><span>ParkSmart</span><ChevronRight size={13} /><strong>{roleLabel}</strong></div>
        <div className="topbar-actions"><div className="topbar-avatar" title={user?.name}>{user?.name?.charAt(0).toUpperCase()}</div></div>
      </header>
      <main className="ps-main"><div className="ps-content"><Outlet /></div></main>
    </div>
  </div>;
}
