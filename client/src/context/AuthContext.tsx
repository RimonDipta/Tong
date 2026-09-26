import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import api, { setAccessToken as setApiAccessToken } from "../lib/api";
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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  function updateAccessToken(token: string | null) {
    setApiAccessToken(token);
    setAccessTokenState(token);
  }

  function updateUser(updatedUser: User) {
    setUser(updatedUser);
  }

  const refreshCurrentUser = useCallback(async () => {
    const response = await api.get("/users/me");

    setUser(response.data.user);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await api.post("/auth/refresh");

      const token = response.data.accessToken;

      updateAccessToken(token);

      await refreshCurrentUser();

      return token;
    } catch {
      updateAccessToken(null);
      setUser(null);

      return null;
    }
  }, [refreshCurrentUser]);

  useEffect(() => {
    async function initializeAuth() {
      await refreshAccessToken();
      setLoading(false);
    }

    initializeAuth();
  }, [refreshAccessToken]);

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
        updateUser,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
