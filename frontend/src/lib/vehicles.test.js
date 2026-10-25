import { optionLabel, vehicleLabel } from './vehicles';

test('acronyms stay upper case, other words get a capital', () => {
  expect(optionLabel('suv')).toBe('SUV');
  expect(optionLabel('cng')).toBe('CNG');
  expect(optionLabel('hatchback')).toBe('Hatchback');
});

test('vehicle label matches the classification parts', () => {
  expect(vehicleLabel({ vehicleType: 'car', bodyStyle: 'suv', fuelType: 'electric' })).toBe('Car · SUV · Electric');
  expect(vehicleLabel({ vehicleType: 'ev' })).toBe('Car · Electric');
  expect(vehicleLabel({ vehicleType: 'bike', fuelType: 'petrol' })).toBe('Motorcycle · Petrol');
});
