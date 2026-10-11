import React from 'react';
import { ArrowLeft, CheckCircle2, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from '../ui/Brand';

const benefits = [
  'Live availability before you arrive',
  'Fast, secure parking reservations',
  'One place for vehicles and bookings',
];

export default function AuthShell({ eyebrow, title, description, children, footer }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="ParkSmart overview">
        <Link to="/" className="auth-brand"><Brand /></Link>
        <div className="auth-story-copy">
          <span className="eyebrow"><Sparkles size={14} /> Smarter city parking</span>
          <h1>Spend less time circling.<br /><span>Start moving.</span></h1>
          <p>ParkSmart connects drivers with live parking inventory and gives operators one calm place to manage it.</p>
          <ul>
            {benefits.map((benefit) => <li key={benefit}><CheckCircle2 size={17} />{benefit}</li>)}
          </ul>
        </div>
        <div className="auth-route-art" aria-hidden="true">
          <div className="auth-route-line" />
          <span className="auth-pin auth-pin-start"><MapPinned size={18} /></span>
          <span className="auth-pin auth-pin-end"><ShieldCheck size={18} /></span>
        </div>
        <p className="auth-trust"><ShieldCheck size={15} /> Your account is protected with secure authentication.</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand"><Link to="/"><Brand /></Link></div>
        <div className="auth-card fade-in">
          <Link to="/" className="auth-back"><ArrowLeft size={15} /> Back to home</Link>
          <header>
            <span className="page-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </header>
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}
