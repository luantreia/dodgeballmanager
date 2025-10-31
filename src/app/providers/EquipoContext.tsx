import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getEquiposDelUsuario } from '../../features/equipo/services/equipoService';
import type { Equipo } from '../../types';

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

  const cargarEquipos = useCallback(async () => {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarEquipos();
  }, [cargarEquipos]);

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
