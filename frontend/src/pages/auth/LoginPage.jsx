import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import AuthShell from '../../components/auth/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRoute } from '../../utils/authRouting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import FormField from '@/components/kit/FormField';
import PasswordInput from '@/components/kit/PasswordInput';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef(null);
  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(getDefaultRoute(user));
    } catch (err) {
      setError(err.message || 'Sign-in failed. Check your email and password and try again.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title="Sign in"
      description="Pick up where you left off."
      footer={<p>New to ParkSmart? <Link to="/register" className="font-medium text-brand underline-offset-4 hover:underline">Create an account</Link></p>}
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <FormField label="Email address">
          <Input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" spellCheck={false} required />
        </FormField>
        <FormField label="Password">
          <PasswordInput name="password" placeholder="Your password" value={form.password} onChange={handleChange} autoComplete="current-password" required />
        </FormField>
        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger outline-none">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <><Spinner data-icon="inline-start" />Signing in…</> : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
