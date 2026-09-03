import { useCallback } from 'react';
import type { FC } from 'react';
import { ListaJugadores } from './ListaJugadores';

type EquipoResumen = {
  _id: string;
  nombre: string;
};

type ListaJugadorEstadistica = {
  jugadorId?: string;
  estadisticas?: {
    throws?: number;
    hits?: number;
    outs?: number;
    catches?: number;
    survive?: boolean;
  } | undefined;
};

type EstadisticasEquipo = {
  local: ListaJugadorEstadistica[];
  visitante: ListaJugadorEstadistica[];
};

type EstadisticaKey = 'throws' | 'hits' | 'outs' | 'catches';

type CambiarEstadisticaHandler = (
  equipoId: string,
  index: number,
  campo: EstadisticaKey,
  delta: number,
) => void;

type CambiarSurviveHandler = (equipoId: string, index: number, value: boolean) => void;

type AsignarJugadorHandler = (
  equipo: 'local' | 'visitante',
  index: number,
  jugadorId: string,
) => void;

type EquiposEstadisticasProps = {
  equipoLocal: EquipoResumen;
  equipoVisitante: EquipoResumen;
  estadisticas: EstadisticasEquipo;
  onCambiarEstadistica: CambiarEstadisticaHandler;
  onCambiarSurvive: CambiarSurviveHandler;
  onAsignarJugador: AsignarJugadorHandler;
  token: string;
  opcionesJugadoresLocal?: Array<{ value: string; label: string }>;
  opcionesJugadoresVisitante?: Array<{ value: string; label: string }>;
  /**
   * `stats.capture` es un permiso por equipo. Mostrar la grilla de un equipo que el usuario no
   * puede escribir era una trampa: se cargaban los números del rival, el guardado grababa los
   * propios y moría con 403 en los ajenos, y el DT se quedaba con un error genérico sin saber
   * qué había quedado guardado. Si no podés escribir un lado, ese lado no se muestra.
   */
  puedeEditarLocal?: boolean;
  puedeEditarVisitante?: boolean;
};

const EquiposEstadisticas: FC<EquiposEstadisticasProps> = ({
  equipoLocal,
  equipoVisitante,
  estadisticas,
  onCambiarEstadistica,
  onCambiarSurvive,
  onAsignarJugador,
  token,
  opcionesJugadoresLocal,
  opcionesJugadoresVisitante,
  puedeEditarLocal = true,
  puedeEditarVisitante = true,
}) => {
  const handleCambiarEstadisticaLocal = useCallback<CambiarEstadisticaHandler>(
    (equipoId, index, campo, delta) => {
      onCambiarEstadistica(equipoId, index, campo, delta);
    },
    [onCambiarEstadistica],
  );

  const handleAsignarJugador = useCallback<AsignarJugadorHandler>(
    (equipo, index, jugadorId) => {
      onAsignarJugador(equipo, index, jugadorId);
    },
    [onAsignarJugador],
  );

  return (
    // En mobile los equipos van uno debajo del otro. Lado a lado, cada plantel quedaba con
    // media pantalla —unos 180px para seis jugadores con cuatro contadores cada uno— y era
    // imposible acertarle a un botón con el pulgar.
    <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-2">
      {puedeEditarLocal ? (
        <ListaJugadores
          equipoNombre={equipoLocal.nombre}
          equipoId={equipoLocal._id}
          estadisticasJugador={estadisticas.local}
          onCambiarEstadistica={(index, campo, delta) =>
            handleCambiarEstadisticaLocal(equipoLocal._id, index, campo, delta)
          }
          onAsignarJugador={(index, jugadorId) => handleAsignarJugador('local', index, jugadorId)}
          onCambiarSurvive={(index, value) => onCambiarSurvive(equipoLocal._id, index, value)}
          token={token}
          opcionesJugadores={opcionesJugadoresLocal}
        />
      ) : null}
      {puedeEditarVisitante ? (
        <ListaJugadores
          equipoNombre={equipoVisitante.nombre}
          equipoId={equipoVisitante._id}
          estadisticasJugador={estadisticas.visitante}
          onCambiarEstadistica={(index, campo, delta) =>
            handleCambiarEstadisticaLocal(equipoVisitante._id, index, campo, delta)
          }
          onAsignarJugador={(index, jugadorId) => handleAsignarJugador('visitante', index, jugadorId)}
          onCambiarSurvive={(index, value) => onCambiarSurvive(equipoVisitante._id, index, value)}
          token={token}
          opcionesJugadores={opcionesJugadoresVisitante}
        />
      ) : null}
      {!puedeEditarLocal && !puedeEditarVisitante ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No tenés permiso para capturar estadísticas de ninguno de los dos equipos de este
          partido.
        </p>
      ) : null}
    </div>
  );
};

export default EquiposEstadisticas;