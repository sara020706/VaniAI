import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authApi } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/api-client";
import type { RegisterPayload, User } from "@/types";

interface AuthContextValue {
  /** The authenticated user, or null when signed out. */
  user: User | null;
  /** True while the session is being bootstrapped from a stored token. */
  isLoading: boolean;
  /** Sign in; resolves with the user so callers can redirect by role. */
  login: (email: string, password: string) => Promise<User>;
  /**
   * Student self-registration; creates the account then signs in with the
   * same credentials. Resolves with the authenticated user.
   */
  register: (data: RegisterPayload) => Promise<User>;
  /** Revoke the refresh token and clear the session. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() =>
    Boolean(getAccessToken()),
  );

  // Bootstrap the session from /auth/me when a token exists. The api-client
  // interceptor transparently refreshes an expired access token.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) {
          clearTokens();
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const response = await authApi.login(email, password);
      setUser(response.user);
      return response.user;
    },
    [],
  );

  const register = useCallback(
    async (data: RegisterPayload): Promise<User> => {
      await authApi.register(data);
      const response = await authApi.login(data.email, data.password);
      setUser(response.user);
      return response.user;
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Token revocation is best-effort; the local session is cleared anyway.
      clearTokens();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}
