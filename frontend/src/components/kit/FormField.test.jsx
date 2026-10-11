import { render, screen } from '@testing-library/react';
import FormField from './FormField';
import PasswordInput from './PasswordInput';

test('wires label, hint and error to the control', () => {
  const { rerender } = render(<FormField label="Password" description="At least 8 characters."><PasswordInput name="password" /></FormField>);
  const input = screen.getByLabelText('Password');
  expect(input).toHaveProperty('name', 'password');
  expect(input.getAttribute('aria-describedby')).toMatch(/-description$/);
  expect(input.getAttribute('aria-invalid')).toBeNull();

  rerender(<FormField label="Password" description="At least 8 characters." error="Use at least 8 characters."><PasswordInput name="password" /></FormField>);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')).toMatch(/-error$/);
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Use at least 8 characters.');
});
