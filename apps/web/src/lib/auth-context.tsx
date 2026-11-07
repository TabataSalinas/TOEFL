'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, tokenStore } from './api';
import { TokenPair } from './types';

interface Me {
  id: string;
  email: string;
  name: string | null;
  profile: {
    targetTotalScore: number;
    testDate: string | null;
    preferredStudyMinutesPerDay: number;
    theme: string;
    nativeLanguage: string | null;
    currentStreakDays: number;
    longestStreakDays: number;
  } | null;
}

interface AuthCtx {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<Me>('/users/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const tokens = await api.post<TokenPair>('/auth/login', { email, password });
    tokenStore.set(tokens);
    await refreshUser();
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, name?: string) => {
    const tokens = await api.post<TokenPair>('/auth/register', {
      email,
      password,
      name,
    });
    tokenStore.set(tokens);
    await refreshUser();
    router.push('/dashboard');
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
