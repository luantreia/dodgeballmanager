import { JUGADORES_POR_SET } from '../../partidos/constants/capturaSet';
import { esDecidido, type ResultadoSet, type SetAnalitico } from './setsAnaliticos';

export type JugadorRef = { jugadorId: string; jugador: string };

/**
 * Producción por set.
 *
 * Todo va dividido por sets y no en totales porque los tramos miden distinto: un tramo de 4 sets
 * siempre va a tener más hits que uno de 2, y compararlos en bruto sólo mide cuánto duró cada uno.
 */
export type Ritmo = {
  throwsPorSet: number;
  hitsPorSet: number;
  outsPorSet: number;
  catchesPorSet: number;
  /** hits / throws. `null` sin tiros. Puede pasar de 1: un tiro puede quemar a más de un rival. */
  efectividad: number | null;
};

export type AporteJugador = JugadorRef & {
  sets: number;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  /** Proporción de los sets del tramo en los que sobrevivió. `null` si no jugó ninguno. */
  supervivencia: number | null;
  ritmo: Ritmo;
};

/** Cuánto se movió el ritmo del equipo entre dos tramos pegados. */
export type DeltaRitmo = {
  throwsPorSet: number;
  hitsPorSet: number;
  outsPorSet: number;
  catchesPorSet: number;
  /** `null` si alguno de los dos tramos no tuvo tiros y no hay efectividad que restar. */
  efectividad: number | null;
};

/**
 * Qué cambió entre dos tramos consecutivos, con los números de los involucrados.
 *
 * Los de quienes salieron son de lo que hicieron en el tramo que ACABA de terminar; los de quienes
 * entraron, de lo que hicieron en el que ARRANCA. Son sets distintos a propósito: la pregunta es
 * "¿lo que entró rinde como lo que salió?", y eso se responde con lo que cada uno hizo cuando
 * estuvo en cancha.
 */
export type CambioAlineacion = {
  salieron: AporteJugador[];
  entraron: AporteJugador[];
  /**
   * El movimiento del ritmo del equipo entre los dos tramos.
   *
   * Es lo que cambió, NO lo que el cambio causó: los otros cinco también juegan distinto cuando
   * entra alguien nuevo, y el rival se acomoda. Sirve para separar dos cosas que el resultado solo
   * no distingue — "perdimos pero seguimos generando lo mismo" (mala suerte) de "perdimos y dejamos
   * de generar" (la producción se cayó de verdad).
   */
  delta: DeltaRitmo;
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
  /** La producción del equipo en el tramo, por set. */
  ritmo: Ritmo;
  /** Qué hizo cada jugador del tramo, de mayor a menor aporte en hits. */
  aportes: AporteJugador[];
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

type Contadores = { throws: number; hits: number; outs: number; catches: number };

const dividir = (numerador: number, denominador: number): number | null =>
  denominador > 0 ? numerador / denominador : null;

const ritmoDe = (contadores: Contadores, sets: number): Ritmo => ({
  throwsPorSet: sets > 0 ? contadores.throws / sets : 0,
  hitsPorSet: sets > 0 ? contadores.hits / sets : 0,
  outsPorSet: sets > 0 ? contadores.outs / sets : 0,
  catchesPorSet: sets > 0 ? contadores.catches / sets : 0,
  efectividad: dividir(contadores.hits, contadores.throws),
});

const deltaEntre = (antes: Ritmo, despues: Ritmo): DeltaRitmo => ({
  throwsPorSet: despues.throwsPorSet - antes.throwsPorSet,
  hitsPorSet: despues.hitsPorSet - antes.hitsPorSet,
  outsPorSet: despues.outsPorSet - antes.outsPorSet,
  catchesPorSet: despues.catchesPorSet - antes.catchesPorSet,
  efectividad:
    antes.efectividad === null || despues.efectividad === null
      ? null
      : despues.efectividad - antes.efectividad,
});

const ordenarPorNombre = <T extends JugadorRef>(jugadores: T[]): T[] =>
  [...jugadores].sort((a, b) => a.jugador.localeCompare(b.jugador, 'es'));

/** Identidad de una alineación, independiente del orden en que vinieron los jugadores. */
const claveDeAlineacion = (set: SetAnalitico): string =>
  set.jugadores
    .map((j) => j.jugadorId)
    .sort()
    .join('|');

/** Acumulador mutable de un jugador mientras el tramo sigue abierto. */
type AporteEnCurso = JugadorRef & Contadores & { sets: number; survives: number };

const aporteFinal = (enCurso: AporteEnCurso): AporteJugador => ({
  jugadorId: enCurso.jugadorId,
  jugador: enCurso.jugador,
  sets: enCurso.sets,
  throws: enCurso.throws,
  hits: enCurso.hits,
  outs: enCurso.outs,
  catches: enCurso.catches,
  supervivencia: dividir(enCurso.survives, enCurso.sets),
  ritmo: ritmoDe(enCurso, enCurso.sets),
});

/**
 * Los sets de cada partido partidos en tramos de alineación estable, con la producción de cada
 * tramo y de cada jugador.
 *
 * Responde "qué pasó, en orden": cuántos sets se jugaron con los mismos seis, cómo salieron, qué
 * cambió al pasar al tramo siguiente, y cuánto generó cada uno mientras estuvo.
 *
 * **Es descriptivo y no afirma nada causal**, a propósito. El patrón que esta vista hace visible
 * —"veníamos ganando, hicimos un cambio, perdimos tres seguidos"— es también exactamente lo que
 * parece el puro azar: después de una racha buena lo más probable es que venga algo peor, haya
 * cambio o no. Y la causalidad suele correr al revés: se cambia PORQUE se viene perdiendo.
 *
 * Los contadores ayudan justamente ahí, y es la razón por la que están: el resultado de un set de
 * tres minutos es un bit de información con muchísima varianza, mientras que los tiros, los hits y
 * las atajadas son decenas de observaciones por set. Ver que la producción se mantuvo mientras los
 * resultados se daban vuelta es una señal distinta de ver que la producción se cayó.
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
    /**
     * Cambios a resolver al final. No se pueden armar en el momento: el aporte de quien entra
     * depende de TODO el tramo nuevo, que recién se conoce cuando ese tramo cierra.
     */
    const pendientes: Array<{ tramo: TramoAlineacion; anterior: TramoAlineacion }> = [];

    /** El tramo que se está acumulando, con lo que hace falta para decidir si sigue o corta. */
    let abierto: {
      tramo: TramoAlineacion;
      clave: string;
      ultimoSet: SetAnalitico;
      totales: Contadores;
      porJugador: Map<string, AporteEnCurso>;
    } | null = null;
    /** Sets sin leer acumulados desde que se cerró el último tramo. */
    let hueco = 0;

    const acumularSet = (
      estado: NonNullable<typeof abierto>,
      set: SetAnalitico,
    ): void => {
      const { tramo, totales, porJugador } = estado;
      tramo.hastaSet = set.numeroSet;
      tramo.sets += 1;
      tramo.resultados.push(set.resultado);
      if (esDecidido(set)) {
        tramo.decididos += 1;
        if (set.resultado === 'ganado') tramo.ganados += 1;
        else tramo.perdidos += 1;
      }

      for (const jugador of set.jugadores) {
        totales.throws += jugador.throws;
        totales.hits += jugador.hits;
        totales.outs += jugador.outs;
        totales.catches += jugador.catches;

        let acumulado = porJugador.get(jugador.jugadorId);
        if (!acumulado) {
          acumulado = {
            jugadorId: jugador.jugadorId,
            jugador: jugador.jugador,
            throws: 0,
            hits: 0,
            outs: 0,
            catches: 0,
            sets: 0,
            survives: 0,
          };
          porJugador.set(jugador.jugadorId, acumulado);
        }
        acumulado.throws += jugador.throws;
        acumulado.hits += jugador.hits;
        acumulado.outs += jugador.outs;
        acumulado.catches += jugador.catches;
        acumulado.sets += 1;
        if (jugador.survive) acumulado.survives += 1;
      }

      estado.ultimoSet = set;
    };

    const cerrar = (): TramoAlineacion | null => {
      if (!abierto) return null;
      const { tramo, totales, porJugador } = abierto;
      tramo.porcentaje = dividir(tramo.ganados, tramo.decididos);
      tramo.ritmo = ritmoDe(totales, tramo.sets);
      tramo.aportes = [...porJugador.values()]
        .map(aporteFinal)
        .sort((a, b) => b.hits - a.hits || a.jugador.localeCompare(b.jugador, 'es'));
      tramos.push(tramo);
      const cerrado = tramo;
      abierto = null;
      return cerrado;
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
        acumularSet(abierto, set);
        continue;
      }

      // Cambia la alineación (o es el primer tramo legible tras un hueco): se cierra el anterior.
      // El cambio sólo se puede atribuir si el tramo anterior venía pegado a este.
      const anterior = cerrar();
      const seguido = anterior !== null && hueco === 0;

      const tramo: TramoAlineacion = {
        clave: `${partidoId}#${set.numeroSet}`,
        partidoId,
        desdeSet: set.numeroSet,
        hastaSet: set.numeroSet,
        jugadores: ordenarPorNombre(
          set.jugadores.map((j) => ({ jugadorId: j.jugadorId, jugador: j.jugador })),
        ),
        resultados: [],
        sets: 0,
        decididos: 0,
        ganados: 0,
        perdidos: 0,
        porcentaje: null,
        ritmo: ritmoDe({ throws: 0, hits: 0, outs: 0, catches: 0 }, 0),
        aportes: [],
        cambio: null,
        huecoAntes: hueco,
      };

      hueco = 0;
      abierto = {
        tramo,
        clave,
        ultimoSet: set,
        totales: { throws: 0, hits: 0, outs: 0, catches: 0 },
        porJugador: new Map(),
      };
      acumularSet(abierto, set);

      if (seguido && anterior) pendientes.push({ tramo, anterior });
    }

    cerrar();

    // Recién acá los dos lados de cada cambio tienen sus aportes cerrados.
    for (const { tramo, anterior } of pendientes) {
      const idsAntes = new Set(anterior.aportes.map((a) => a.jugadorId));
      const idsAhora = new Set(tramo.aportes.map((a) => a.jugadorId));

      tramo.cambio = {
        salieron: ordenarPorNombre(anterior.aportes.filter((a) => !idsAhora.has(a.jugadorId))),
        entraron: ordenarPorNombre(tramo.aportes.filter((a) => !idsAntes.has(a.jugadorId))),
        delta: deltaEntre(anterior.ritmo, tramo.ritmo),
      };
    }

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
