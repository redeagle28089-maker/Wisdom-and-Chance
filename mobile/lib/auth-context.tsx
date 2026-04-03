import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api, User, setToken, clearToken, saveUserData, getSavedUser } from './api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const savedUser = await getSavedUser();
      if (savedUser) {
        setUser(savedUser);
        try {
          const freshUser = await api.getMe();
          setUser(freshUser);
          await saveUserData(freshUser);
        } catch {
          await clearToken();
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, firstName?: string, lastName?: string) {
    const result = await api.login({
      email,
      firstName,
      lastName,
      provider: 'email',
    });
    await setToken(result.token);
    await saveUserData(result.user);
    setUser(result.user);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  async function refreshUser() {
    try {
      const freshUser = await api.getMe();
      setUser(freshUser);
      await saveUserData(freshUser);
    } catch {}
  }

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
