import { act, render } from '@testing-library/react';
import useAvailabilitySocket from './useAvailabilitySocket';

const sockets = [];
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const handlers = {};
    const socket = {
      on: vi.fn((name, fn) => { handlers[name] = fn; }),
      disconnect: vi.fn(),
      emit: (name, payload) => handlers[name]?.(payload),
    };
    sockets.push(socket);
    return socket;
  }),
}));

function Probe(props) {
  useAvailabilitySocket(props);
  return null;
}

beforeEach(() => { sockets.length = 0; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

test('debounces bursts of events into one refresh', () => {
  const onChange = vi.fn();
  render(<Probe debounceMs={300} onChange={onChange} />);
  act(() => { sockets[0].emit('availability:changed', {}); sockets[0].emit('availability:changed', {}); });
  act(() => { vi.advanceTimersByTime(299); });
  expect(onChange).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(1); });
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('ignores events for other locations but accepts untagged ones', () => {
  const onChange = vi.fn();
  render(<Probe locationId="loc-1" debounceMs={180} onChange={onChange} />);
  act(() => { sockets[0].emit('availability:changed', { locationId: 'loc-2' }); vi.advanceTimersByTime(200); });
  expect(onChange).not.toHaveBeenCalled();
  act(() => { sockets[0].emit('availability:changed', { locationId: 'loc-1' }); vi.advanceTimersByTime(200); });
  act(() => { sockets[0].emit('availability:changed', {}); vi.advanceTimersByTime(200); });
  expect(onChange).toHaveBeenCalledTimes(2);
});

test('a new callback does not reconnect; a new location does', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<Probe locationId="loc-1" debounceMs={180} onChange={first} />);
  rerender(<Probe locationId="loc-1" debounceMs={180} onChange={second} />);
  expect(sockets).toHaveLength(1);
  act(() => { sockets[0].emit('availability:changed', {}); vi.advanceTimersByTime(180); });
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);

  rerender(<Probe locationId="loc-2" debounceMs={180} onChange={second} />);
  expect(sockets[0].disconnect).toHaveBeenCalled();
  expect(sockets).toHaveLength(2);
});

test('disabled opens no socket and unmount disconnects', () => {
  const { rerender, unmount } = render(<Probe enabled={false} debounceMs={180} onChange={() => {}} />);
  expect(sockets).toHaveLength(0);
  rerender(<Probe enabled debounceMs={180} onChange={() => {}} />);
  unmount();
  expect(sockets[0].disconnect).toHaveBeenCalled();
});
