import React from 'react';
import { BatteryCharging, PlugZap } from 'lucide-react';

export const SLOT_STATES = ['available', 'selected', 'reserved', 'occupied', 'maintenance', 'unavailable'];

export const slotDisplayStatus = (slot, selectedId) => {
  if (selectedId && slot._id === selectedId && slot.available) return 'selected';
  if (slot.availabilityStatus) return slot.availabilityStatus;
  if (slot.status && slot.status !== 'available') return slot.status;
  return slot.available === false ? 'unavailable' : 'available';
};

export const isSlotSelectable = (slot) => slotDisplayStatus(slot) === 'available';

const labelFor = (status) => status[0].toUpperCase() + status.slice(1);

const SlotContent = ({ slot, status }) => <>
  <span className="ev-slot-icon"><PlugZap size={17} aria-hidden="true" /></span>
  <strong>{slot.slotNumber}</strong>
  <span>{slot.chargerPowerKw ? `${slot.chargerPowerKw} kW` : 'EV charger'}</span>
  <small>{slot.connectorType || slot.chargerType || 'Connector not specified'}</small>
  <em>{labelFor(status)}</em>
</>;

export default function EVSlotBoard({
  slots = [], selectedId = '', onSelect, title = 'EV charging bays', subtitle,
}) {
  const interactive = typeof onSelect === 'function';
  const available = slots.filter((slot) => slotDisplayStatus(slot, selectedId) === 'available').length
    + (selectedId ? slots.filter((slot) => slotDisplayStatus(slot, selectedId) === 'selected').length : 0);

  return <div className="ev-slot-board">
    <div className="ev-slot-board-head">
      <div><span className="page-eyebrow"><BatteryCharging size={13} /> Live EV inventory</span><h3>{title}</h3></div>
      <div className="ev-slot-count"><strong>{available}</strong><span>of {slots.length} available</span></div>
    </div>
    {subtitle && <p className="ev-slot-subtitle">{subtitle}</p>}
    <div className="ev-slot-grid" role={interactive ? 'listbox' : 'list'} aria-label={title}>
      {slots.map((slot) => {
        const status = slotDisplayStatus(slot, selectedId);
        const ariaLabel = `${slot.slotNumber}, ${slot.chargerPowerKw || 0} kilowatt, ${labelFor(status)}`;
        return interactive
          ? <button
            key={slot._id}
            type="button"
            role="option"
            aria-selected={status === 'selected'}
            aria-label={ariaLabel}
            disabled={!isSlotSelectable(slot) && status !== 'selected'}
            className={`ev-slot-tile state-${status}`}
            onClick={() => onSelect(slot._id)}
          ><SlotContent slot={slot} status={status} /></button>
          : <div key={slot._id} role="listitem" aria-label={ariaLabel} className={`ev-slot-tile state-${status}`}><SlotContent slot={slot} status={status} /></div>;
      })}
      {!slots.length && <div className="ev-slot-board-empty"><PlugZap size={24} /><span>No EV charging bays configured.</span></div>}
    </div>
    <div className="ev-slot-legend" aria-label="Slot status legend">
      {SLOT_STATES.filter((status) => status !== 'selected' || interactive).map((status) => <span key={status}><i className={`state-${status}`} />{labelFor(status)}</span>)}
    </div>
  </div>;
}
