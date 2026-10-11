import React from 'react';
import { INDIAN_STATES } from '../../data/indianStates';

export default function StateSelect({ value, onChange, required = true }) {
  return (
    <select className="form-input" value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">Select state or union territory</option>
      {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
    </select>
  );
}
