import { useEffect, useId, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { locationAPI } from '../../services/api';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// Address search as an ARIA combobox: type at least three characters, move
// through suggestions with the arrow keys, Enter picks, Escape closes.
//
// `selected` is the address text that is already verified. When the input
// still says exactly that, nothing is searched: opening the location editor
// used to fire a geocoding request and open a dropdown over the form (audit U).
export default function AddressAutocomplete({
  value, selected = '', onChange, onSelect, id, required = true, 'aria-describedby': describedBy, 'aria-invalid': invalid,
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (selected && query === selected.trim()) { setSuggestions([]); setMessage(''); return undefined; }
    if (query.length < 3) { setSuggestions([]); setMessage(''); return undefined; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await locationAPI.autocomplete(query);
        setSuggestions(response.data.suggestions);
        setActive(-1);
        setOpen(true);
        if (!response.data.suggestions.length) setMessage('No matching Indian addresses found');
      } catch (error) {
        setSuggestions([]);
        setMessage(error.response?.data?.message || 'Address suggestions are unavailable');
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [value, selected]);

  const choose = (suggestion) => {
    setSuggestions([]);
    setMessage('');
    setOpen(false);
    setActive(-1);
    onSelect(suggestion);
  };

  const expanded = open && suggestions.length > 0;
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const optionId = (index) => `${listId}-option-${index}`;
  const statusId = `${listId}-status`;

  return (
    <div className="relative">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
        <input
          id={id}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          aria-describedby={[describedBy, message ? statusId : null].filter(Boolean).join(' ') || undefined}
          aria-invalid={invalid}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-surface-raised py-1 pr-9 pl-9 text-base outline-none placeholder:text-text-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm pointer-coarse:h-11"
          value={value}
          onChange={(event) => { onChange(event.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Search a full Indian address…"
          autoComplete="off"
          spellCheck={false}
          required={required}
        />
        {loading && <Spinner aria-hidden="true" className="absolute top-1/2 right-3 -translate-y-1/2 text-text-muted" />}
      </div>
      <p aria-live="polite" className="sr-only">{loading ? 'Searching addresses…' : expanded ? `${suggestions.length} suggestions` : ''}</p>
      {message && <p id={statusId} className="mt-1.5 text-sm text-slot-reserved">{message}</p>}
      <ul
        id={listId}
        role="listbox"
        aria-label="Address suggestions"
        hidden={!expanded}
        className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-[1000] m-0 max-h-72 list-none overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.providerPlaceId}:${suggestion.latitude}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(suggestion)}
            onMouseMove={() => setActive(index)}
            className={cn('flex cursor-pointer gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-snug', index === active && 'bg-accent text-accent-foreground')}
          >
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>{suggestion.formattedAddress}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
