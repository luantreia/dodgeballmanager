import { useEffect, useState } from 'react';
import { useAuth } from '../../../../app/providers/AuthContext';
import { useEquipo } from '../../../../app/providers/EquipoContext';
import { getSolicitudesEdicion } from '../services/solicitudesEdicionService';
import type { ISolicitudEdicion } from '../types/solicitudesEdicion';

const INTERVALO_MS = 30000;

/**
 * Cuántas solicitudes de edición pendientes son de ESTE equipo.
 *
 * No sirve `pendientesCount` de `SolicitudesContext`: ese es el total del usuario, sin acotar al
 * equipo seleccionado. Y el filtrado tiene que ser por campos explícitos —nada de
 * `JSON.stringify(datosPropuestos).includes(equipoId)`—: ese match por substring contaba como
 * propia cualquier solicitud que mencionara el id en cualquier campo, por ejemplo el rival de un
 * partido, y el badge mostraba pendientes ajenos.
 *
 * El intervalo se comparte entre todos los que llamen al hook. La barra de escritorio y la de
 * pestañas de mobile están las dos montadas siempre —se ocultan por CSS, no se desmontan—, así
 * que un intervalo por consumidor serían dos consultas cada treinta segundos para pintar el mismo
 * número. Acá hay un solo temporizador vivo mientras haya al menos un suscriptor.
 */
type Escucha = (cantidad: number) => void;

const escuchas = new Set<Escucha>();
let intervalo: number | null = null;
let equipoActivo: string | null = null;
let ultimoValor = 0;

const contar = async (equipoId: string): Promise<number> => {
  try {
    const resp = await getSolicitudesEdicion({ estado: 'pendiente' });
    return (resp.solicitudes || []).filter((s: ISolicitudEdicion) => {
      const dp = (s?.datosPropuestos ?? {}) as Record<string, unknown>;
      return s?.entidad === equipoId || dp.equipoId === equipoId || dp.equipo === equipoId;
    }).length;
  } catch {
    return 0;
  }
};

const refrescar = async (): Promise<void> => {
  const equipoId = equipoActivo;
  if (!equipoId) return;

  const cantidad = await contar(equipoId);
  // Entre que arrancó la consulta y volvió, el usuario pudo cambiar de equipo. Publicar este
  // resultado pintaría el número del equipo anterior.
  if (equipoActivo !== equipoId) return;

  ultimoValor = cantidad;
  escuchas.forEach((escucha) => escucha(cantidad));
};

export const usePendientesDelEquipo = (): number => {
  const { isAuthenticated } = useAuth();
  const { equipoSeleccionado } = useEquipo();
  const equipoId = equipoSeleccionado?.id ?? null;

  const [cantidad, setCantidad] = useState(0);

  useEffect(() => {
    // Sin sesión o sin equipo no hay nada que contar, y consultar igual dispara un 401 cada
    // treinta segundos mientras el usuario mira la pantalla de login.
    if (!isAuthenticated || !equipoId) {
      setCantidad(0);
      return;
    }

    if (equipoActivo !== equipoId) {
      equipoActivo = equipoId;
      ultimoValor = 0;
    }
    setCantidad(ultimoValor);

    escuchas.add(setCantidad);
    void refrescar();
    if (intervalo === null) {
      intervalo = window.setInterval(() => void refrescar(), INTERVALO_MS);
    }

    return () => {
      escuchas.delete(setCantidad);
      if (escuchas.size === 0 && intervalo !== null) {
        window.clearInterval(intervalo);
        intervalo = null;
      }
    };
  }, [isAuthenticated, equipoId]);

  return cantidad;
};

export default usePendientesDelEquipo;
