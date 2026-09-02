/**
 * Jugadores en cancha por equipo en un set de dodgeball.
 *
 * Es el tamaño de la grilla de captura en todos lados: la captura set a set de un
 * partido y la planilla propia del equipo tienen que verse igual. Si algún día el
 * formato cambia, se cambia acá y no en cada modal.
 */
export const JUGADORES_POR_SET = 6;

export type EstadisticasSlot = {
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survive: boolean;
};

export const ESTADISTICAS_SLOT_VACIO: EstadisticasSlot = {
  throws: 0,
  hits: 0,
  outs: 0,
  catches: 0,
  survive: false,
};

/** Un slot de la grilla: puede estar vacío (sin jugador asignado todavía). */
export type SlotCaptura<TId = string> = {
  jugadorId?: TId;
  estadisticas: EstadisticasSlot;
};

/** Devuelve exactamente JUGADORES_POR_SET slots, rellenando con vacíos. */
export function completarSlots<T extends { estadisticas: EstadisticasSlot }>(
  ocupados: T[],
  vacio: () => T,
): T[] {
  const recortados = ocupados.slice(0, JUGADORES_POR_SET);
  const faltantes = Math.max(0, JUGADORES_POR_SET - recortados.length);
  return [...recortados, ...Array.from({ length: faltantes }, vacio)];
}
