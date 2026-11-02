import { validatePasswordChange } from './ProfilePage';

test('keeps the existing password rules', () => {
  expect(validatePasswordChange({ newPassword: 'longenough', confirmPassword: 'longenough' })).toEqual({});
  expect(validatePasswordChange({ newPassword: 'short', confirmPassword: 'short' })).toHaveProperty('newPassword');
  expect(validatePasswordChange({ newPassword: 'longenough', confirmPassword: 'other1234' })).toHaveProperty('confirmPassword');
});
