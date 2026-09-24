import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { locationAPI } from '../../services/api';

export default function AddressAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const skipNextSearch = useRef(false);

  useEffect(() => {
    const query = value.trim();
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return undefined;
    }
    if (query.length < 3) { setSuggestions([]); setMessage(''); return undefined; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await locationAPI.autocomplete(query);
        setSuggestions(response.data.suggestions);
        if (!response.data.suggestions.length) setMessage('No matching Indian addresses found');
      } catch (error) {
        setSuggestions([]);
        setMessage(error.response?.data?.message || 'Address suggestions are unavailable');
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [value]);

  const choose = (suggestion) => {
    skipNextSearch.current = true;
    setSuggestions([]);
    setMessage('');
    onSelect(suggestion);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
        <input className="form-input" style={{ paddingLeft: 38 }} value={value}
          onChange={(event) => onChange(event.target.value)} placeholder="Search a complete Indian address..." autoComplete="off" required />
      </div>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Searching addresses…</div>}
      {message && <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 6 }}>{message}</div>}
      {suggestions.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 1000, top: 'calc(100% + 5px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 8, boxShadow: '0 16px 35px rgba(0,0,0,.45)', overflow: 'hidden' }}>
          {suggestions.map((suggestion) => (
            <button type="button" key={`${suggestion.providerPlaceId}:${suggestion.latitude}`} onClick={() => choose(suggestion)}
              style={{ width: '100%', display: 'flex', gap: 10, textAlign: 'left', padding: '11px 13px', color: 'var(--text-primary)', background: 'transparent', borderBottom: '1px solid var(--border)', lineHeight: 1.4 }}>
              <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{suggestion.formattedAddress}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
