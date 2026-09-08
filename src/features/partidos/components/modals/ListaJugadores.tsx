import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import JugadorEstadisticasCard, { type EstadoGuardadoFila } from '../common/JugadorEstadisticasCard';
import TablaJugadoresEstadisticas from '../common/TablaJugadoresEstadisticas';
import { getJugadoresEquipo } from '../../../jugadores/services/jugadorEquipoService';
import { JUGADORES_POR_SET } from '../../constants/capturaSet';

type CampoNumerico = 'throws' | 'hits' | 'outs' | 'catches';

export type EstadisticaJugadorEntrada = {
  jugadorId?: string;
  estadisticas?: {
    throws?: number;
    hits?: number;
    outs?: number;
    catches?: number;
    survive?: boolean;
  };
};

export type ListaJugadoresProps = {
  equipoNombre: string;
  equipoId: string;
  estadisticasJugador?: EstadisticaJugadorEntrada[];
  onAsignarJugador: (index: number, jugadorId: string) => void;
  onCambiarEstadistica: (index: number, campo: CampoNumerico, delta: number) => void;
  onCambiarSurvive?: (index: number, value: boolean) => void;
  token: string;
  opcionesJugadores?: Array<{ value: string; label: string }>;
  /** Estado de autoguardado por slot, en el mismo orden que `estadisticasJugador`. */
  estadosGuardado?: Array<EstadoGuardadoFila | undefined>;
  /** Pide intercambiar los números de este slot con otro — sólo tiene sentido si ya tiene jugador. */
  onSolicitarIntercambio?: (index: number) => void;
};

export const ListaJugadores: FC<ListaJugadoresProps> = ({
  equipoNombre,
  equipoId,
  estadisticasJugador = [],
  onAsignarJugador,
  onCambiarEstadistica,
  onCambiarSurvive,
  token,
  opcionesJugadores,
  estadosGuardado,
  onSolicitarIntercambio,
}) => {
  type JugadorRelacion = {
    id: string;
    nombre: string;
  };

  const [relaciones, setRelaciones] = useState<JugadorRelacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const cargarJugadores = async () => {
      try {
        setLoading(true);
        if (opcionesJugadores && opcionesJugadores.length > 0) {
          if (!isMounted) return;
          setRelaciones([]);
          return;
        }
        const jugadores = await getJugadoresEquipo({ equipoId });
        if (!isMounted) return;
        setRelaciones(
          jugadores.map((jugador) => ({
            id: jugador.id,
            nombre: jugador.nombre,
          })),
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('Error cargando jugadores del equipo:', error);
        setRelaciones([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void cargarJugadores();

    return () => {
      isMounted = false;
    };
  }, [equipoId, token, opcionesJugadores]);

  const opcionesSelect = useMemo(() => {
    if (opcionesJugadores && opcionesJugadores.length > 0) {
      return opcionesJugadores.filter((opt) => Boolean(opt.value));
    }
    return relaciones
      .map((rel) => ({ value: rel.id, label: rel.nombre ?? 'Sin nombre' }))
      .filter((opt) => Boolean(opt.value));
  }, [opcionesJugadores, relaciones]);

  const obtenerJugadoresSeleccionados = (excluirIndex: number) =>
    estadisticasJugador
      .filter((_, index) => index !== excluirIndex)
      .map((j) => j?.jugadorId)
      .filter((value): value is string => Boolean(value));

  // La grilla es de JUGADORES_POR_SET slots fijos. Ojo: recortar acá NO alcanza —
  // quien pase más entradas de las que entran va a ver una cosa y guardar otra. El
  // llamador tiene que mandar exactamente los slots que quiere capturar.
  const estadisticasCompletas: Array<EstadisticaJugadorEntrada | null> = [
    ...estadisticasJugador,
    ...Array.from(
      { length: Math.max(0, JUGADORES_POR_SET - estadisticasJugador.length) },
      () => null,
    ),
  ].slice(0, JUGADORES_POR_SET);

  // Se computa una sola vez y se usa tanto para las tarjetas (mobile) como para la tabla
  // (`sm:` para arriba) — las dos vistas muestran exactamente los mismos slots, sólo cambia el
  // layout, así que no tiene sentido filtrar las opciones de cada select dos veces.
  const filas = useMemo(
    () =>
      estadisticasCompletas.map((jugadorObj, idx) => {
        const jugadorId = jugadorObj?.jugadorId ?? '';
        const jugadoresSeleccionados = obtenerJugadoresSeleccionados(idx);
        return {
          index: idx,
          jugadorId,
          estadisticas: jugadorObj?.estadisticas ?? {},
          opcionesJugadores: opcionesSelect.filter(
            (op) => !jugadoresSeleccionados.includes(op.value) || op.value === jugadorId,
          ),
          estadoGuardado: estadosGuardado?.[idx],
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estadisticasCompletas, opcionesSelect, estadosGuardado],
  );

  if (loading) {
    return (
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-slate-800">{equipoNombre}</h3>
        <p className="text-slate-500">Cargando jugadores...</p>
      </div>
    );
  }

  return (
    <div className="p-1">
      <h3 className="mb-1 text-lg font-semibold text-slate-800">{equipoNombre}</h3>

      {/* Tarjetas en vertical/angosto, tabla de ahí para arriba — ver el comentario de
          `TablaJugadoresEstadisticas` sobre por qué la tabla aprovecha mejor el ancho de
          horizontal/desktop en vez de seguir apilando contadores como si no sobrara lugar. */}
      <div className="grid grid-cols-2 gap-1.5 xs:grid-cols-3 sm:hidden">
        {filas.map((fila) => (
          <JugadorEstadisticasCard
            key={`jugador-estadisticas-${fila.index}`}
            index={fila.index}
            jugadorId={fila.jugadorId}
            opcionesJugadores={fila.opcionesJugadores}
            onCambiarJugador={(nuevoId: string) => onAsignarJugador(fila.index, nuevoId)}
            onCambiarEstadistica={(campo: CampoNumerico, delta: number) =>
              onCambiarEstadistica(fila.index, campo, delta)
            }
            estadisticasJugador={fila.estadisticas}
            onCambiarSurvive={(value) => onCambiarSurvive?.(fila.index, value)}
            estadoGuardado={fila.estadoGuardado}
            onIntercambiar={onSolicitarIntercambio ? () => onSolicitarIntercambio(fila.index) : undefined}
          />
        ))}
      </div>

      <div className="hidden sm:block">
        <TablaJugadoresEstadisticas
          filas={filas}
          onAsignarJugador={onAsignarJugador}
          onCambiarEstadistica={onCambiarEstadistica}
          onCambiarSurvive={onCambiarSurvive}
          onSolicitarIntercambio={onSolicitarIntercambio}
        />
      </div>
    </div>
  );
};
