import { fireEvent, render, screen } from '@testing-library/react';
import { ProviderCard } from './VendorVerification';
import { VERIFICATION_PROVIDERS } from '@/lib/verification';

const cashfree = VERIFICATION_PROVIDERS.find((provider) => provider.id === 'cashfree');

test('an unavailable provider shows why and offers no form', () => {
  render(<ProviderCard provider={cashfree} available={false} checks={[]} busy={false} onCheck={vi.fn()} />);
  expect(screen.getByText(/Not available yet:/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: cashfree.action })).toBeNull();
});

test('the bank account check asks for account number, IFSC and holder name, after consent', async () => {
  const onCheck = vi.fn().mockResolvedValue(true);
  render(<ProviderCard provider={cashfree} available checks={['PAN', 'BANK_ACCOUNT']} busy={false} onCheck={onCheck} />);

  expect(screen.getByLabelText(/PAN number/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Check'), { target: { value: 'BANK_ACCOUNT' } });
  fireEvent.change(screen.getByLabelText(/Account number/), { target: { value: '50100123456789' } });
  fireEvent.change(screen.getByLabelText(/IFSC/), { target: { value: 'HDFC0001234' } });
  fireEvent.change(screen.getByLabelText(/Account holder name/), { target: { value: 'Sample Parking' } });

  const submit = screen.getByRole('button', { name: cashfree.action });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(submit);

  expect(onCheck).toHaveBeenCalledWith('BANK_ACCOUNT', { accountNumber: '50100123456789', ifsc: 'HDFC0001234', name: 'Sample Parking', consent: true });
});

test('checks are limited to what the API has enabled', () => {
  render(<ProviderCard provider={cashfree} available checks={['GSTIN']} busy={false} onCheck={vi.fn()} />);
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['GSTIN']);
});
