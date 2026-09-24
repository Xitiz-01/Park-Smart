import React from 'react';

export default function MetricCard({ label, value, detail, icon, tone = 'blue' }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-copy"><strong>{value}</strong><span>{label}</span>{detail && <small>{detail}</small>}</div>
      <div className="metric-glow" />
    </article>
  );
}
