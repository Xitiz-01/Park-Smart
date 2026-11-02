import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { authClient } from '../../lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import FormField from '@/components/kit/FormField';
import PageHeader from '@/components/kit/PageHeader';
import PasswordInput from '@/components/kit/PasswordInput';
import StatusBadge from '@/components/kit/StatusBadge';

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

// Same password rules as before (match, at least 8 characters), inline.
export function validatePasswordChange(form) {
  const errors = {};
  if (form.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.';
  if (form.confirmPassword !== form.newPassword) errors.confirmPassword = 'Passwords don’t match. Re-enter the new password.';
  return errors;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await authAPI.updateProfile(profileForm);
      await refreshUser();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Your profile wasn’t saved. Try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePwSave = async (event) => {
    event.preventDefault();
    const errors = validatePasswordChange(pwForm);
    setPwErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingPw(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message);
      toast.success('Password changed');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwErrors({ currentPassword: err.message || 'The password wasn’t changed. Check your current password.' });
    } finally {
      setSavingPw(false);
    }
  };

  const updatePw = (field) => (event) => {
    setPwForm({ ...pwForm, [field]: event.target.value });
    if (pwErrors[field]) setPwErrors({ ...pwErrors, [field]: undefined });
  };

  return (
    <>
      <PageHeader eyebrow="Driver" title="Profile" description="Your account details and sign-in password." />
      <div className="rounded-2xl border bg-card p-6 shadow-hairline sm:p-8">
        <Section id="account-title" title="Account" description="How you sign in to ParkSmart.">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-text-muted">Email</dt><dd className="mt-1 break-all">{user?.email}</dd></div>
            <div><dt className="text-sm text-text-muted">Role</dt><dd className="mt-1"><StatusBadge status={user?.role || 'customer'} /></dd></div>
            {user?.authUserId && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-text-muted">Auth ID</dt>
                <dd className="mt-1"><code className="rounded-md bg-surface-sunken px-2 py-1 font-mono text-sm break-all">{user.authUserId}</code></dd>
              </div>
            )}
          </dl>
        </Section>

        <Section id="personal-title" title="Personal details" description="Shown to operators on your bookings.">
          <form onSubmit={handleProfileSave} className="grid gap-5">
            <FormField label="Full name">
              <Input name="name" autoComplete="name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required />
            </FormField>
            <FormField label="Phone number">
              <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required />
            </FormField>
            <div><Button type="submit" disabled={savingProfile}>{savingProfile ? <><Spinner data-icon="inline-start" />Saving…</> : 'Save details'}</Button></div>
          </form>
        </Section>

        <Section id="password-title" title="Password" description="Changing it signs you out on your other devices.">
          <form onSubmit={handlePwSave} className="grid gap-5">
            <FormField label="Current password" error={pwErrors.currentPassword}>
              <PasswordInput name="currentPassword" autoComplete="current-password" value={pwForm.currentPassword} onChange={updatePw('currentPassword')} required />
            </FormField>
            <FormField label="New password" description="At least 8 characters." error={pwErrors.newPassword}>
              <PasswordInput name="newPassword" autoComplete="new-password" value={pwForm.newPassword} onChange={updatePw('newPassword')} required />
            </FormField>
            <FormField label="Confirm new password" error={pwErrors.confirmPassword}>
              <PasswordInput name="confirmPassword" autoComplete="new-password" value={pwForm.confirmPassword} onChange={updatePw('confirmPassword')} required />
            </FormField>
            <div><Button type="submit" disabled={savingPw}>{savingPw ? <><Spinner data-icon="inline-start" />Changing…</> : 'Change password'}</Button></div>
          </form>
        </Section>
      </div>
    </>
  );
}
