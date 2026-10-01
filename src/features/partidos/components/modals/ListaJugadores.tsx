import { useMemo } from 'react';
import type { FC } from 'react';
import JugadorEstadisticasCard, { type EstadoGuardadoFila } from '../common/JugadorEstadisticasCard';
import TablaJugadoresEstadisticas from '../common/TablaJugadoresEstadisticas';

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
  estadisticasJugador?: EstadisticaJugadorEntrada[];
  /** Opcional: con `asignable` en false la fila tiene su jugador fijo y nunca se llama. */
  onAsignarJugador?: (index: number, jugadorId: string) => void;
  onCambiarEstadistica: (index: number, campo: CampoNumerico, delta: number) => void;
  onCambiarSurvive?: (index: number, value: boolean) => void;
  /**
   * Quiénes se pueden elegir en cada fila. Es responsabilidad del llamador, a propósito: según
   * la captura el universo es distinto (los presentes de una planilla, la convocatoria oficial
   * de un partido) y esta lista no tiene forma de saber cuál corresponde.
   */
  opcionesJugadores: Array<{ value: string; label: string }>;
  /**
   * Cuántas filas dibujar. Con un número, la grilla tiene ese largo fijo y se rellena con filas
   * vacías — es el caso de la captura set a set, donde el tope son los jugadores en cancha y es
   * una regla del juego, no una limitación. Sin valor, se dibuja exactamente una fila por entrada
   * recibida: el caso de los totales de un partido, donde el eje no es quién está en cancha sino
   * quién jugó, y eso puede ser cualquier número de jugadores.
   *
   * Lo que esta lista NO hace más es recortar: antes tenía su propio `.slice()` además del que
   * aplicaba el llamador, y una entrada de más no se dibujaba pero igual existía en el estado de
   * arriba — se veía una cosa y se guardaba otra.
   */
  capacidad?: number;
  /** Estado de autoguardado por fila, en el mismo orden que `estadisticasJugador`. */
  estadosGuardado?: Array<EstadoGuardadoFila | undefined>;
  /** Pide intercambiar los números de esta fila con otra — sólo tiene sentido si ya tiene jugador. */
  onSolicitarIntercambio?: (index: number) => void;
  /**
   * `false` cuando cada fila tiene su jugador fijo y no hay nada que elegir: es el caso de la
   * captura de totales del partido, que va contra la convocatoria ya armada. El nombre pasa a ser
   * un rótulo en vez de un desplegable.
   */
  asignable?: boolean;
  /** `false` donde "sobrevive" no aplica — es un dato por set, no de todo el partido. */
  mostrarSurvive?: boolean;
};

export const ListaJugadores: FC<ListaJugadoresProps> = ({
  equipoNombre,
  estadisticasJugador = [],
  onAsignarJugador,
  onCambiarEstadistica,
  onCambiarSurvive,
  opcionesJugadores,
  capacidad,
  estadosGuardado,
  onSolicitarIntercambio,
  asignable = true,
  mostrarSurvive = true,
}) => {
  const entradas: Array<EstadisticaJugadorEntrada | null> = useMemo(() => {
    if (capacidad === undefined) return estadisticasJugador;
    const faltantes = Math.max(0, capacidad - estadisticasJugador.length);
    return [...estadisticasJugador, ...Array.from({ length: faltantes }, () => null)];
  }, [estadisticasJugador, capacidad]);

  // Se computa una sola vez y se usa tanto para las tarjetas (mobile) como para la tabla
  // (`sm:` para arriba) — las dos vistas muestran exactamente las mismas filas, sólo cambia el
  // layout, así que no tiene sentido filtrar las opciones de cada select dos veces.
  const filas = useMemo(() => {
    const yaElegidos = entradas
      .map((entrada) => entrada?.jugadorId)
      .filter((value): value is string => Boolean(value));

    return entradas.map((jugadorObj, idx) => {
      const jugadorId = jugadorObj?.jugadorId ?? '';
      return {
        index: idx,
        jugadorId,
        nombreJugador: opcionesJugadores.find((op) => op.value === jugadorId)?.label,
        estadisticas: jugadorObj?.estadisticas ?? {},
        // Un jugador ya elegido en otra fila no se vuelve a ofrecer, salvo en la fila que lo tiene.
        opcionesJugadores: opcionesJugadores.filter(
          (op) => op.value === jugadorId || !yaElegidos.includes(op.value),
        ),
        estadoGuardado: estadosGuardado?.[idx],
      };
    });
  }, [entradas, opcionesJugadores, estadosGuardado]);

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
            onCambiarJugador={(nuevoId: string) => onAsignarJugador?.(fila.index, nuevoId)}
            onCambiarEstadistica={(campo: CampoNumerico, delta: number) =>
              onCambiarEstadistica(fila.index, campo, delta)
            }
            estadisticasJugador={fila.estadisticas}
            onCambiarSurvive={(value) => onCambiarSurvive?.(fila.index, value)}
            estadoGuardado={fila.estadoGuardado}
            onIntercambiar={onSolicitarIntercambio ? () => onSolicitarIntercambio(fila.index) : undefined}
            asignable={asignable}
            nombreJugador={fila.nombreJugador}
            mostrarSurvive={mostrarSurvive}
          />
        ))}
      </div>

      <div className="hidden sm:block">
        <TablaJugadoresEstadisticas
          filas={filas}
          onAsignarJugador={(index, jugadorId) => onAsignarJugador?.(index, jugadorId)}
          onCambiarEstadistica={onCambiarEstadistica}
          onCambiarSurvive={onCambiarSurvive}
          onSolicitarIntercambio={onSolicitarIntercambio}
          asignable={asignable}
          mostrarSurvive={mostrarSurvive}
        />
      </div>
    </div>
  );
};
