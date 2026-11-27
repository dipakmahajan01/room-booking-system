import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginResponse, User } from '@rbs/shared';
import { apiFetch, setUnauthorizedHandler, tokenStore } from '../api/client';

const USER_KEY = 'rbs.user';

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadUser(): User | null {
  if (!tokenStore.get()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    queryClient.clear(); // don't leak one user's data to the next login
    setUser(null);
  }, [queryClient]);

  // Any 401 from the API (e.g. expired token) logs the user out.
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
