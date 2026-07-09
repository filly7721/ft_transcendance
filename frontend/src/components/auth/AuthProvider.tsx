"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as authApi from "@/lib/auth";
import type { User } from "@/lib/auth";
import { getToken, setToken, clearToken } from "@/lib/auth-storage";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: User };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, login: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy init so SSR/first paint never has to flip synchronously from
  // "loading" to "guest" when there was never a token to check.
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: "loading", user: null } : { status: "guest", user: null },
  );

  useEffect(() => {
    if (state.status !== "loading") return;
    // Token exists but may be stale/expired/for a deleted account — verify it.
    authApi
      .fetchMe()
      .then((user) => setState({ status: "authenticated", user }))
      .catch(() => {
        clearToken();
        setState({ status: "guest", user: null });
      });
  }, [state.status]);

  const login = useCallback(async (email: string, password: string) => {
    const { user, accessToken } = await authApi.login(email, password);
    setToken(accessToken);
    setState({ status: "authenticated", user });
  }, []);

  const register = useCallback(async (email: string, loginName: string, password: string) => {
    const { user, accessToken } = await authApi.register(email, loginName, password);
    setToken(accessToken);
    setState({ status: "authenticated", user });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ status: "guest", user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
