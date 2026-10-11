import { act, fireEvent, render, screen, within } from '@testing-library/react';
import EvLotMap from './EvLotMap';
import CapacityLotMap, { capacityCells } from './CapacityLotMap';
import CapacityTimeline from './CapacityTimeline';
import { timelineStarts } from './useCapacityTimeline';

const slot = (id, number, status, kw = 22) => ({
  _id: id, slotNumber: number, chargerPowerKw: kw, connectorType: 'CCS2',
  availabilityStatus: status, available: status === 'available',
});

const slots = [
  slot('a', 'EV01', 'available'),
  slot('b', 'EV02', 'reserved', 60),
  slot('c', 'EV03', 'available'),
  slot('d', 'EV04', 'maintenance'),
  slot('e', 'EV05', 'occupied'),
  slot('f', 'EV06', 'unavailable', 11),
];

describe('EV mode', () => {
  test('is a listbox of named bays; only free bays can be picked', () => {
    const onSelect = vi.fn();
    render(<EvLotMap slots={slots} onSelect={onSelect} rate={60} />);
    const listbox = screen.getByRole('listbox', { name: 'EV charging bays' });
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(screen.getByRole('option', { name: 'EV01, 22 kilowatt, Available' })).toBeEnabled();
    expect(screen.getByRole('option', { name: 'EV02, 60 kilowatt, Reserved' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'EV06, 11 kilowatt, Unavailable' })).toBeDisabled();
    // every state is written out, not just coloured
    for (const text of ['Available', 'Reserved', 'Maintenance', 'Occupied', 'Unavailable']) expect(listbox.textContent).toContain(text);

    fireEvent.click(screen.getByRole('option', { name: /EV03/ }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  test('shows the selection and keeps one tab stop on it', () => {
    render(<EvLotMap slots={slots} selectedId="c" onSelect={() => {}} />);
    const selected = screen.getByRole('option', { name: 'EV03, 22 kilowatt, Selected' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(screen.getAllByRole('option').filter((o) => o.tabIndex === 0)).toHaveLength(1);
  });

  test('arrow keys move between free bays, skipping taken ones; Enter picks', () => {
    const onSelect = vi.fn();
    render(<EvLotMap slots={slots} onSelect={onSelect} />);
    const first = screen.getByRole('option', { name: /EV01/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const third = screen.getByRole('option', { name: /EV03/ });
    expect(document.activeElement).toBe(third);
    fireEvent.keyDown(third, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(third);
    fireEvent.click(document.activeElement); // Enter/Space on a native button fire click
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  test('a live update changes the bay state and shows the message', () => {
    const { rerender } = render(<EvLotMap slots={slots} selectedId="c" onSelect={() => {}} />);
    const taken = slots.map((s) => (s._id === 'c' ? slot('c', 'EV03', 'reserved') : s));
    act(() => { rerender(<EvLotMap slots={taken} selectedId="" onSelect={() => {}} notice="EV03 was just taken. Pick another bay." />); });
    expect(screen.getByRole('option', { name: 'EV03, 22 kilowatt, Reserved' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('EV03 was just taken');
    expect(screen.queryByRole('option', { selected: true })).toBeNull();
  });

  test('without onSelect it is a read-only list (operator view)', () => {
    render(<EvLotMap slots={slots} label="Riverside EV bays" />);
    const list = screen.getByRole('list', { name: 'Riverside EV bays' });
    expect(screen.queryByRole('option')).toBeNull();
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
  });
});

describe('Capacity mode', () => {
  test('headline uses the real counts and the pool is not interactive', () => {
    render(<CapacityLotMap total={12} reserved={5} available={7} windowLabel="Today, 10:00–12:00" />);
    expect(screen.getByText(/of/).textContent).toMatch(/7 of 12 spaces free/);
    expect(screen.getByRole('img', { name: '7 of 12 spaces free for Today, 10:00–12:00' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
  });

  test('a full lot says so', () => {
    render(<CapacityLotMap total={20} reserved={20} available={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Full for this time');
  });

  test('a closed lot draws no bays', () => {
    render(<CapacityLotMap total={0} reserved={0} available={0} isOpen={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('closed');
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('large lots are drawn to scale and say so', () => {
    render(<CapacityLotMap total={200} reserved={60} available={140} />);
    expect(screen.getByText('Each bay shown = 5 spaces')).toBeInTheDocument();
  });

  test('capacityCells never shows a full lot as free or a free lot as full', () => {
    expect(capacityCells(70, 0)).toEqual({ cells: 35, perCell: 2, taken: 0 });
    expect(capacityCells(70, 70).taken).toBe(35);
    expect(capacityCells(70, 69).taken).toBe(34);
    expect(capacityCells(70, 1).taken).toBe(1);
    expect(capacityCells(0, 0)).toEqual({ cells: 0, perCell: 1, taken: 0 });
  });
});

describe('Capacity timeline', () => {
  test('does not call out a window when all are equal', () => {
    const at = (h) => new Date(`2026-10-11T${String(h).padStart(2, '0')}:00:00`);
    render(<CapacityTimeline windows={[10, 11].map((h) => ({ start: at(h), end: at(h + 2), available: 5, total: 5, isOpen: true }))} />);
    expect(screen.queryByText('Most free')).toBeNull();
  });

  test('starts at the next whole hour', () => {
    const starts = timelineStarts(new Date('2026-10-11T09:20:00'), 3);
    expect(starts.map((d) => d.getHours())).toEqual([10, 11, 12]);
    expect(starts[0].getMinutes()).toBe(0);
  });

  test('marks the quietest window, disables full or closed ones, and picks', () => {
    const at = (h) => new Date(`2026-10-11T${String(h).padStart(2, '0')}:00:00`);
    const windows = [
      { start: at(10), end: at(12), available: 3, total: 10, isOpen: true },
      { start: at(11), end: at(13), available: 0, total: 10, isOpen: true },
      { start: at(12), end: at(14), available: 9, total: 10, isOpen: true },
      { start: at(13), end: at(15), available: 0, total: 0, isOpen: false },
    ];
    const onPick = vi.fn();
    render(<CapacityTimeline windows={windows} selectedStart={at(10)} onPick={onPick} />);
    expect(screen.getByRole('button', { name: /10:00.*3 of 10 free/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /11:00.*0 of 10 free/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /13:00.*closed/ })).toBeDisabled();
    const best = screen.getByRole('button', { name: /12:00.*most free/ });
    fireEvent.click(best);
    expect(onPick).toHaveBeenCalledWith(windows[2].start, windows[2].end);
  });
});
