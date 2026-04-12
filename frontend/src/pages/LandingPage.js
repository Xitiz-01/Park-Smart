import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Shield, Zap, ArrowRight, Car } from 'lucide-react';

const features = [
  { icon: <Clock size={22} />, title: 'Real-Time Availability', desc: 'Live slot status updated instantly across all zones.' },
  { icon: <MapPin size={22} />, title: 'Smart Slot Guidance', desc: 'Navigate directly to your reserved slot with ease.' },
  { icon: <Shield size={22} />, title: 'Secure Booking', desc: 'JWT-protected accounts with encrypted data.' },
  { icon: <Zap size={22} />, title: 'Instant Reservations', desc: 'Reserve your spot in seconds, no queues.' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Navbar */}
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
        <div className="container flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Car color="var(--accent)" size={28} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              PARK<span style={{ color: 'var(--accent)' }}>SMART</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/login" className="btn btn-outline btn-sm">Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '100px 0 80px', textAlign: 'center' }}>
        <div className="container">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 20, padding: '6px 16px', marginBottom: 28, fontSize: 13, color: 'var(--accent)'
          }}>
            <Zap size={14} /> Real-Time Parking Intelligence
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 700, lineHeight: 1.15, marginBottom: 20,
            color: 'var(--text-primary)'
          }}>
            Find &amp; Reserve<br />
            <span style={{ color: 'var(--accent)' }}>Parking Instantly</span>
          </h1>
          <p style={{ maxWidth: 520, margin: '0 auto 40px', color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.7 }}>
            Real-time slot availability, smart guidance, and hassle-free reservations — all in one system.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary btn-lg">
              Get Started <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg">Sign In</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '60px 0 100px' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{ transition: 'transform 0.2s, border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ color: 'var(--accent)', marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          © 2024 ParkSmart – Real-Time Parking Slot Availability Analysis &amp; Guidance System
        </p>
      </footer>
    </div>
  );
}
