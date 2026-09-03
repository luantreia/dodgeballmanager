import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getEquiposDelUsuario } from '../../features/equipo/services/equipoService';
import type { Equipo } from '../../shared/utils/types/types';
import { useToast } from '../../shared/components/Toast/ToastProvider';
import { useAuth } from './AuthContext';

type EquipoContextValue = {
  equipos: Equipo[];
  equipoSeleccionado: Equipo | null;
  loading: boolean;
  seleccionarEquipo: (equipoId: string) => void;
  recargarEquipos: () => Promise<void>;
};

const EquipoContext = createContext<EquipoContextValue | undefined>(undefined);

const EQUIPO_STORAGE_KEY = 'overtime_equipo_actual';

export const EquipoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();
  // El token es la señal de "hay sesión y es esta". Sin esta dependencia el provider cargaba
  // los equipos una sola vez al montar la app: en la pantalla de login eso daba 401 y dejaba
  // `equipos` vacío para siempre, así que recién logueado `RequireEquipo` mandaba al
  // onboarding a un DT que ya tenía equipo, y solo se arreglaba recargando la página a mano.
  const { token, user } = useAuth();
  const usuarioId = user?.id ?? null;

  const cargarEquipos = useCallback(async () => {
    if (!token) {
      setEquipos([]);
      setEquipoSeleccionado(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const equiposUsuario = await getEquiposDelUsuario();
      setEquipos(equiposUsuario);

      const storedEquipoId = localStorage.getItem(EQUIPO_STORAGE_KEY);
      if (storedEquipoId) {
        const matched = equiposUsuario.find((equipo) => equipo.id === storedEquipoId);
        if (matched) {
          setEquipoSeleccionado(matched);
          return;
        }
      }

      setEquipoSeleccionado(equiposUsuario[0] ?? null);
    } catch (error) {
      console.error('Error cargando equipos', error);
      setEquipos([]);
      setEquipoSeleccionado(null);
      addToast({ type: 'error', title: 'No se pudieron cargar los equipos', message: (error as any)?.message });
    } finally {
      setLoading(false);
    }
  }, [addToast, token]);

  // `usuarioId` además del token: garantiza que un cambio de cuenta en el mismo dispositivo
  // vuelva a pedir los equipos en vez de reusar los del usuario anterior.
  useEffect(() => {
    void cargarEquipos();
  }, [cargarEquipos, usuarioId]);

  const seleccionarEquipo = useCallback(
    (equipoId: string) => {
      const nextEquipo = equipos.find((equipo) => equipo.id === equipoId) ?? null;
      setEquipoSeleccionado(nextEquipo);
      if (nextEquipo) {
        localStorage.setItem(EQUIPO_STORAGE_KEY, nextEquipo.id);
      } else {
        localStorage.removeItem(EQUIPO_STORAGE_KEY);
      }
    },
    [equipos]
  );

  const value = useMemo(
    () => ({
      equipos,
      equipoSeleccionado,
      loading,
      seleccionarEquipo,
      recargarEquipos: cargarEquipos,
    }),
    [equipos, equipoSeleccionado, loading, seleccionarEquipo, cargarEquipos]
  );

  return <EquipoContext.Provider value={value}>{children}</EquipoContext.Provider>;
};

export const useEquipo = () => {
  const context = useContext(EquipoContext);
  if (!context) {
    throw new Error('useEquipo debe utilizarse dentro de EquipoProvider');
  }
  return context;
};
