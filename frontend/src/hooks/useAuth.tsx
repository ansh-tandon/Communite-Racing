import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEMO, SESSION_EXPIRED, tokenStore } from '../api/client';

import { auth } from '../api/endpoints';
import type { TokenOut, User } from '../api/types';

// Demo mode only: ?demo-login signs straight in as the sample player (handy for previews and screenshots).
if (DEMO && new URLSearchParams(location.search).has('demo-login')) tokenStore.set('demo.100');

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Set when a session ended on its own (expired token), so the login page can say why. */
  expired: boolean;
  signIn: (t: TokenOut) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(() => !!tokenStore.get());
  const [expired, setExpired] = useState(false);

  const me = useQuery({ queryKey: ['me'], queryFn: auth.me, enabled: hasToken, retry: false, staleTime: 5 * 60_000 });

  const signIn = useCallback((t: TokenOut) => {
    tokenStore.set(t.access_token);
    qc.setQueryData(['me'], t.user);
    setExpired(false);
    setHasToken(true);
  }, [qc]);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setHasToken(false);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    const onExpired = () => { setExpired(true); setHasToken(false); qc.clear(); };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, [qc]);

  const value = useMemo<AuthState>(() => ({
    user: hasToken ? me.data ?? null : null,
    loading: hasToken && me.isPending,
    expired,
    signIn,
    signOut,
  }), [hasToken, me.data, me.isPending, expired, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
