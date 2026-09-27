import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authClient } from '../lib/authClient';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const authError = (error, fallback) => {
  const normalized = new Error(error?.message || fallback);
  normalized.code = error?.code;
  normalized.status = error?.status;
  return normalized;
};

export const AuthProvider = ({ children }) => {
  const { data: authSession, isPending: sessionPending, refetch: refetchSession } = authClient.useSession();
  const [user, setUser] = useState(null);
  const [profilePending, setProfilePending] = useState(true);

  const refreshUser = async () => {
    const res = await authAPI.getProfile();
    const nextUser = { ...res.data.user, vendorProfile: res.data.vendorProfile };
    setUser(nextUser);
    return nextUser;
  };

  useEffect(() => {
    if (sessionPending) return;
    if (!authSession?.user) {
      setUser(null);
      setProfilePending(false);
      return;
    }
    setProfilePending(true);
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setProfilePending(false));
  }, [sessionPending, authSession?.user?.id]);

  const login = async ({ email, password }) => {
    const result = await authClient.signIn.email({ email: email.trim(), password });
    if (result.error) throw authError(result.error, 'Login failed');
    await refetchSession();
    return refreshUser();
  };

  const register = async ({ name, email, phone, password }) => {
    const result = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    });
    if (result.error) throw authError(result.error, 'Registration failed');
    await refetchSession();
    return refreshUser();
  };

  const logout = async () => {
    try {
      await authClient.signOut();
    } finally {
      setUser(null);
      await refetchSession();
    }
  };

  const value = useMemo(() => ({
    user,
    authSession,
    login,
    register,
    logout,
    refreshUser,
    loading: sessionPending || profilePending,
    isAdmin: ['admin', 'super_admin'].includes(user?.role),
    isSuperAdmin: user?.role === 'super_admin',
    isApprovedVendor: user?.role === 'vendor' && user?.vendorProfile?.vendorStatus === 'active',
  }), [user, authSession, sessionPending, profilePending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
