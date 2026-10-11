import EvLotMap from '@/components/kit/lotmap/EvLotMap';
import { SLOT_STATES, isSlotSelectable, slotDisplayStatus } from '@/lib/slotStates';

// Kept for its existing callers and exports; the board itself is now the EV
// Lot Map (same states, selection rules and accessible names).
export { SLOT_STATES, isSlotSelectable, slotDisplayStatus };

export default function EVSlotBoard({ slots = [], selectedId = '', onSelect, title = 'EV charging bays', subtitle, ...rest }) {
  return (
    <EvLotMap
      slots={slots}
      selectedId={selectedId}
      onSelect={onSelect}
      label={title}
      aside={subtitle ? <p className="max-w-xs text-right text-xs text-lot-text-muted">{subtitle}</p> : undefined}
      {...rest}
    />
  );
}
