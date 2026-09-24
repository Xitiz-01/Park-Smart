import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete';
import LocationMapSelector from './LocationMapSelector';
import StateSelect from './StateSelect';
import { normalizeIndianState } from '../../data/indianStates';

export const emptyAddressSelection = {
  search: '', formattedAddress: '', addressLine1: '', city: '', district: '', state: '', pincode: '',
  country: 'India', latitude: null, longitude: null, provider: '', providerPlaceId: '', selectionToken: '', verified: false,
};

export default function AddressLocationPicker({ value, onChange }) {
  const selectSuggestion = (suggestion) => onChange({ ...suggestion, state: normalizeIndianState(suggestion.state), search: suggestion.formattedAddress, verified: true });
  const changeSearch = (search) => onChange({ ...value, search, verified: false, selectionToken: '' });

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Search Address</label>
        <AddressAutocomplete value={value.search || ''} onChange={changeSearch} onSelect={selectSuggestion} />
        <div style={{ fontSize: 12, color: value.verified ? 'var(--green)' : 'var(--text-muted)', marginTop: 4 }}>
          {value.verified ? <><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Location selected — drag the marker to fine-tune it</> : 'Select an autocomplete suggestion to verify this address.'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginTop: 14 }}>
        <div className="form-group"><label className="form-label">City</label><input className="form-input" value={value.city || ''} onChange={(e) => onChange({ ...value, city: e.target.value })} required /></div>
        <div className="form-group"><label className="form-label">State</label><StateSelect value={value.state} onChange={(state) => onChange({ ...value, state })} /></div>
        <div className="form-group"><label className="form-label">Pincode</label><input className="form-input" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={value.pincode || ''} onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} required /></div>
      </div>
      {value.verified && <>
        <LocationMapSelector latitude={value.latitude} longitude={value.longitude}
          onMove={({ latitude, longitude }) => onChange({ ...value, latitude, longitude })} />
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{Number(value.latitude).toFixed(6)}, {Number(value.longitude).toFixed(6)}</div>
      </>}
    </div>
  );
}
