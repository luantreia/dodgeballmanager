import { JUGADORES_POR_SET } from '../../partidos/constants/capturaSet';
import { esDecidido, type ResultadoSet, type SetAnalitico } from './setsAnaliticos';

export type JugadorRef = { jugadorId: string; jugador: string };

/** Quién salió y quién entró entre dos tramos consecutivos. */
export type CambioAlineacion = {
  salieron: JugadorRef[];
  entraron: JugadorRef[];
};

/** Una racha de sets consecutivos del mismo partido con la misma gente en cancha. */
export type TramoAlineacion = {
  /** `${partidoId}#${desdeSet}` — identidad estable dentro del dataset. */
  clave: string;
  partidoId: string;
  desdeSet: number;
  hastaSet: number;
  /** La alineación del tramo, ordenada por nombre para que se lea igual siempre. */
  jugadores: JugadorRef[];
  /** El resultado de cada set del tramo, en orden. */
  resultados: ResultadoSet[];
  sets: number;
  decididos: number;
  ganados: number;
  perdidos: number;
  /** Sobre los decididos. `null` si ninguno cerró. */
  porcentaje: number | null;
  /**
   * Qué cambió respecto del tramo anterior.
   *
   * `null` en el primer tramo del partido y también cuando hay un hueco antes: si falta la
   * captura de un set en el medio, no se sabe en qué momento cambió la alineación ni si cambió
   * una vez o tres, así que no hay nada que atribuir.
   */
  cambio: CambioAlineacion | null;
  /** Cuántos sets quedaron sin leer justo antes de este tramo. 0 si viene pegado al anterior. */
  huecoAntes: number;
};

export type SecuenciaPartido = {
  partidoId: string;
  tramos: TramoAlineacion[];
  /** Sets del partido que no se pudieron leer, por tener la alineación incompleta. */
  setsIgnorados: number;
  /** Sets del partido que sí entraron en algún tramo. */
  setsLeidos: number;
};

export type OpcionesTramos = {
  /**
   * Cuántos jugadores tiene que tener un set para que se lo lea. Por defecto, los que van en
   * cancha.
   */
  jugadoresEsperados?: number;
};

const ordenarPorNombre = (jugadores: JugadorRef[]): JugadorRef[] =>
  [...jugadores].sort((a, b) => a.jugador.localeCompare(b.jugador, 'es'));

/** Identidad de una alineación, independiente del orden en que vinieron los jugadores. */
const claveDeAlineacion = (set: SetAnalitico): string =>
  set.jugadores
    .map((j) => j.jugadorId)
    .sort()
    .join('|');

const diferencia = (anterior: SetAnalitico, actual: SetAnalitico): CambioAlineacion => {
  const idsAntes = new Set(anterior.jugadores.map((j) => j.jugadorId));
  const idsAhora = new Set(actual.jugadores.map((j) => j.jugadorId));
  return {
    salieron: ordenarPorNombre(
      anterior.jugadores
        .filter((j) => !idsAhora.has(j.jugadorId))
        .map((j) => ({ jugadorId: j.jugadorId, jugador: j.jugador })),
    ),
    entraron: ordenarPorNombre(
      actual.jugadores
        .filter((j) => !idsAntes.has(j.jugadorId))
        .map((j) => ({ jugadorId: j.jugadorId, jugador: j.jugador })),
    ),
  };
};

/**
 * Los sets de cada partido partidos en tramos de alineación estable.
 *
 * Responde "qué pasó, en orden": cuántos sets se jugaron con los mismos seis, cómo salieron, qué
 * cambió al pasar al tramo siguiente. **Es descriptivo y no afirma nada causal**, a propósito. El
 * patrón "veníamos ganando, hicimos un cambio, perdimos tres seguidos" también es exactamente lo
 * que parece el puro azar: después de una racha buena lo más probable es que venga algo peor, haya
 * cambio o no. Y la causalidad suele correr al revés — se cambia PORQUE se viene perdiendo. Para
 * decir si un cambio fue bueno hace falta agregarlo sobre muchas ocurrencias, que es otra capa.
 *
 * ## Por qué se descartan los sets con la alineación incompleta
 *
 * La alineación es, literalmente, quién tiene fila en ese set (ver `construirSets`). Para las
 * sinergias una captura incompleta sólo subcuenta; acá **inventaría un cambio que nunca pasó**: un
 * set donde alguien se olvidó de cargar a un jugador se ve idéntico a una sustitución.
 *
 * Por eso sólo se leen los sets con la cantidad esperada de jugadores, y los demás se cuentan en
 * `setsIgnorados` para que la pantalla pueda decir que la vista está incompleta. Es un criterio
 * deliberadamente estricto: un equipo que de verdad jugó con cinco queda afuera, pero el error al
 * revés —mostrar un cambio inexistente y que alguien saque a un jugador por eso— es peor.
 *
 * Un set descartado además CORTA la continuidad: el tramo que sigue arranca con `cambio: null` y
 * `huecoAntes`, porque no se sabe qué pasó en el medio.
 */
export const construirTramos = (
  sets: SetAnalitico[],
  { jugadoresEsperados = JUGADORES_POR_SET }: OpcionesTramos = {},
): SecuenciaPartido[] => {
  const porPartido = new Map<string, SetAnalitico[]>();
  for (const set of sets) {
    const lista = porPartido.get(set.partidoId);
    if (lista) lista.push(set);
    else porPartido.set(set.partidoId, [set]);
  }

  const secuencias: SecuenciaPartido[] = [];

  for (const [partidoId, setsDelPartido] of porPartido) {
    const ordenados = [...setsDelPartido].sort((a, b) => a.numeroSet - b.numeroSet);

    const tramos: TramoAlineacion[] = [];
    let setsIgnorados = 0;
    let setsLeidos = 0;

    /** El tramo que se está acumulando, con lo que hace falta para decidir si sigue o corta. */
    let abierto: { tramo: TramoAlineacion; clave: string; ultimoSet: SetAnalitico } | null = null;
    /** Sets sin leer acumulados desde que se cerró el último tramo. */
    let hueco = 0;

    const cerrar = () => {
      if (!abierto) return;
      const { tramo } = abierto;
      tramo.porcentaje = tramo.decididos > 0 ? tramo.ganados / tramo.decididos : null;
      tramos.push(tramo);
      abierto = null;
    };

    for (const set of ordenados) {
      if (set.jugadores.length !== jugadoresEsperados) {
        setsIgnorados += 1;
        hueco += 1;
        cerrar();
        continue;
      }

      setsLeidos += 1;
      const clave = claveDeAlineacion(set);

      // Un salto en la numeración (un set que no está en el dataset) es otro hueco: puede no
      // haberse jugado, haber quedado afuera por un filtro, o no haberse cargado nunca.
      const saltoDeNumeracion = abierto ? set.numeroSet - abierto.ultimoSet.numeroSet - 1 : 0;
      if (saltoDeNumeracion > 0) {
        hueco += saltoDeNumeracion;
        cerrar();
      }

      if (abierto && abierto.clave === clave) {
        const { tramo } = abierto;
        tramo.hastaSet = set.numeroSet;
        tramo.sets += 1;
        tramo.resultados.push(set.resultado);
        if (esDecidido(set)) {
          tramo.decididos += 1;
          if (set.resultado === 'ganado') tramo.ganados += 1;
          else tramo.perdidos += 1;
        }
        abierto.ultimoSet = set;
        continue;
      }

      // Cambia la alineación (o es el primer tramo legible tras un hueco): se cierra el anterior.
      // El cambio sólo se puede atribuir si el tramo anterior venía pegado a este.
      const anterior = abierto;
      cerrar();

      const tramo: TramoAlineacion = {
        clave: `${partidoId}#${set.numeroSet}`,
        partidoId,
        desdeSet: set.numeroSet,
        hastaSet: set.numeroSet,
        jugadores: ordenarPorNombre(
          set.jugadores.map((j) => ({ jugadorId: j.jugadorId, jugador: j.jugador })),
        ),
        resultados: [set.resultado],
        sets: 1,
        decididos: esDecidido(set) ? 1 : 0,
        ganados: set.resultado === 'ganado' ? 1 : 0,
        perdidos: set.resultado === 'perdido' ? 1 : 0,
        porcentaje: null,
        cambio: anterior && hueco === 0 ? diferencia(anterior.ultimoSet, set) : null,
        huecoAntes: hueco,
      };

      hueco = 0;
      abierto = { tramo, clave, ultimoSet: set };
    }

    cerrar();

    if (tramos.length > 0 || setsIgnorados > 0) {
      secuencias.push({ partidoId, tramos, setsIgnorados, setsLeidos });
    }
  }

  return secuencias;
};

export type ResumenTramos = {
  partidos: number;
  tramos: number;
  cambios: number;
  setsLeidos: number;
  setsIgnorados: number;
  /** Tramos de 2 sets o más: los únicos donde "racha" significa algo. */
  tramosConRacha: number;
};

/**
 * El encabezado de la sección. `setsIgnorados` es el número que importa mirar primero: si es una
 * fracción grande de los sets, la secuencia que se ve abajo está fragmentada por capturas
 * incompletas y no por decisiones del DT.
 */
export const resumirTramos = (secuencias: SecuenciaPartido[]): ResumenTramos => {
  let tramos = 0;
  let cambios = 0;
  let setsLeidos = 0;
  let setsIgnorados = 0;
  let tramosConRacha = 0;

  for (const secuencia of secuencias) {
    tramos += secuencia.tramos.length;
    setsLeidos += secuencia.setsLeidos;
    setsIgnorados += secuencia.setsIgnorados;
    for (const tramo of secuencia.tramos) {
      if (tramo.cambio) cambios += 1;
      if (tramo.sets >= 2) tramosConRacha += 1;
    }
  }

  return { partidos: secuencias.length, tramos, cambios, setsLeidos, setsIgnorados, tramosConRacha };
};
