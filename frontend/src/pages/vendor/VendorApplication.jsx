import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { vendorsAPI } from '../../services/api';
import AddressLocationPicker, { emptyAddressSelection } from '../../components/shared/AddressLocationPicker';
import MinimalShell from '../../components/workspace/MinimalShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import FormField from '@/components/kit/FormField';

const initialForm = {
  businessName: '', businessType: '', phone: '',
};

function Part({ number, id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="grid gap-5 border-t py-8 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-soft font-mono text-xs font-semibold text-brand-strong">{number}</span>
        <div>
          <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function VendorApplication() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...initialForm, phone: user?.phone || '' });
  const [address, setAddress] = useState(emptyAddressSelection);
  const [submitting, setSubmitting] = useState(false);
  const [addressError, setAddressError] = useState('');

  if (user?.vendorProfile) return <Navigate to="/vendor/status" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!address.verified || !address.selectionToken) {
      setAddressError('Pick one of the address suggestions so we can verify it.');
      return toast.error('Select a valid business address suggestion');
    }
    setAddressError('');
    setSubmitting(true);
    try {
      await vendorsAPI.register({
        ...form,
        address: address.addressLine1 || address.formattedAddress,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        latitude: address.latitude,
        longitude: address.longitude,
        selectionToken: address.selectionToken,
      });
      await refreshUser();
      toast.success('Vendor application submitted');
      navigate('/vendor/status', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MinimalShell>
      <p className="mb-2 text-sm font-medium text-text-muted">List your parking</p>
      <h1 className="font-display text-display-lg font-semibold text-balance">Apply to become an operator</h1>
      <p className="mt-2 max-w-prose text-text-muted">Tell us about your parking business. An administrator reviews every application before you can add locations.</p>
      <form onSubmit={submit} className="mt-8 rounded-2xl border bg-card p-5 shadow-hairline sm:p-8">
        <Part number="1" id="business-title" title="Your business">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Business name" required className="sm:col-span-2">
              <Input name="businessName" autoComplete="organization" maxLength={120} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            </FormField>
            <FormField label="Business type" description="For example: parking operator, mall, hotel." required>
              <Input name="businessType" autoComplete="off" maxLength={80} value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} />
            </FormField>
            <FormField label="Business phone" description="Indian mobile number." required>
              <Input name="phone" type="tel" autoComplete="tel" maxLength={80} pattern={'(?:\\+91[ -]?)?[6-9][0-9 ]{9,14}'} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
          </div>
        </Part>
        <Part number="2" id="address-title" title="Business address" description="Where your business is registered, not necessarily a car park.">
          <AddressLocationPicker value={address} onChange={(value) => { setAddress(value); if (value.verified) setAddressError(''); }} />
          {addressError && <p role="alert" className="text-sm text-danger">{addressError}</p>}
        </Part>
        <div className="flex flex-wrap gap-3 border-t pt-6">
          <Button type="submit" disabled={submitting}>{submitting && <Spinner data-icon="inline-start" />}{submitting ? 'Submitting…' : 'Submit application'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>Cancel</Button>
        </div>
      </form>
    </MinimalShell>
  );
}
