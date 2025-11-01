import { useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  crearJugadorPartido,
  eliminarJugadorPartido,
  actualizarEstadisticasEquipoPartido,
  extractEquipoId,
  type JugadorPartidoResumen,
  type JugadorSimple,
  type EquipoReferencia,
} from '../services/partidoService';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

type PartidoEquipo = string | { _id?: string; nombre?: string } | null | undefined;

type PartidoAsignacion = {
  _id: string;
  equipoLocal?: PartidoEquipo;
  equipoVisitante?: PartidoEquipo;
};

type JugadorAsignado = JugadorPartidoResumen & {
  jugador: JugadorSimple | string;
};

type UseAsignacionJugadoresReturn = {
  toggleJugadorLocal: (jugadorId: string) => void;
  toggleJugadorVisitante: (jugadorId: string) => void;
  asignarJugadores: () => Promise<void>;
  hayJugadoresAsignados: boolean;
};

const resolveEquipoId = (equipo: EquipoReferencia | undefined): string | undefined => {
  if (!equipo) return undefined;
  return typeof equipo === 'string' ? equipo : equipo._id;
};

const resolveJugadorId = (jugador: JugadorSimple | string): string | undefined => {
  if (typeof jugador === 'string') return jugador;
  return jugador?._id;
};

/**
 * Hook personalizado para manejar la lógica de asignación de jugadores
 */
export const useAsignacionJugadores = (
  mostrarAsignacion: boolean,
  jugadores: JugadorAsignado[],
  partido: PartidoAsignacion | null,
  jugadoresSeleccionadosLocal: Set<string>,
  jugadoresSeleccionadosVisitante: Set<string>,
  setJugadoresSeleccionadosLocal: Dispatch<SetStateAction<Set<string>>>,
  setJugadoresSeleccionadosVisitante: Dispatch<SetStateAction<Set<string>>>,
  setAsignandoJugadores: Dispatch<SetStateAction<boolean>>,
  onCargarDatos: () => Promise<void> | void,
): UseAsignacionJugadoresReturn => {
  const { addToast } = useToast();

  // Efecto para inicializar la selección de jugadores cuando se muestra la asignación
  useEffect(() => {
    if (mostrarAsignacion) {
      const nuevosSeleccionadosLocal = new Set<string>();
      const nuevosSeleccionadosVisitante = new Set<string>();

      jugadores.forEach(jugador => {
        const jugadorId = resolveJugadorId(jugador.jugador);
        if (!jugadorId) return;

        const equipoId = resolveEquipoId(jugador.equipo);
        const equipoLocalId = extractEquipoId(partido?.equipoLocal as EquipoReferencia);
        const equipoVisitanteId = extractEquipoId(partido?.equipoVisitante as EquipoReferencia);

        if (equipoId && equipoLocalId && equipoId === equipoLocalId) {
          nuevosSeleccionadosLocal.add(jugadorId);
        }

        if (equipoId && equipoVisitanteId && equipoId === equipoVisitanteId) {
          nuevosSeleccionadosVisitante.add(jugadorId);
        }
      });

      setJugadoresSeleccionadosLocal(nuevosSeleccionadosLocal);
      setJugadoresSeleccionadosVisitante(nuevosSeleccionadosVisitante);
    }
  }, [mostrarAsignacion, jugadores, partido, setJugadoresSeleccionadosLocal, setJugadoresSeleccionadosVisitante]);

  // Función para alternar la selección de un jugador del equipo local
  const toggleJugadorLocal = (jugadorId: string) => {
    setJugadoresSeleccionadosLocal(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(jugadorId)) {
        nuevo.delete(jugadorId);
      } else {
        nuevo.add(jugadorId);
      }
      return nuevo;
    });
  };

  // Función para alternar la selección de un jugador del equipo visitante
  const toggleJugadorVisitante = (jugadorId: string) => {
    setJugadoresSeleccionadosVisitante(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(jugadorId)) {
        nuevo.delete(jugadorId);
      } else {
        nuevo.add(jugadorId);
      }
      return nuevo;
    });
  };

  // Función para asignar los jugadores seleccionados al partido
  const asignarJugadores = async (): Promise<void> => {
    if (!partido) {
      setAsignandoJugadores(false);
      return;
    }

    setAsignandoJugadores(true);
    try {
      const promises: Array<Promise<unknown>> = [];

      const equipoLocalId = extractEquipoId(partido.equipoLocal as EquipoReferencia);
      const equipoVisitanteId = extractEquipoId(partido.equipoVisitante as EquipoReferencia);

      const jugadoresActualesLocal = new Set(
        jugadores
          .filter(j => {
            const equipoId = resolveEquipoId(j.equipo);
            return equipoLocalId && equipoId === equipoLocalId;
          })
          .map(j => resolveJugadorId(j.jugador))
          .filter(Boolean) as string[],
      );

      const jugadoresActualesVisitante = new Set(
        jugadores
          .filter(j => {
            const equipoId = resolveEquipoId(j.equipo);
            return equipoVisitanteId && equipoId === equipoVisitanteId;
          })
          .map(j => resolveJugadorId(j.jugador))
          .filter(Boolean) as string[],
      );

      // Agregar jugadores nuevos al equipo local
      for (const jugadorId of jugadoresSeleccionadosLocal) {
        if (equipoLocalId && !jugadoresActualesLocal.has(jugadorId)) {
          promises.push(
            crearJugadorPartido({
              partido: partido._id,
              jugador: jugadorId,
              equipo: equipoLocalId,
              creadoPor: 'usuario'
            })
          );
        }
      }

      // Agregar jugadores nuevos al equipo visitante
      for (const jugadorId of jugadoresSeleccionadosVisitante) {
        if (equipoVisitanteId && !jugadoresActualesVisitante.has(jugadorId)) {
          promises.push(
            crearJugadorPartido({
              partido: partido._id,
              jugador: jugadorId,
              equipo: equipoVisitanteId,
              creadoPor: 'usuario'
            })
          );
        }
      }

      // Remover jugadores que ya no están seleccionados
      for (const jugador of jugadores) {
        const jugadorId = resolveJugadorId(jugador.jugador);
        if (!jugadorId) continue;

        const equipoId = resolveEquipoId(jugador.equipo);
        const esLocal = equipoLocalId && equipoId === equipoLocalId;
        const esVisitante = equipoVisitanteId && equipoId === equipoVisitanteId;

        if (esLocal && !jugadoresSeleccionadosLocal.has(jugadorId)) {
          promises.push(eliminarJugadorPartido(jugador._id));
        }

        if (esVisitante && !jugadoresSeleccionadosVisitante.has(jugadorId)) {
          promises.push(eliminarJugadorPartido(jugador._id));
        }
      }

      await Promise.all(promises);

      await Promise.all([
        equipoLocalId ? actualizarEstadisticasEquipoPartido(partido._id, equipoLocalId) : Promise.resolve(),
        equipoVisitanteId ? actualizarEstadisticasEquipoPartido(partido._id, equipoVisitanteId) : Promise.resolve(),
      ]);
      addToast({ type: 'success', title: 'Asignación actualizada', message: 'Se actualizó la asignación de jugadores' });

      // Recargar datos después de la asignación
      await onCargarDatos();

    } catch (error) {
      console.error('Error asignando jugadores:', error);
      const message = error instanceof Error ? error.message : String(error);
      addToast({ type: 'error', title: 'Error al actualizar asignación', message });
    } finally {
      setAsignandoJugadores(false);
    }
  };

  const hayJugadoresAsignados = jugadores.length > 0;

  return {
    toggleJugadorLocal,
    toggleJugadorVisitante,
    asignarJugadores,
    hayJugadoresAsignados
  };
};
