import { useCallback, useEffect, useState } from 'react';
import { parkingLocationsAPI } from '@/services/api';
import { isElectricVehicle, physicalVehicleType } from '@/utils/hybridParking';

const HOUR = 3600000;
export const TIMELINE_WINDOWS = 8;

// Start times for the timeline: the next whole hours from now. The backend
// rejects windows that start in the past, so the first is the next hour.
export function timelineStarts(now = new Date(), count = TIMELINE_WINDOWS) {
  const first = new Date(now);
  first.setMinutes(0, 0, 0);
  first.setTime(first.getTime() + HOUR);
  return Array.from({ length: count }, (_, i) => new Date(first.getTime() + i * HOUR));
}

// Real capacity for the next few hours, from the same availability call the
// booking page uses: one request per window, same duration as the chosen one.
// Nothing is estimated; a window that fails to load is shown as unknown.
export default function useCapacityTimeline({ locationId, vehicle, durationMs, enabled = true }) {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(false);
  const duration = Math.max(HOUR, Number(durationMs) || 2 * HOUR);
  const vehicleType = vehicle ? physicalVehicleType(vehicle) : null;
  const fuelType = vehicle ? (isElectricVehicle(vehicle) ? 'electric' : vehicle.fuelType) : null;

  const load = useCallback(async () => {
    if (!enabled || !locationId || !vehicleType) { setWindows([]); return; }
    setLoading(true);
    const starts = timelineStarts();
    const results = await Promise.all(starts.map(async (start) => {
      const end = new Date(start.getTime() + duration);
      try {
        const { data } = await parkingLocationsAPI.getById(locationId, {
          vehicleType, fuelType, startTime: start.toISOString(), endTime: end.toISOString(),
        });
        const { available = 0, total = 0, isOpen = true } = data.location.availability || {};
        return { start, end, available, total, isOpen };
      } catch {
        return { start, end, unknown: true };
      }
    }));
    setWindows(results);
    setLoading(false);
  }, [enabled, locationId, vehicleType, fuelType, duration]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  return { windows, loading, reload: load };
}
