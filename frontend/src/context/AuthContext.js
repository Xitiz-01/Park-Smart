import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const saveSessionUser = (account, vendorProfile = null) => {
    const nextUser = account ? { ...account, vendorProfile } : null;
    if (nextUser) localStorage.setItem('user', JSON.stringify(nextUser));
    else localStorage.removeItem('user');
    setUser(nextUser);
    return nextUser;
  };

  const refreshUser = async () => {
    const res = await authAPI.getProfile();
    return saveSessionUser(res.data.user, res.data.vendorProfile);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      refreshUser()
        .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

const login = async (credentials) => {
  try {
    const res = await authAPI.login(credentials);
    const { token, user, vendorProfile } = res.data;

    localStorage.setItem('token', token);
    return saveSessionUser(user, vendorProfile);
  } catch (error) {
    throw error; 
  }
};
  

 const register = async (data) => {
  try {
    const res = await authAPI.register(data);
    const { token, user, vendorProfile } = res.data;

    localStorage.setItem('token', token);
    return saveSessionUser(user, vendorProfile);
  } catch (error) {
    throw error; 
  }
};

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      refreshUser,
      loading,
      isAdmin: user?.role === 'admin',
      isApprovedVendor: user?.role === 'vendor' && user?.vendorProfile?.vendorStatus === 'active',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
