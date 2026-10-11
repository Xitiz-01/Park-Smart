import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/env';
import { isAvailabilityEventForLocation } from '@/utils/hybridParking';

// Listens for the backend's `availability:changed` events and calls onChange,
// debounced. With a locationId, only events for that location count.
//
// The callback is read through a ref, so a new onChange on every render does
// not tear down and reopen the connection (Find Parking used to reconnect on
// every filter keystroke). The socket only reconnects when `enabled` or
// `locationId` change.
export default function useAvailabilitySocket({ enabled = true, locationId, debounceMs, onChange }) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = io(SOCKET_URL, { transports: ['websocket'], withCredentials: true });
    let timer;
    socket.on('availability:changed', (event = {}) => {
      if (locationId && !isAvailabilityEventForLocation({ locationId: event.locationId }, locationId)) return;
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current?.(), debounceMs);
    });
    return () => { clearTimeout(timer); socket.disconnect(); };
  }, [enabled, locationId, debounceMs]);
}
