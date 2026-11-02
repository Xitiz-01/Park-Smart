import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { vendorsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';

const editableFields = [
  ['businessName', 'Business name', 'organization'], ['businessType', 'Business type', 'off'], ['phone', 'Business phone', 'tel'],
];

function Section({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t py-8 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

export default function VendorProfile() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    vendorsAPI.getMyProfile()
      .then(({ data }) => { setProfile(data.vendorProfile); setForm(data.vendorProfile); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(editableFields.map(([field]) => [field, form[field]]));
      const { data } = await vendorsAPI.updateMyProfile(payload);
      setProfile(data.vendorProfile);
      setForm(data.vendorProfile);
      await refreshUser();
      toast.success('Business profile saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  const header = <PageHeader eyebrow="Operator" title="Business profile" description="The business drivers see on their bookings, and the account behind it." />;
  if (loading) return <>{header}<ListSkeleton rows={2} /></>;
  if (failed || !profile) return <>{header}<ErrorState description="Your business profile didn’t load. Check your connection and try again." onRetry={load} /></>;

  const address = profile.businessAddress?.formattedAddress || [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ');

  return (
    <>
      {header}
      <Section id="business" title="Business details" description="Shown to drivers with their booking.">
        <form onSubmit={save} className="grid gap-5">
          {editableFields.map(([field, label, autoComplete]) => (
            <FormField key={field} label={label} required>
              <Input name={field} autoComplete={autoComplete} type={field === 'phone' ? 'tel' : 'text'} value={form[field] || ''} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
            </FormField>
          ))}
          <div>
            <Button type="submit" disabled={saving}>{saving && <Spinner data-icon="inline-start" />}{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </Section>
      <Section id="account" title="Account" description="Set when your application was approved. Contact support to change these.">
        <dl className="m-0 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-text-muted">Name</dt><dd className="m-0">{user?.name}</dd>
          <dt className="text-text-muted">Email</dt><dd className="m-0 break-words">{user?.email}</dd>
          {/* Was always green whatever the status (audit M). */}
          <dt className="text-text-muted">Approval</dt><dd className="m-0"><StatusBadge status={profile.vendorStatus} /></dd>
          <dt className="text-text-muted">Business address</dt><dd className="m-0">{address || 'Not set'}</dd>
        </dl>
        <p className="mt-5 text-sm text-text-muted">
          Identity, business and bank checks are on <Link to="/vendor/verification" className="font-medium text-brand hover:underline">Verification</Link>.
        </p>
      </Section>
    </>
  );
}
