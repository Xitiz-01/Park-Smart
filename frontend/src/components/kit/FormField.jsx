import { useId } from 'react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// Label, optional hint and inline error around a single control. The control
// (the only child) receives id, aria-describedby and aria-invalid, so the
// label is clickable and the error is announced with the field.
//
//   <FormField label="Email" error={errors.email}>
//     <Input type="email" autoComplete="email" … />
//   </FormField>
export default function FormField({ label, description, error, required = false, className, children }) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div data-invalid={Boolean(error) || undefined} className={cn('grid content-start gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}{required && <span aria-hidden="true" className="text-text-muted"> *</span>}
      </label>
      <Slot.Root id={id} aria-describedby={describedBy} aria-invalid={Boolean(error) || undefined} required={required || undefined}>
        {children}
      </Slot.Root>
      {description && !error && <p id={descriptionId} className="text-sm text-text-muted">{description}</p>}
      {error && <p id={errorId} className="text-sm text-danger">{error}</p>}
    </div>
  );
}
