"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthTokens, Me } from "@nidaa/shared";
import { api, tokens } from "./api";

interface AuthCtx {
  me: Me | null | undefined;
  ready: boolean;
  isAuthenticated: boolean;
  error: unknown;
  signIn: (payload: { email: string; password: string }) => Promise<Me>;
  signUp: (payload: { email: string; password: string; fullName: string; phone: string | null; locale: "fr" | "ar" | "en" }) => Promise<Me>;
  signOut: () => Promise<void>;
  refetchMe: () => Promise<Me | undefined>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => { setHasToken(!!tokens.access || !!tokens.refresh); }, []);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/me"),
    enabled: hasToken === true,
    retry: false,
    staleTime: 60_000,
  });

  const applyAuth = useCallback((res: { user: Me; tokens: AuthTokens }) => {
    tokens.set(res.tokens);
    setHasToken(true);
    qc.setQueryData(["me"], res.user);
    return res.user;
  }, [qc]);

  const signIn = useCallback(async (payload: { email: string; password: string }) => applyAuth(await api.post<{ user: Me; tokens: AuthTokens }>("/auth/login", payload)), [applyAuth]);
  const signUp = useCallback(async (payload: Parameters<AuthCtx["signUp"]>[0]) => applyAuth(await api.post<{ user: Me; tokens: AuthTokens }>("/auth/register", payload)), [applyAuth]);
  const signOut = useCallback(async () => {
    const rt = tokens.refresh;
    try { if (rt) await api.post("/auth/logout", { refreshToken: rt }); } catch { /* ignore */ }
    tokens.clear();
    setHasToken(false);
    qc.clear();
  }, [qc]);
  const refetchMe = useCallback(async () => (await meQuery.refetch()).data, [meQuery]);

  const value = useMemo<AuthCtx>(() => ({
    me: hasToken ? meQuery.data : null,
    ready: hasToken === false || (hasToken === true && !meQuery.isPending),
    isAuthenticated: hasToken === true && !!meQuery.data,
    error: meQuery.error,
    signIn, signUp, signOut, refetchMe,
  }), [hasToken, meQuery.data, meQuery.isPending, meQuery.error, signIn, signUp, signOut, refetchMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}
