import { useId, useRef, useState } from 'react';
import { Check, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// Searchable single-select over a list of strings. Same props as the legacy
// shared/SearchableSelect, so the vehicle catalogue flow can switch without
// logic changes: onChange receives the chosen string.
export default function SearchableSelect({
  label, value, options, onChange, placeholder, loading = false, error = '', onRetry,
  disabled = false, required = false,
}) {
  const id = useId();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}{required && <span aria-hidden="true" className="text-text-muted"> *</span>}
      </label>
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              disabled={disabled || loading}
              className="w-full justify-between bg-surface-raised px-3 font-normal"
            >
              <span className={cn('truncate', !value && 'text-text-muted')}>
                {loading ? 'Loading…' : value || placeholder}
              </span>
              {loading ? <Spinner /> : <ChevronsUpDown aria-hidden="true" className="text-text-muted" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
            <Command>
              <CommandInput aria-label={`Search ${String(label).toLowerCase()}`} placeholder={`Search ${String(label).toLowerCase()}…`} />
              <CommandList>
                <CommandEmpty>No matching options</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => { onChange(option); setOpen(false); }}
                    >
                      <Check aria-hidden="true" className={cn('size-4', option === value ? 'opacity-100' : 'opacity-0')} />
                      {option}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {/* Keeps native `required` validation: the browser anchors its message
            here and focus is handed back to the trigger. */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={value || ''}
            onChange={() => {}}
            onFocus={() => triggerRef.current?.focus()}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
          />
        )}
      </div>
      {error && (
        <div id={errorId} role="alert" className="flex items-center justify-between gap-2 text-sm text-danger">
          <span>{error}</span>
          {onRetry && (
            <Button type="button" variant="link" size="sm" onClick={onRetry} className="h-auto p-0">
              <RefreshCw data-icon="inline-start" />Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
