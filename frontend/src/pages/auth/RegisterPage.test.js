import { validateRegistration } from './RegisterPage';

const base = { name: 'A', email: 'a@example.com', phone: '1', password: 'longenough', confirmPassword: 'longenough' };

test('accepts matching passwords of 8+ characters', () => {
  expect(validateRegistration(base)).toEqual({});
});

test('keeps the existing rules: at least 8 characters, and both passwords match', () => {
  expect(validateRegistration({ ...base, password: 'short', confirmPassword: 'short' })).toEqual({ password: expect.any(String) });
  expect(validateRegistration({ ...base, confirmPassword: 'different1' })).toEqual({ confirmPassword: expect.any(String) });
  expect(Object.keys(validateRegistration({ ...base, password: 'short', confirmPassword: 'other' }))).toEqual(['password', 'confirmPassword']);
});
