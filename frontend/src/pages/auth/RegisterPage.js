import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../../components/auth/AuthShell';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await register(data);
      toast.success('Account created! Welcome to ParkSmart.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      description="Your simpler parking routine starts here."
      footer={<p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group"><label className="form-label" htmlFor="name">Full name</label><div className="input-with-icon"><UserRound size={17} /><input id="name" name="name" className="form-input" placeholder="Your full name" value={form.name} onChange={handleChange} autoComplete="name" required /></div></div>
        <div className="auth-field-row">
          <div className="form-group"><label className="form-label" htmlFor="email">Email address</label><div className="input-with-icon"><Mail size={17} /><input id="email" name="email" type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" required /></div></div>
          <div className="form-group"><label className="form-label" htmlFor="phone">Phone number</label><div className="input-with-icon"><Phone size={17} /><input id="phone" name="phone" type="tel" className="form-input" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} autoComplete="tel" required /></div></div>
        </div>
        <div className="form-group"><label className="form-label" htmlFor="password">Password</label><div className="input-with-icon input-with-action"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="At least 6 characters" value={form.password} onChange={handleChange} autoComplete="new-password" minLength="6" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
        <div className="form-group"><label className="form-label" htmlFor="confirmPassword">Confirm password</label><div className="input-with-icon"><LockKeyhole size={17} /><input id="confirmPassword" name="confirmPassword" type="password" className="form-input" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" required /></div></div>
        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>{loading ? <><span className="button-spinner" /> Creating account…</> : <>Create account <span aria-hidden="true">→</span></>}</button>
      </form>
    </AuthShell>
  );
}
