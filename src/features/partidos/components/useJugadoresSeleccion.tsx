import type { JugadorBackend } from './useEstadisticasModal';

type JugadoresSeleccionArgs = {
  jugadores: JugadorBackend[];
  seleccionesLocal: string[];
  seleccionesVisitante: string[];
};

type CambiarSeleccionPayload = {
  equipo: 'local' | 'visitante';
  posicion: number;
  jugadorPartidoId: string;
};

/**
 * Hook personalizado para manejar la lógica de selección de jugadores
 */
export const useJugadoresSeleccion = (
  jugadores: JugadoresSeleccionArgs['jugadores'] = [],
  seleccionesLocal: JugadoresSeleccionArgs['seleccionesLocal'] = [],
  seleccionesVisitante: JugadoresSeleccionArgs['seleccionesVisitante'] = [],
) => {

  // Función para obtener jugadores ya seleccionados
  const getJugadoresYaSeleccionados = (): Set<string> => {
    const seleccionados = new Set<string>();

    // Agregar todos los seleccionados del equipo local
    seleccionesLocal.forEach(jugadorPartidoId => {
      if (jugadorPartidoId) {
        seleccionados.add(jugadorPartidoId);
      }
    });

    // Agregar todos los seleccionados del equipo visitante
    seleccionesVisitante.forEach(jugadorPartidoId => {
      if (jugadorPartidoId) {
        seleccionados.add(jugadorPartidoId);
      }
    });

    return seleccionados;
  };

  // Función para obtener jugadores disponibles por equipo
  const getJugadoresPorEquipo = (equipoId?: string) => {
    if (!equipoId || !jugadores.length) return [];

    const jugadoresYaSeleccionados = getJugadoresYaSeleccionados();

    const filtrados = jugadores.filter(jugador => {
      const equipo = jugador?.equipo;
      let jugadorEquipoId: string | undefined;
      if (typeof equipo === 'string') {
        jugadorEquipoId = equipo;
      } else if (equipo) {
        jugadorEquipoId = equipo._id;
      }
      // Solo incluir jugadores del equipo correcto
      if (jugadorEquipoId !== equipoId) return false;

      // Excluir jugadores que ya están seleccionados en otras posiciones
      const jugadorPartidoId = jugador?._id;
      return !jugadoresYaSeleccionados.has(jugadorPartidoId);
    });

    return filtrados;
  };

  // Función para cambiar la selección de un jugador
  const cambiarSeleccionJugador = (equipo: 'local' | 'visitante', posicion: number, jugadorPartidoId: string): CambiarSeleccionPayload => {
    // Esta función será manejada en el componente padre
    // Devuelve los parámetros para que el componente padre actualice el estado
    return { equipo, posicion, jugadorPartidoId };
  };

  // Función para obtener el nombre formateado de un jugador
  const getNombreJugador = (jugador: JugadorBackend['jugador'] | null | undefined): string => {
    if (!jugador) return 'Jugador desconocido';
    let nombre = '';
    if (typeof jugador === 'string') {
      const partes = jugador.trim().split(' ');
      if (partes.length > 1) {
        nombre = `${partes[0].charAt(0)}. ${partes[partes.length - 1]}`;
      } else {
        nombre = jugador;
      }
    } else if (jugador.nombre && jugador.apellido) {
      nombre = `${jugador.nombre} ${jugador.apellido}`;
    } else if (jugador.nombre) {
      const partes = jugador.nombre.trim().split(' ');
      if (partes.length > 1) {
        nombre = `${partes[0].charAt(0)}. ${partes[partes.length - 1]}`;
      } else {
        nombre = jugador.nombre;
      }
    } else if ('name' in jugador && jugador.name) {
      nombre = jugador.name;
    } else if ('fullName' in jugador && jugador.fullName) {
      nombre = jugador.fullName;
    } else {
      nombre = 'Sin nombre';
    }
    return nombre || 'Jugador';
  };

  return {
    getJugadoresYaSeleccionados,
    getJugadoresPorEquipo,
    cambiarSeleccionJugador,
    getNombreJugador
  };
};
