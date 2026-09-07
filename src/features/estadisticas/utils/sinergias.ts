import { esDecidido, type SetAnalitico } from './setsAnaliticos';

export const TAMANO_MINIMO = 2;
export const TAMANO_MAXIMO = 6;

/**
 * Tope de jugadores por set para enumerar combinaciones.
 *
 * En cancha hay 6 (ver `JUGADORES_POR_SET`), así que un set sano nunca llega acá. Existe por si
 * un dato sucio mete más: la cantidad de subconjuntos crece como 2^n, y un set con 20 jugadores
 * cargados colgaría el teléfono del DT sin que nada avise. Se recortan los que más jugaron.
 */
const MAX_JUGADORES_POR_SET = 8;

export type GrupoSinergia = {
  /** Ids ordenados y unidos por `|`. Identidad estable del grupo. */
  clave: string;
  jugadorIds: string[];
  nombres: string[];
  tamano: number;

  setsJuntos: number;
  decididosJuntos: number;
  ganadosJuntos: number;
  /** Sobre los sets decididos jugando todos juntos. `null` si ninguno cerró. */
  porcentajeJuntos: number | null;

  setsSeparados: number;
  decididosSeparados: number;
  ganadosSeparados: number;
  porcentajeSeparados: number | null;

  /**
   * `porcentajeJuntos - porcentajeSeparados`, en tanto por uno.
   *
   * `null` cuando no hay con qué comparar: el grupo nunca jugó separado (son "inseparables") o
   * ninguno de los dos lados tiene sets decididos. Un `null` acá no es un cero — es la ausencia
   * de la pregunta, y mostrarlo como 0 sería inventar un dato.
   */
  sinergia: number | null;

  throws: number;
  hits: number;
  outs: number;
  catches: number;
  /** hits / throws. Puede pasar de 1: un tiro puede quemar a más de un rival. */
  efectividad: number | null;
  hitsPorSet: number | null;
  /** Proporción de apariciones en las que un integrante del grupo sobrevivió el set. */
  supervivencia: number | null;
};

type Acumulador = {
  clave: string;
  jugadorIds: string[];
  nombres: string[];
  setsJuntos: number;
  decididosJuntos: number;
  ganadosJuntos: number;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survives: number;
  apariciones: number;
};

/** Los grupos de cada tamaño, ya calculados. La clave del mapa exterior es el tamaño. */
export type Sinergias = Map<number, GrupoSinergia[]>;

const dividir = (numerador: number, denominador: number): number | null =>
  denominador > 0 ? numerador / denominador : null;

/**
 * Sinergia entre jugadores, medida como on/off: cuánto mejor (o peor) le va al equipo con el
 * grupo entero en cancha que cuando esos mismos jugadores están sueltos.
 *
 * - **Juntos**: sets donde estuvieron *todos* los del grupo.
 * - **Separados**: sets donde estuvo *al menos uno* pero *no todos*.
 * - **Sinergia**: la diferencia entre los dos porcentajes de victoria.
 *
 * Por qué on/off y no simplemente el % de victorias del grupo: en un equipo que gana el 70% de
 * los sets, casi todos los grupos rondan el 70% y el ranking no distingue nada — premia jugar en
 * un equipo bueno, no la química. El contraste contra los mismos jugadores separados es lo único
 * que aísla el efecto de estar juntos.
 *
 * Los seis tamaños se calculan en una sola pasada: cambiar de duplas a tríos en la interfaz es
 * elegir una entrada del mapa, no recalcular.
 */
export const calcularSinergias = (sets: SetAnalitico[]): Sinergias => {
  const acumuladores = new Map<string, Acumulador>();
  // Para la pasada de "separados": en qué sets estuvo cada jugador. Sin este índice habría que
  // recorrer todos los sets por cada grupo, y los grupos son decenas de miles.
  const setsPorJugador = new Map<string, Set<string>>();
  const setPorClave = new Map<string, SetAnalitico>();

  for (const set of sets) {
    setPorClave.set(set.clave, set);

    const alineacion =
      set.jugadores.length > MAX_JUGADORES_POR_SET
        ? [...set.jugadores].sort((a, b) => b.throws - a.throws).slice(0, MAX_JUGADORES_POR_SET)
        : set.jugadores;

    for (const jugador of alineacion) {
      let vistos = setsPorJugador.get(jugador.jugadorId);
      if (!vistos) {
        vistos = new Set<string>();
        setsPorJugador.set(jugador.jugadorId, vistos);
      }
      vistos.add(set.clave);
    }

    if (alineacion.length < TAMANO_MINIMO) continue;

    // Orden estable por id para que la clave de un grupo no dependa del orden de captura.
    const ordenados = [...alineacion].sort((a, b) => a.jugadorId.localeCompare(b.jugadorId));
    const decidido = esDecidido(set);
    const ganado = set.resultado === 'ganado';

    const tope = Math.min(TAMANO_MAXIMO, ordenados.length);
    for (let tamano = TAMANO_MINIMO; tamano <= tope; tamano += 1) {
      combinaciones(ordenados, tamano, (grupo) => {
        const clave = grupo.map((j) => j.jugadorId).join('|');

        let acc = acumuladores.get(clave);
        if (!acc) {
          acc = {
            clave,
            jugadorIds: grupo.map((j) => j.jugadorId),
            nombres: grupo.map((j) => j.jugador),
            setsJuntos: 0,
            decididosJuntos: 0,
            ganadosJuntos: 0,
            throws: 0,
            hits: 0,
            outs: 0,
            catches: 0,
            survives: 0,
            apariciones: 0,
          };
          acumuladores.set(clave, acc);
        }

        acc.setsJuntos += 1;
        if (decidido) {
          acc.decididosJuntos += 1;
          if (ganado) acc.ganadosJuntos += 1;
        }

        for (const jugador of grupo) {
          acc.throws += jugador.throws;
          acc.hits += jugador.hits;
          acc.outs += jugador.outs;
          acc.catches += jugador.catches;
          acc.apariciones += 1;
          if (jugador.survive) acc.survives += 1;
        }
      });
    }
  }

  const porTamano: Sinergias = new Map();

  for (const acc of acumuladores.values()) {
    const separados = contarSeparados(acc.jugadorIds, setsPorJugador, setPorClave);

    const porcentajeJuntos = dividir(acc.ganadosJuntos, acc.decididosJuntos);
    const porcentajeSeparados = dividir(separados.ganados, separados.decididos);

    const grupo: GrupoSinergia = {
      clave: acc.clave,
      jugadorIds: acc.jugadorIds,
      nombres: acc.nombres,
      tamano: acc.jugadorIds.length,

      setsJuntos: acc.setsJuntos,
      decididosJuntos: acc.decididosJuntos,
      ganadosJuntos: acc.ganadosJuntos,
      porcentajeJuntos,

      setsSeparados: separados.sets,
      decididosSeparados: separados.decididos,
      ganadosSeparados: separados.ganados,
      porcentajeSeparados,

      sinergia:
        porcentajeJuntos !== null && porcentajeSeparados !== null
          ? porcentajeJuntos - porcentajeSeparados
          : null,

      throws: acc.throws,
      hits: acc.hits,
      outs: acc.outs,
      catches: acc.catches,
      efectividad: dividir(acc.hits, acc.throws),
      hitsPorSet: dividir(acc.hits, acc.setsJuntos),
      supervivencia: dividir(acc.survives, acc.apariciones),
    };

    const lista = porTamano.get(grupo.tamano);
    if (lista) lista.push(grupo);
    else porTamano.set(grupo.tamano, [grupo]);
  }

  return porTamano;
};

/**
 * Los sets donde estuvo al menos uno del grupo pero no todos.
 *
 * Se parte de la unión de los sets de sus integrantes —no de todos los sets del segmento— porque
 * un set donde no jugó ninguno no dice nada sobre este grupo.
 */
const contarSeparados = (
  jugadorIds: string[],
  setsPorJugador: Map<string, Set<string>>,
  setPorClave: Map<string, SetAnalitico>,
): { sets: number; decididos: number; ganados: number } => {
  const union = new Set<string>();
  for (const id of jugadorIds) {
    const vistos = setsPorJugador.get(id);
    if (vistos) for (const clave of vistos) union.add(clave);
  }

  let sets = 0;
  let decididos = 0;
  let ganados = 0;

  for (const clave of union) {
    const completo = jugadorIds.every((id) => setsPorJugador.get(id)?.has(clave));
    if (completo) continue;

    const set = setPorClave.get(clave);
    if (!set) continue;

    sets += 1;
    if (esDecidido(set)) {
      decididos += 1;
      if (set.resultado === 'ganado') ganados += 1;
    }
  }

  return { sets, decididos, ganados };
};

/** Enumera los subconjuntos de tamaño `tamano`, sin materializar la lista completa. */
function combinaciones<T>(items: T[], tamano: number, visitar: (grupo: T[]) => void): void {
  const actual: T[] = [];

  const recorrer = (desde: number): void => {
    if (actual.length === tamano) {
      visitar(actual);
      return;
    }
    // Podado: si lo que queda no alcanza para completar el grupo, no hay nada que explorar.
    const faltan = tamano - actual.length;
    for (let i = desde; i <= items.length - faltan; i += 1) {
      actual.push(items[i]);
      recorrer(i + 1);
      actual.pop();
    }
  };

  recorrer(0);
}

export type OrdenSinergia = 'sinergia' | 'porcentaje' | 'sets' | 'efectividad';

/**
 * Filtra por muestra mínima y ordena.
 *
 * El mínimo de sets no es cosmético: sin él la tabla la encabezan grupos que jugaron un set y lo
 * ganaron, al 100% y sin significado. Los grupos sin sinergia calculable (los "inseparables") se
 * mandan al final cuando se ordena por sinergia, en vez de tratarlos como 0.
 */
export const ordenarSinergias = (
  grupos: GrupoSinergia[],
  { minSets, orden }: { minSets: number; orden: OrdenSinergia },
): GrupoSinergia[] => {
  const filtrados = grupos.filter((g) => g.setsJuntos >= minSets);

  const valor = (g: GrupoSinergia): number | null => {
    switch (orden) {
      case 'sinergia':
        return g.sinergia;
      case 'porcentaje':
        return g.porcentajeJuntos;
      case 'efectividad':
        return g.efectividad;
      case 'sets':
      default:
        return g.setsJuntos;
    }
  };

  return filtrados.sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null && vb === null) return b.setsJuntos - a.setsJuntos;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (vb !== va) return vb - va;
    // A igual valor manda la muestra: entre dos grupos al 75%, el de 12 sets dice más que el de 4.
    return b.setsJuntos - a.setsJuntos;
  });
};
