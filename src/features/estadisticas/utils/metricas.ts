import type { FilaAnalitica } from '../services/filasService';

export type MetricasEquipo = {
  partidos: number;
  /** Sólo los finalizados: un partido por jugar no es ni ganado ni perdido. */
  jugados: number;
  ganados: number;
  perdidos: number;
  empatados: number;
  /** Sobre los jugados. `null` si todavía no hay ninguno cerrado. */
  porcentajeVictorias: number | null;
  setsGanados: number;
  setsPerdidos: number;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  /** hits / throws. Puede pasar de 1: un tiro puede quemar a más de un rival. */
  efectividad: number | null;
  /** Cuántos de los partidos del segmento tienen alguna estadística cargada. */
  partidosConDatos: number;
};

export type MetricasJugador = {
  jugadorId: string;
  jugador: string;
  sets: number;
  partidos: number;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  efectividad: number | null;
  /** Proporción de sets en los que sobrevivió. */
  supervivencia: number | null;
};

const dividir = (numerador: number, denominador: number): number | null =>
  denominador > 0 ? numerador / denominador : null;

/**
 * Métricas de un conjunto de filas ya filtrado.
 *
 * Es una función pura y sin estado a propósito: la pantalla la llama una vez para lo que está
 * a la vista, y una vez por cada segmento que se está comparando. Si el cálculo viviera dentro
 * de un componente o de un hook con estado, comparar 2025 contra 2026 obligaría a duplicar la
 * lógica y las dos mitades de la comparación podrían dejar de significar lo mismo.
 */
export const calcularMetricasEquipo = (filas: FilaAnalitica[]): MetricasEquipo => {
  // Los conteos por partido se hacen sobre partidos únicos: las filas son por jugador y por
  // set, así que un partido de 6 jugadores por 3 sets aparece 18 veces.
  const partidos = new Map<string, FilaAnalitica>();
  const partidosConDatos = new Set<string>();
  // Un set se cuenta una sola vez por partido, no una vez por jugador que jugó en él.
  const setsVistos = new Map<string, ResultadoSetLocal>();

  let throws = 0;
  let hits = 0;
  let outs = 0;
  let catches = 0;

  for (const fila of filas) {
    if (!partidos.has(fila.partidoId)) partidos.set(fila.partidoId, fila);
    if (fila.jugadorId) partidosConDatos.add(fila.partidoId);

    throws += fila.throws;
    hits += fila.hits;
    outs += fila.outs;
    catches += fila.catches;

    if (fila.numeroSet !== null) {
      setsVistos.set(`${fila.partidoId}#${fila.numeroSet}`, fila.resultadoSet);
    }
  }

  let ganados = 0;
  let perdidos = 0;
  let empatados = 0;
  let jugados = 0;

  for (const fila of partidos.values()) {
    if (fila.resultadoPartido === 'sin definir') continue;
    jugados += 1;
    if (fila.resultadoPartido === 'ganado') ganados += 1;
    else if (fila.resultadoPartido === 'perdido') perdidos += 1;
    else empatados += 1;
  }

  let setsGanados = 0;
  let setsPerdidos = 0;
  for (const resultado of setsVistos.values()) {
    if (resultado === 'ganado') setsGanados += 1;
    else if (resultado === 'perdido') setsPerdidos += 1;
  }

  return {
    partidos: partidos.size,
    jugados,
    ganados,
    perdidos,
    empatados,
    porcentajeVictorias: dividir(ganados, jugados),
    setsGanados,
    setsPerdidos,
    throws,
    hits,
    outs,
    catches,
    efectividad: dividir(hits, throws),
    partidosConDatos: partidosConDatos.size,
  };
};

type ResultadoSetLocal = FilaAnalitica['resultadoSet'];

export const calcularMetricasJugadores = (filas: FilaAnalitica[]): MetricasJugador[] => {
  const acc = new Map<
    string,
    MetricasJugador & { partidosSet: Set<string>; survives: number; setsConSurvive: number }
  >();

  for (const fila of filas) {
    // Las filas de partidos sin datos existen para el conteo de victorias, no tienen jugador.
    if (!fila.jugadorId || !fila.jugador) continue;

    let item = acc.get(fila.jugadorId);
    if (!item) {
      item = {
        jugadorId: fila.jugadorId,
        jugador: fila.jugador,
        sets: 0,
        partidos: 0,
        throws: 0,
        hits: 0,
        outs: 0,
        catches: 0,
        efectividad: null,
        supervivencia: null,
        partidosSet: new Set<string>(),
        survives: 0,
        setsConSurvive: 0,
      };
      acc.set(fila.jugadorId, item);
    }

    item.throws += fila.throws;
    item.hits += fila.hits;
    item.outs += fila.outs;
    item.catches += fila.catches;
    item.partidosSet.add(fila.partidoId);
    if (fila.numeroSet !== null) {
      item.sets += 1;
      item.setsConSurvive += 1;
      if (fila.survive) item.survives += 1;
    }
  }

  return [...acc.values()]
    .map((item) => ({
      jugadorId: item.jugadorId,
      jugador: item.jugador,
      sets: item.sets,
      partidos: item.partidosSet.size,
      throws: item.throws,
      hits: item.hits,
      outs: item.outs,
      catches: item.catches,
      efectividad: dividir(item.hits, item.throws),
      supervivencia: dividir(item.survives, item.setsConSurvive),
    }))
    .sort((a, b) => b.hits - a.hits || a.jugador.localeCompare(b.jugador, 'es'));
};

export const formatearPorcentaje = (valor: number | null, decimales = 0): string =>
  valor === null ? '—' : `${(valor * 100).toFixed(decimales)}%`;
