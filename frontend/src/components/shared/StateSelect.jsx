import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { INDIAN_STATES } from '../../data/indianStates';

// Extra props (id, aria-*) come from FormField and land on the <select>.
export default function StateSelect({ value, onChange, required = true, ...props }) {
  return (
    <NativeSelect className="w-full" value={value || ''} onChange={(event) => onChange(event.target.value)} required={required} {...props}>
      <NativeSelectOption value="">Select state or UT</NativeSelectOption>
      {INDIAN_STATES.map((state) => <NativeSelectOption key={state} value={state}>{state}</NativeSelectOption>)}
    </NativeSelect>
  );
}
