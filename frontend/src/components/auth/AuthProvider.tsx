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
  /** Re-fetch the current user from /users/me. Call after profile updates
   *  (e.g. avatar upload, displayName change) so the cached user stays fresh. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: "loading", user: null } : { status: "guest", user: null },
  );

  useEffect(() => {
    if (state.status !== "loading") return;
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

  const refreshUser = useCallback(async () => {
    const user = await authApi.fetchMe();
    setState({ status: "authenticated", user });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
