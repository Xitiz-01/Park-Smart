import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import AuthShell from '../../components/auth/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import FormField from '@/components/kit/FormField';
import PasswordInput from '@/components/kit/PasswordInput';

// Same rules as before (passwords match, at least 8 characters), now shown
// next to the field instead of in a toast.
export function validateRegistration(form) {
  const errors = {};
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords don’t match. Re-enter the same password.';
  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    if (errors[event.target.name]) setErrors({ ...errors, [event.target.name]: undefined });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    const found = validateRegistration(form);
    setErrors(found);
    const firstInvalid = ['password', 'confirmPassword'].find((name) => found[name]);
    if (firstInvalid) {
      requestAnimationFrame(() => formRef.current?.elements.namedItem(firstInvalid)?.focus());
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await register(data);
      toast.success('Account created. Welcome to ParkSmart.');
      navigate('/dashboard');
    } catch (error) {
      setServerError(error.message || 'Your account wasn’t created. Check your details and try again.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Free to sign up. Find and reserve parking in a few taps."
      footer={<p>Already have an account? <Link to="/login" className="font-medium text-brand underline-offset-4 hover:underline">Sign in</Link></p>}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-5">
        <FormField label="Full name">
          <Input name="name" placeholder="Your full name" value={form.name} onChange={handleChange} autoComplete="name" required />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Email address">
            <Input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" spellCheck={false} required />
          </FormField>
          <FormField label="Phone number">
            <Input name="phone" type="tel" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} autoComplete="tel" required />
          </FormField>
        </div>
        <FormField label="Password" description="At least 8 characters." error={errors.password}>
          <PasswordInput name="password" value={form.password} onChange={handleChange} autoComplete="new-password" required />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword}>
          <PasswordInput name="confirmPassword" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" required />
        </FormField>
        {serverError && (
          <div role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <><Spinner data-icon="inline-start" />Creating account…</> : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
