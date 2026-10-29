import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import AddressAutocomplete from './AddressAutocomplete';
import { locationAPI } from '../../services/api';

vi.mock('../../services/api', () => ({ locationAPI: { autocomplete: vi.fn() } }));

const suggestions = [
  { providerPlaceId: 'a', latitude: 18.52, formattedAddress: 'FC Road, Pune' },
  { providerPlaceId: 'b', latitude: 18.51, formattedAddress: 'FC Road Annex, Pune' },
];

function Harness({ initial = '', selected = '', onSelect }) {
  const [value, setValue] = useState(initial);
  return <AddressAutocomplete id="address" value={value} selected={selected} onChange={setValue} onSelect={onSelect} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  locationAPI.autocomplete.mockReset();
  locationAPI.autocomplete.mockResolvedValue({ data: { suggestions } });
});
afterEach(() => vi.useRealTimers());

test('does not search when the field still holds the verified address (audit U)', async () => {
  render(<Harness initial="FC Road, Pune" selected="FC Road, Pune" onSelect={vi.fn()} />);
  await act(async () => { vi.advanceTimersByTime(800); });
  expect(locationAPI.autocomplete).not.toHaveBeenCalled();
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
});

test('arrow keys move through suggestions and Enter picks one', async () => {
  const onSelect = vi.fn();
  render(<Harness onSelect={onSelect} />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'FC Ro' } });
  await act(async () => { vi.advanceTimersByTime(600); });
  expect(locationAPI.autocomplete).toHaveBeenCalledWith('FC Ro');
  expect(input).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('option')).toHaveLength(2);

  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  const active = document.getElementById(input.getAttribute('aria-activedescendant'));
  expect(active).toHaveTextContent('FC Road Annex, Pune');
  expect(active).toHaveAttribute('aria-selected', 'true');

  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
  expect(input).toHaveAttribute('aria-expanded', 'false');
});

test('Escape closes the list without picking', async () => {
  const onSelect = vi.fn();
  render(<Harness onSelect={onSelect} />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Pune' } });
  await act(async () => { vi.advanceTimersByTime(600); });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveAttribute('aria-expanded', 'false');
  expect(onSelect).not.toHaveBeenCalled();
});
