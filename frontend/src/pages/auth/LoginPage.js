import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../../components/auth/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRoute } from '../../utils/authRouting';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(getDefaultRoute(user));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to ParkSmart"
      description="Pick up where you left off and get moving."
      footer={<p className="auth-switch">New to ParkSmart? <Link to="/register">Create an account</Link></p>}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email address</label>
          <div className="input-with-icon"><Mail size={17} /><input id="email" name="email" type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" required /></div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="input-with-icon input-with-action"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Enter your password" value={form.password} onChange={handleChange} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        </div>
        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>{loading ? <><span className="button-spinner" /> Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}</button>
      </form>
    </AuthShell>
  );
}
