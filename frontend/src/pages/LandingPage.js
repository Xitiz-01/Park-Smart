import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Gauge,
  MapPin,
  Navigation,
  ParkingCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  Zap,
} from 'lucide-react';
import Brand from '../components/ui/Brand';

const features = [
  { icon: Radio, title: 'Live availability', desc: 'See current slot status and make a confident choice before you arrive.' },
  { icon: Navigation, title: 'Location-aware discovery', desc: 'Explore nearby parking on a map or scan clear, filterable listings.' },
  { icon: CalendarCheck2, title: 'Simple reservations', desc: 'Select a slot, add your vehicle, and keep every booking in one place.' },
  { icon: ShieldCheck, title: 'Role-based control', desc: 'Purpose-built workspaces keep drivers, operators, and admins focused.' },
];

const audiences = [
  { icon: UsersRound, label: 'For drivers', copy: 'Find, compare, reserve, and manage parking without the usual guesswork.' },
  { icon: Store, label: 'For operators', copy: 'Manage locations, slots, and incoming bookings from one live workspace.' },
  { icon: Gauge, label: 'For admins', copy: 'Monitor system activity and keep users, inventory, and vendors moving.' },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <nav className="landing-nav" aria-label="Primary navigation">
        <div className="container landing-nav-inner">
          <Link to="/" aria-label="ParkSmart home"><Brand /></Link>
          <div className="landing-nav-links">
            <a href="#platform">Platform</a>
            <a href="#built-for">Built for</a>
          </div>
          <div className="landing-nav-actions">
            <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get started <ArrowRight size={15} /></Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="landing-hero">
          <div className="container hero-grid">
            <div className="hero-copy fade-in">
              <span className="eyebrow"><Sparkles size={14} /> Live parking intelligence for modern cities</span>
              <h1>Parking, without<br />the <span>searching.</span></h1>
              <p className="hero-lede">Find available parking, reserve with confidence, and arrive knowing your space is ready. ParkSmart turns a daily frustration into a smooth journey.</p>
              <div className="hero-actions">
                <Link to="/register" className="btn btn-primary btn-lg">Find your space <ArrowRight size={18} /></Link>
                <Link to="/login" className="btn btn-outline btn-lg">I already have an account</Link>
              </div>
              <div className="hero-proof">
                <span><CheckCircle2 size={16} /> Live slot status</span>
                <span><CheckCircle2 size={16} /> Secure booking</span>
                <span><CheckCircle2 size={16} /> Operator tools</span>
              </div>
            </div>

            <div className="mobility-visual" aria-label="Illustration of the ParkSmart parking experience">
              <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
              <div className="map-plane">
                <span className="map-road road-one" /><span className="map-road road-two" />
                <span className="map-point point-one"><MapPin size={15} /></span>
                <span className="map-point point-two"><MapPin size={15} /></span>
                <span className="map-point point-three"><MapPin size={15} /></span>
              </div>
              <div className="parking-deck">
                <div className="deck-head"><span><ParkingCircle size={19} /> Nearby parking</span><i>Live</i></div>
                <div className="parking-bays">
                  <span className="bay bay-open">P</span><span className="bay bay-busy">P</span><span className="bay bay-open">P</span>
                  <span className="bay bay-open">P</span><span className="bay bay-hold">P</span><span className="bay bay-open">P</span>
                </div>
                <div className="deck-footer"><span><i className="dot open" /> Available</span><span><i className="dot hold" /> Reserved</span></div>
              </div>
              <div className="visual-card visual-card-route"><Navigation size={18} /><span><small>Next step</small>Navigate to your slot</span></div>
              <div className="visual-card visual-card-signal"><Zap size={17} /><span><small>Status</small>Updated in real time</span></div>
            </div>
          </div>
        </section>

        <section className="journey-strip" aria-label="ParkSmart booking journey">
          <div className="container journey-inner">
            <span>One effortless journey</span>
            <div><b>01</b> Find nearby</div><ArrowRight size={16} />
            <div><b>02</b> Reserve a slot</div><ArrowRight size={16} />
            <div><b>03</b> Arrive &amp; park</div>
          </div>
        </section>

        <section className="landing-section" id="platform">
          <div className="container">
            <div className="section-heading">
              <span className="page-eyebrow">A calmer parking experience</span>
              <h2>Everything you need to move with confidence.</h2>
              <p>Clarity at every step, from the first search to the final booking.</p>
            </div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, desc }, index) => (
                <article className="feature-card" key={title}>
                  <div className="feature-number">0{index + 1}</div>
                  <div className="feature-icon"><Icon size={21} /></div>
                  <h3>{title}</h3><p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section audience-section" id="built-for">
          <div className="container audience-layout">
            <div className="audience-intro">
              <span className="page-eyebrow">One connected platform</span>
              <h2>Designed for every side of the parking experience.</h2>
              <p>Each workspace reveals exactly what that role needs—without clutter or crossed wires.</p>
              <Link to="/register" className="text-link">Create your account <ArrowRight size={16} /></Link>
            </div>
            <div className="audience-cards">
              {audiences.map(({ icon: Icon, label, copy }) => (
                <article className="audience-card" key={label}>
                  <span><Icon size={19} /></span><div><h3>{label}</h3><p>{copy}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="container">
            <div className="cta-panel">
              <div className="cta-icon"><Building2 size={28} /></div>
              <div><span className="page-eyebrow">Ready when you are</span><h2>Your next parking spot is closer than you think.</h2></div>
              <Link to="/register" className="btn btn-light btn-lg">Start with ParkSmart <ArrowRight size={18} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container"><Brand compact /><p>Real-time parking availability and guidance.</p><span>© 2026 ParkSmart</span></div>
      </footer>
    </div>
  );
}
