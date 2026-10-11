import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EVSlotBoard, { isSlotSelectable, slotDisplayStatus } from './EVSlotBoard';

const slots = [
  { _id: 'available', slotNumber: 'EV01', chargerPowerKw: 22, connectorType: 'Type 2', available: true, availabilityStatus: 'available' },
  { _id: 'reserved', slotNumber: 'EV02', chargerPowerKw: 60, available: false, availabilityStatus: 'reserved' },
  { _id: 'maintenance', slotNumber: 'EV03', chargerPowerKw: 7, available: false, availabilityStatus: 'maintenance' },
  { _id: 'occupied', slotNumber: 'EV04', chargerPowerKw: 22, available: false, availabilityStatus: 'occupied' },
  { _id: 'unavailable', slotNumber: 'EV05', chargerPowerKw: 11, available: false, availabilityStatus: 'unavailable' },
];

test('EV slot board renders textual operational states and accessible labels', () => {
  const markup = renderToStaticMarkup(<EVSlotBoard slots={slots} title="Test EV board" />);
  expect(markup).toContain('EV01, 22 kilowatt, Available');
  expect(markup).toContain('Reserved');
  expect(markup).toContain('Maintenance');
  expect(markup).toContain('Occupied');
  expect(markup).toContain('EV05, 11 kilowatt, Unavailable');
});

test('only available slots are selectable and selection is visually represented', () => {
  expect(isSlotSelectable(slots[0])).toBe(true);
  expect(isSlotSelectable(slots[1])).toBe(false);
  expect(isSlotSelectable(slots[2])).toBe(false);
  expect(slotDisplayStatus(slots[0], 'available')).toBe('selected');
  const markup = renderToStaticMarkup(<EVSlotBoard slots={slots} selectedId="available" onSelect={() => {}} />);
  expect(markup).toContain('state-selected');
  expect(markup).toContain('disabled=""');
});
