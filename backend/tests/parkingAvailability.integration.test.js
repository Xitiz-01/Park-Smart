const test = require('node:test');
const assert = require('node:assert/strict');
const { isOpenForWindow, parseWindow } = require('../services/parkingAvailabilityService');

const closedWeek = () => Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((day) => [day, { open: false, allDay: false, openTime: '06:00', closeTime: '23:00' }])
);

test('operating hours evaluate full reservation windows in Asia/Kolkata', () => {
  const operatingHours = closedWeek();
  operatingHours.monday = { open: true, allDay: false, openTime: '06:00', closeTime: '23:00' };
  const location = { operatingHours };
  assert.equal(isOpenForWindow(location, new Date('2026-09-28T01:00:00Z'), new Date('2026-09-28T17:00:00Z')), true);
  assert.equal(isOpenForWindow(location, new Date('2026-09-28T01:00:00Z'), new Date('2026-09-28T18:00:00Z')), false);
});

test('overnight operating hours cover the next local day without gaps', () => {
  const operatingHours = closedWeek();
  operatingHours.friday = { open: true, allDay: false, openTime: '22:00', closeTime: '02:00' };
  const location = { operatingHours };
  assert.equal(isOpenForWindow(location, new Date('2026-10-02T17:00:00Z'), new Date('2026-10-02T20:00:00Z')), true);
  assert.equal(isOpenForWindow(location, new Date('2026-10-02T20:00:00Z'), new Date('2026-10-02T22:00:00Z')), false);
});

test('time range validation rejects inverted and excessive windows', () => {
  assert.ok(parseWindow('invalid', 'also-invalid').error);
  assert.ok(parseWindow(new Date(Date.now() + 3600000), new Date(Date.now() + 9 * 24 * 3600000)).error);
});
