import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Search } from 'lucide-react';

export default function SearchableSelect({
  label, value, options, onChange, placeholder, loading = false, error = '', onRetry,
  disabled = false, required = false,
}) {
  const id = useId();
  const listId = `${id}-listbox`;
  const blurTimer = useRef();
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => !needle || option.toLowerCase().includes(needle));
  }, [options, query]);

  const choose = (option) => {
    clearTimeout(blurTimer.current);
    setQuery(option);
    onChange(option);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault(); choose(matches[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false); setQuery(value || '');
    }
  };

  return <div className="form-group searchable-select">
    <label className="form-label" htmlFor={id}>{label}{required ? ' *' : ''}</label>
    <div className="searchable-select-input">
      <Search size={14} aria-hidden="true" />
      <input
        id={id}
        className="form-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
        value={query}
        placeholder={loading ? 'Loading…' : placeholder}
        disabled={disabled || loading}
        required={required}
        autoComplete="off"
        onFocus={() => { setOpen(true); setQuery(''); setActiveIndex(-1); }}
        onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setQuery(value || ''); }, 120); }}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); setOpen(true); if (value) onChange(''); }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown size={15} aria-hidden="true" />
    </div>
    {error && <div className="catalog-control-message" role="alert"><span>{error}</span>{onRetry && <button type="button" onClick={onRetry}><RefreshCw size={12} /> Retry</button>}</div>}
    {open && !error && !loading && <div id={listId} className="searchable-select-menu" role="listbox">
      {matches.map((option, index) => <button
        id={`${id}-option-${index}`}
        key={option}
        type="button"
        role="option"
        aria-selected={option === value}
        className={index === activeIndex ? 'active' : ''}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(option)}
      >{option}</button>)}
      {!matches.length && <p>No matching options</p>}
    </div>}
  </div>;
}
