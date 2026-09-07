import type { FilaAnalitica } from '../services/filasService';

export type ResultadoSet = FilaAnalitica['resultadoSet'];

export type JugadorEnSet = {
  jugadorId: string;
  jugador: string;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survive: boolean;
};

/**
 * Un set visto desde el equipo que consulta: quiénes estuvieron en cancha, qué hizo cada uno y
 * cómo terminó.
 */
export type SetAnalitico = {
  /** `${partidoId}#${numeroSet}` — identidad del set dentro del dataset. */
  clave: string;
  partidoId: string;
  numeroSet: number;
  resultado: ResultadoSet;
  /** La alineación: exactamente los jugadores que tienen fila en este set. */
  jugadores: JugadorEnSet[];
  totales: {
    throws: number;
    hits: number;
    outs: number;
    catches: number;
    /** Cuántos de los que jugaron el set sobrevivieron. */
    survives: number;
  };
};

/**
 * Las filas analíticas, reagrupadas por set.
 *
 * Es el único lugar donde se decide qué es "un set", y de él cuelgan tanto el análisis de
 * sinergias entre jugadores como el de condiciones del set. Que las dos preguntas compartan esta
 * función es lo que garantiza que "sets ganados" signifique lo mismo en las dos.
 *
 * La alineación es, literalmente, quién tiene fila en ese set. Si la captura quedó incompleta —
 * cuatro jugadores cargados de seis— el set aporta igual, con esos cuatro: nunca inventa una
 * co-presencia que no está en el dato, sólo subcuenta la que no se cargó.
 *
 * Se descartan las filas sin `numeroSet`, que son de dos clases y ninguna sirve acá: la captura
 * directa (totales del partido entero, sin desglose por set) y los partidos sin ninguna fuente
 * cargada, que existen en el dataset sólo para el conteo de victorias.
 */
export const construirSets = (filas: FilaAnalitica[]): SetAnalitico[] => {
  const mapa = new Map<string, SetAnalitico>();
  // Un mismo jugador no debería aparecer dos veces en un set —hay índice único en las dos
  // colecciones de origen—, pero si pasara duplicaría su presencia en cada combinación y en cada
  // total. Se fusiona por jugador dentro del set en vez de confiar en el índice.
  const porJugador = new Map<string, Map<string, JugadorEnSet>>();

  for (const fila of filas) {
    if (fila.numeroSet === null || !fila.jugadorId) continue;

    const clave = `${fila.partidoId}#${fila.numeroSet}`;

    let set = mapa.get(clave);
    if (!set) {
      set = {
        clave,
        partidoId: fila.partidoId,
        numeroSet: fila.numeroSet,
        resultado: fila.resultadoSet,
        jugadores: [],
        totales: { throws: 0, hits: 0, outs: 0, catches: 0, survives: 0 },
      };
      mapa.set(clave, set);
      porJugador.set(clave, new Map());
    }

    const jugadores = porJugador.get(clave)!;
    const existente = jugadores.get(fila.jugadorId);

    if (existente) {
      existente.throws += fila.throws;
      existente.hits += fila.hits;
      existente.outs += fila.outs;
      existente.catches += fila.catches;
      existente.survive = existente.survive || fila.survive;
    } else {
      const jugador: JugadorEnSet = {
        jugadorId: fila.jugadorId,
        jugador: fila.jugador ?? 'Jugador',
        throws: fila.throws,
        hits: fila.hits,
        outs: fila.outs,
        catches: fila.catches,
        survive: fila.survive,
      };
      jugadores.set(fila.jugadorId, jugador);
      set.jugadores.push(jugador);
    }
  }

  // Los totales se calculan al final porque la fusión de duplicados puede haber cambiado los
  // números de un jugador después de haberlo agregado.
  for (const set of mapa.values()) {
    const totales = set.totales;
    for (const jugador of set.jugadores) {
      totales.throws += jugador.throws;
      totales.hits += jugador.hits;
      totales.outs += jugador.outs;
      totales.catches += jugador.catches;
      if (jugador.survive) totales.survives += 1;
    }
  }

  return [...mapa.values()];
};

/**
 * Si el set entra o no al denominador de un porcentaje de victorias.
 *
 * Un empate y un set sin definir se jugaron —cuentan como "sets juntos", como volumen de tiros,
 * como todo lo demás— pero no son ni una victoria ni una derrota. Meterlos en el denominador
 * hundiría el porcentaje de un torneo en curso.
 */
export const esDecidido = (set: SetAnalitico): boolean =>
  set.resultado === 'ganado' || set.resultado === 'perdido';

export type ResumenSets = {
  sets: number;
  decididos: number;
  ganados: number;
  /** Sobre los decididos. `null` si no hay ninguno cerrado. */
  porcentaje: number | null;
};

/** El resumen de un conjunto de sets. Es la línea de base contra la que se lee todo lo demás. */
export const resumirSets = (sets: SetAnalitico[]): ResumenSets => {
  let decididos = 0;
  let ganados = 0;

  for (const set of sets) {
    if (!esDecidido(set)) continue;
    decididos += 1;
    if (set.resultado === 'ganado') ganados += 1;
  }

  return {
    sets: sets.length,
    decididos,
    ganados,
    porcentaje: decididos > 0 ? ganados / decididos : null,
  };
};
