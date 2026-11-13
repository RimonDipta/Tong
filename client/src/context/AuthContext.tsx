import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import api, {
  refreshAccessToken,
  setAccessToken as setApiAccessToken,
  setAuthHandlers,
} from "../lib/api";
import type { AuthResponse, User } from "../types/auth";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;

  register: (
    name: string,
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;

  logout: () => Promise<void>;

  updateUser: (user: User) => void;

  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const updateAccessToken = useCallback((token: string | null) => {
    setApiAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const response = await api.get("/users/me");

    setUser(response.data.user);
  }, []);

  useEffect(() => {
    setAuthHandlers({
      onTokenRefreshed: (token) => setAccessTokenState(token),
      onSessionExpired: () => {
        updateAccessToken(null);
        setUser(null);
      },
    });
  }, [updateAccessToken]);

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      const token = await refreshAccessToken();

      if (token && !cancelled) {
        try {
          await refreshCurrentUser();
        } catch {
          updateAccessToken(null);
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, [refreshCurrentUser, updateAccessToken]);

  async function register(
    name: string,
    username: string,
    email: string,
    password: string,
  ) {
    const response = await api.post<AuthResponse>("/auth/register", {
      name,
      username,
      email,
      password,
    });

    updateAccessToken(response.data.accessToken);

    setUser(response.data.user);
  }

  async function login(email: string, password: string) {
    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    updateAccessToken(response.data.accessToken);

    setUser(response.data.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      updateAccessToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        register,
        logout,
        updateUser: setUser,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
