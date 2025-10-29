import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { login as loginRequest, getProfile } from '../api/auth';
import type { Usuario } from '../types';

type AuthContextValue = {
  user: Usuario | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'overtime_token';

const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

const setStoredToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleProfileLoad = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await getProfile();
      setUser(profile);
      setError(null);
    } catch (err) {
      console.error(err);
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      handleProfileLoad();
    } else {
      setLoading(false);
    }
  }, [handleProfileLoad]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const { accessToken, user } = await loginRequest({ email, password });
      setStoredToken(accessToken);
      setUser(user);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Credenciales inválidas o servicio no disponible');
      setUser(null);
      setStoredToken(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await handleProfileLoad();
  }, [handleProfileLoad]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshProfile,
    }),
    [user, loading, error, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
