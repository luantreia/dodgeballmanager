import { useCallback } from 'react';
import type { FC } from 'react';
import { ListaJugadores } from './ListaJugadores';

type EquipoResumen = {
  _id: string;
  nombre: string;
};

type ListaJugadorEstadistica = {
  jugadorId?: string;
  estadisticas?: Record<string, number> | undefined;
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
  onAsignarJugador: AsignarJugadorHandler;
  token: string;
  opcionesJugadoresLocal?: Array<{ value: string; label: string }>;
  opcionesJugadoresVisitante?: Array<{ value: string; label: string }>;
};

const EquiposEstadisticas: FC<EquiposEstadisticasProps> = ({
  equipoLocal,
  equipoVisitante,
  estadisticas,
  onCambiarEstadistica,
  onAsignarJugador,
  token,
  opcionesJugadoresLocal,
  opcionesJugadoresVisitante,
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
    <div className="mt-1 flex flex-row flex-wrap justify-between gap-1">
      <ListaJugadores
        equipoNombre={equipoLocal.nombre}
        equipoId={equipoLocal._id}
        estadisticasJugador={estadisticas.local}
        onCambiarEstadistica={(index, campo, delta) =>
          handleCambiarEstadisticaLocal(equipoLocal._id, index, campo, delta)
        }
        onAsignarJugador={(index, jugadorId) => handleAsignarJugador('local', index, jugadorId)}
        token={token}
        opcionesJugadores={opcionesJugadoresLocal}
      />
      <ListaJugadores
        equipoNombre={equipoVisitante.nombre}
        equipoId={equipoVisitante._id}
        estadisticasJugador={estadisticas.visitante}
        onCambiarEstadistica={(index, campo, delta) =>
          handleCambiarEstadisticaLocal(equipoVisitante._id, index, campo, delta)
        }
        onAsignarJugador={(index, jugadorId) => handleAsignarJugador('visitante', index, jugadorId)}
        token={token}
        opcionesJugadores={opcionesJugadoresVisitante}
      />
    </div>
  );
};

export default EquiposEstadisticas;