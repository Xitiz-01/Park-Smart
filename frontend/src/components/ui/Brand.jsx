import React from 'react';
import { ParkingCircle } from 'lucide-react';

export default function Brand({ compact = false }) {
  return (
    <div className={`ps-brand ${compact ? 'ps-brand-compact' : ''}`} aria-label="ParkSmart">
      <span className="ps-brand-mark"><ParkingCircle size={compact ? 20 : 24} strokeWidth={2.4} /></span>
      <span>PARK<span>SMART</span></span>
    </div>
  );
}
