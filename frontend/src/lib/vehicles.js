import { physicalVehicleType } from '@/utils/hybridParking';

// Display labels for vehicle fields. Same parts as utils/hybridParking's
// vehicleClassificationLabel (left untouched), with SUV, MPV, CNG and EV
// spelt as acronyms instead of "Suv".
const ACRONYMS = new Set(['suv', 'mpv', 'cng', 'ev']);

export const optionLabel = (value) => {
  const text = String(value || '');
  if (!text) return '';
  return ACRONYMS.has(text.toLowerCase()) ? text.toUpperCase() : text[0].toUpperCase() + text.slice(1).toLowerCase();
};

export const vehicleLabel = (vehicle) => [
  physicalVehicleType(vehicle),
  vehicle?.bodyStyle,
  vehicle?.fuelType || (String(vehicle?.vehicleType).toLowerCase() === 'ev' ? 'electric' : null),
].filter(Boolean).map(optionLabel).join(' · ');
