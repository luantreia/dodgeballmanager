import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  login as loginRequest,
  register as registerRequest,
  getProfile,
} from '../../features/auth/services/authService';
import type { Usuario } from '../../shared/utils/types/types';

type AuthContextValue = {
  user: Usuario | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (nombre: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'overtime_token';
const REFRESH_TOKEN_STORAGE_KEY = 'overtime_refresh_token';

/**
 * Todo lo que la app persiste por sesión vive bajo este prefijo y se borra junto con los
 * tokens. Es un panel que rota entre DTs del mismo club en un celular compartido: si al
 * cerrar sesión queda el equipo seleccionado del usuario anterior, el siguiente entra
 * mirando —y editando— datos que no son suyos.
 */
const SESSION_STORAGE_PREFIX = 'overtime_';

const limpiarSesionPersistida = () => {
  const claves: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const clave = localStorage.key(i);
    if (clave?.startsWith(SESSION_STORAGE_PREFIX)) claves.push(clave);
  }
  claves.forEach((clave) => localStorage.removeItem(clave));
};

const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);
const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

const setStoredToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

const setStoredRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [, setRefreshToken] = useState<string | null>(() => getStoredRefreshToken());

  const handleProfileLoad = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await getProfile();
      setUser(profile);
      setError(null);
    } catch (err) {
      console.error(err);
      // Solo un rechazo de credenciales cierra la sesión. El backend vive en el plan free de
      // Render: un cold start devuelve 502/504 o directamente corta la conexión, y tratar eso
      // como "token inválido" expulsaba al usuario cada vez que abría la app tras un rato.
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        limpiarSesionPersistida();
        setUser(null);
        setToken(null);
        setRefreshToken(null);
      } else {
        setError('No pudimos verificar tu sesión. Revisá tu conexión y reintentá.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void handleProfileLoad();
    } else {
      setLoading(false);
    }
  }, [handleProfileLoad, token]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const { accessToken, refreshToken: rt, user } = await loginRequest({ email, password });
      setStoredToken(accessToken);
      setStoredRefreshToken(rt);
      setToken(accessToken);
      setRefreshToken(rt ?? null);
      setUser(user);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Credenciales inválidas o servicio no disponible');
      limpiarSesionPersistida();
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (nombre: string, email: string, password: string) => {
    try {
      setLoading(true);
      const { accessToken, refreshToken: rt, user } = await registerRequest({ nombre, email, password });
      setStoredToken(accessToken);
      setStoredRefreshToken(rt);
      setToken(accessToken);
      setRefreshToken(rt ?? null);
      setUser(user);
      setError(null);
    } catch (err) {
      console.error(err);
      limpiarSesionPersistida();
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    limpiarSesionPersistida();
    setUser(null);
    setToken(null);
    setRefreshToken(null);
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
      token,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, loading, error, token, login, register, logout, refreshProfile]
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

export const useToken = () => {
  const { token } = useAuth();
  return token;
};
