import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import FormField from '@/components/kit/FormField';
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
    <div className="grid gap-5">
      <FormField
        label="Search address"
        description={value.verified ? undefined : 'Pick a suggestion to verify the address.'}
        required
      >
        <AddressAutocomplete
          value={value.search || ''}
          selected={value.verified ? value.search || '' : ''}
          onChange={changeSearch}
          onSelect={selectSuggestion}
        />
      </FormField>
      {value.verified && (
        <p role="status" className="-mt-3 flex items-center gap-1.5 text-sm text-slot-available">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />Address verified. Drag the pin to the entrance if it’s off.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField label="City" required>
          <Input name="city" autoComplete="address-level2" value={value.city || ''} onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </FormField>
        <FormField label="State" required>
          <StateSelect value={value.state} onChange={(state) => onChange({ ...value, state })} />
        </FormField>
        <FormField label="Pincode" required>
          <Input
            name="pincode"
            autoComplete="postal-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="font-mono"
            value={value.pincode || ''}
            onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          />
        </FormField>
      </div>
      {value.verified && (
        <div>
          <LocationMapSelector
            latitude={value.latitude}
            longitude={value.longitude}
            onMove={({ latitude, longitude }) => onChange({ ...value, latitude, longitude })}
          />
          <p className="mt-1.5 text-right font-mono text-xs text-text-muted">
            <span className="sr-only">Pin position: </span>{Number(value.latitude).toFixed(6)}, {Number(value.longitude).toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}
