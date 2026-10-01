import { esDecidido, type SetAnalitico } from './setsAnaliticos';

/**
 * Umbral para considerar que un jugador participó del reparto de tiros.
 *
 * Con 6 en cancha el reparto perfectamente parejo es 16,7% cada uno. 15% deja pasar a los que
 * están cerca de esa cuota y deja afuera al que tiró dos pelotas sueltas en todo el set.
 */
const UMBRAL_TIRADOR = 0.15;

const SIN_TIROS = 'Sin tiros';

export type TramoCondicion = {
  tramo: string;
  sets: number;
  decididos: number;
  ganados: number;
  /** Sobre los decididos. `null` si ninguno cerró. */
  porcentaje: number | null;
};

/**
 * Un factor es una forma de partir los sets en tramos ordenados.
 *
 * `preparar` recibe el conjunto entero antes de clasificar porque hay factores relativos: el
 * volumen de tiros se corta por cuartiles del propio segmento, así que "mucho" depende de contra
 * qué se compare. Los factores absolutos ignoran el argumento y devuelven tramos fijos.
 *
 * Agregar un análisis nuevo es una entrada más en `FACTORES`, no una rama nueva de código.
 */
export type FactorCondicion = {
  clave: string;
  label: string;
  ayuda: string;
  preparar: (sets: SetAnalitico[]) => {
    /** Los tramos en orden de lectura, no de resultado. */
    tramos: string[];
    asignar: (set: SetAnalitico) => string;
  };
};

/** Factor de tramos fijos: no depende del conjunto. */
const factorFijo = (
  clave: string,
  label: string,
  ayuda: string,
  tramos: string[],
  asignar: (set: SetAnalitico) => string,
): FactorCondicion => ({
  clave,
  label,
  ayuda,
  preparar: () => ({ tramos, asignar }),
});

/** Tramo por conteo con tope abierto: 0 · 1 · 2 · 3+. */
const tramosConteo = (tope: number): string[] => [
  ...Array.from({ length: tope }, (_, i) => String(i)),
  `${tope}+`,
];

const asignarConteo = (valor: number, tope: number): string =>
  valor >= tope ? `${tope}+` : String(valor);

/**
 * Cuántos jugadores del set se llevaron al menos `UMBRAL_TIRADOR` de los tiros del equipo.
 * Es la cara legible de "¿tiró uno solo o se repartió?".
 */
const tiradoresEfectivos = (set: SetAnalitico): number => {
  const total = set.totales.throws;
  if (total <= 0) return 0;
  return set.jugadores.filter((j) => j.throws / total >= UMBRAL_TIRADOR).length;
};

/** Qué proporción de los tiros del equipo se llevó el que más tiró. */
const shareMaximoTirador = (set: SetAnalitico): number | null => {
  const total = set.totales.throws;
  if (total <= 0) return null;
  const maximo = set.jugadores.reduce((max, j) => Math.max(max, j.throws), 0);
  return maximo / total;
};

/**
 * Percentil por interpolación lineal sobre valores ya ordenados.
 * Con pocos sets los cuartiles se pegan entre sí; de eso se ocupa `factorVolumen`.
 */
const percentil = (ordenados: number[], p: number): number => {
  if (ordenados.length === 0) return 0;
  const pos = (ordenados.length - 1) * p;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return ordenados[bajo];
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo);
};

/**
 * Volumen de tiros del equipo, cortado por los cuartiles del segmento filtrado.
 *
 * Es relativo a propósito: "muchos tiros" no significa lo mismo en foam que en cloth, ni en un
 * torneo de sets de 3 minutos que en otro. Los cortes se recalculan con lo que los filtros
 * dejaron a la vista.
 *
 * Ojo al leerlo: los sets largos acumulan más tiros, así que este factor mezcla intensidad con
 * duración.
 */
const factorVolumen = (): FactorCondicion => ({
  clave: 'volumen',
  label: 'Volumen de tiros del equipo',
  ayuda: 'Tiros totales del equipo en el set, cortado por cuartiles de lo que estás mirando.',
  preparar: (sets) => {
    const valores = sets.map((s) => s.totales.throws).sort((a, b) => a - b);
    const cortes = [percentil(valores, 0.25), percentil(valores, 0.5), percentil(valores, 0.75)]
      .map((c) => Math.round(c))
      // Con pocos sets, o con volúmenes muy parecidos, dos cuartiles caen en el mismo número y
      // producirían un tramo vacío imposible de leer. Se colapsan.
      .filter((corte, i, arr) => i === 0 || corte > arr[i - 1]);

    if (cortes.length === 0) {
      return { tramos: ['Todos'], asignar: () => 'Todos' };
    }

    const tramos = [
      `≤ ${cortes[0]}`,
      ...cortes.slice(1).map((corte, i) => `${cortes[i] + 1} – ${corte}`),
      `${cortes[cortes.length - 1] + 1}+`,
    ];

    return {
      tramos,
      asignar: (set) => {
        const valor = set.totales.throws;
        for (let i = 0; i < cortes.length; i += 1) {
          if (valor <= cortes[i]) return tramos[i];
        }
        return tramos[tramos.length - 1];
      },
    };
  },
});

/** Los cuartos del partido, en orden de lectura. */
const CUARTOS = ['Primer cuarto', 'Segundo cuarto', 'Tercer cuarto', 'Último cuarto'];

/**
 * En qué parte del partido se jugó el set.
 *
 * Es la línea de base del ORDEN, y existe para poder leer cualquier análisis de secuencia: sin
 * esto, un "después del cambio nos fue peor" no se puede interpretar, porque no se sabe si el
 * equipo ya se cae solo hacia el final del partido (cansancio, rival que se acomoda, lo que sea).
 *
 * Se normaliza por el largo de SU partido y no por número absoluto de set, porque los partidos no
 * miden lo mismo: en los datos históricos un partido de Cloth tiene una mediana de 16 sets y uno
 * de Foam, 9. El set 8 es la mitad de uno y el cierre del otro, y agruparlos por número absoluto
 * mezclaría el principio de un partido largo con el final de uno corto.
 *
 * La normalización manda el primer set a 0 y el último a 1, así que esos dos extremos —los únicos
 * que de verdad importan para la pregunta— caen siempre donde corresponde. En un partido de menos
 * de cuatro sets algún cuarto del medio queda vacío, y `calcularCondicion` lo descarta.
 *
 * Ojo al leerlo: el largo de cada partido se deduce del set más alto PRESENTE en lo que estás
 * mirando. Si un filtro recorta sets, o si los últimos nunca se cargaron, el partido parece más
 * corto y sus sets se corren hacia el final.
 */
const factorMomentoDelPartido = (): FactorCondicion => ({
  clave: 'momento',
  label: 'Momento del partido',
  ayuda:
    'En qué cuarto del partido se jugó el set, según el largo de ese partido. Es la referencia para saber si el rendimiento ya cae solo con el correr de los sets.',
  preparar: (sets) => {
    const ultimoSetPorPartido = new Map<string, number>();
    for (const set of sets) {
      const actual = ultimoSetPorPartido.get(set.partidoId);
      if (actual === undefined || set.numeroSet > actual) {
        ultimoSetPorPartido.set(set.partidoId, set.numeroSet);
      }
    }

    return {
      tramos: CUARTOS,
      asignar: (set) => {
        const ultimo = ultimoSetPorPartido.get(set.partidoId) ?? set.numeroSet;
        // Un partido de un solo set no tiene momentos: no hay progresión que medir.
        if (ultimo <= 1) return CUARTOS[0];
        const posicion = (set.numeroSet - 1) / (ultimo - 1);
        return CUARTOS[Math.min(CUARTOS.length - 1, Math.floor(posicion * CUARTOS.length))];
      },
    };
  },
});
/**
 * Los factores disponibles.
 *
 * Todos los rangos son semiabiertos `[desde, hasta)`: un set con exactamente 50% de
 * concentración cae en "50% o más", no en "40 – 50%". Las etiquetas lo dicen explícitamente para
 * que no haya que adivinar dónde cae un borde.
 */
export const FACTORES: FactorCondicion[] = [
  factorFijo(
    'catches',
    'Catches del equipo',
    'Cuántas atajadas hizo el equipo en el set.',
    tramosConteo(3),
    (set) => asignarConteo(set.totales.catches, 3),
  ),

  factorFijo(
    'concentracion',
    'Concentración de tiros',
    'Qué proporción de los tiros del equipo se llevó el jugador que más tiró. Alto = tiró uno solo; bajo = se repartió.',
    ['Menos de 30%', '30 – 40%', '40 – 50%', '50% o más', SIN_TIROS],
    (set) => {
      const share = shareMaximoTirador(set);
      if (share === null) return SIN_TIROS;
      if (share < 0.3) return 'Menos de 30%';
      if (share < 0.4) return '30 – 40%';
      if (share < 0.5) return '40 – 50%';
      return '50% o más';
    },
  ),

  factorFijo(
    'tiradores',
    'Tiradores efectivos',
    `Cuántos jugadores se llevaron al menos el ${Math.round(UMBRAL_TIRADOR * 100)}% de los tiros del equipo.`,
    ['1 – 2', '3', '4', '5+', SIN_TIROS],
    (set) => {
      if (set.totales.throws <= 0) return SIN_TIROS;
      const cantidad = tiradoresEfectivos(set);
      if (cantidad <= 2) return '1 – 2';
      if (cantidad >= 5) return '5+';
      return String(cantidad);
    },
  ),

  factorVolumen(),

  factorFijo(
    'efectividad',
    'Efectividad del set',
    'Hits sobre throws del equipo en el set.',
    ['Menos de 30%', '30 – 45%', '45 – 60%', '60% o más', SIN_TIROS],
    (set) => {
      const { throws, hits } = set.totales;
      if (throws <= 0) return SIN_TIROS;
      const efectividad = hits / throws;
      if (efectividad < 0.3) return 'Menos de 30%';
      if (efectividad < 0.45) return '30 – 45%';
      if (efectividad < 0.6) return '45 – 60%';
      return '60% o más';
    },
  ),

  factorFijo(
    'supervivientes',
    'Supervivientes',
    'Cuántos jugadores del equipo terminaron el set en cancha.',
    tramosConteo(3),
    (set) => asignarConteo(set.totales.survives, 3),
  ),

  factorMomentoDelPartido(),
];

/**
 * El porcentaje de sets ganados en cada tramo de un factor.
 *
 * Devuelve los tramos en el orden declarado por el factor —la progresión del factor es la
 * lectura— y no los ordena por resultado. Los tramos vacíos se descartan, pero todo set
 * clasificado cae en exactamente uno: la suma de `sets` es el total del segmento.
 */
export const calcularCondicion = (
  sets: SetAnalitico[],
  factor: FactorCondicion,
): TramoCondicion[] => {
  const { tramos, asignar } = factor.preparar(sets);

  const acc = new Map<string, TramoCondicion>(
    tramos.map((tramo) => [tramo, { tramo, sets: 0, decididos: 0, ganados: 0, porcentaje: null }]),
  );

  for (const set of sets) {
    const tramo = asignar(set);
    let item = acc.get(tramo);
    if (!item) {
      // Un factor que devuelva un tramo no declarado es un bug, pero perder el set en silencio
      // rompería la invariante de que todo set está en algún lado. Se agrega al final.
      item = { tramo, sets: 0, decididos: 0, ganados: 0, porcentaje: null };
      acc.set(tramo, item);
    }
    item.sets += 1;
    if (esDecidido(set)) {
      item.decididos += 1;
      if (set.resultado === 'ganado') item.ganados += 1;
    }
  }

  return [...acc.values()]
    .filter((item) => item.sets > 0)
    .map((item) => ({
      ...item,
      porcentaje: item.decididos > 0 ? item.ganados / item.decididos : null,
    }));
};
