import { useCallback, useMemo, useState } from 'react';
import type { PartidoTimeline } from '../services/timelineService';

export type ClaveFaceta =
  | 'modalidad'
  | 'categoria'
  | 'organizacion'
  | 'competencia'
  | 'temporada'
  | 'fase'
  | 'rival'
  | 'datos';

export const FACETAS: Array<{ clave: ClaveFaceta; label: string }> = [
  { clave: 'modalidad', label: 'Modalidad' },
  { clave: 'categoria', label: 'Categoría' },
  { clave: 'organizacion', label: 'Organización' },
  { clave: 'competencia', label: 'Competencia' },
  { clave: 'temporada', label: 'Temporada' },
  { clave: 'fase', label: 'Fase' },
  { clave: 'rival', label: 'Rival' },
  { clave: 'datos', label: 'Estado de los datos' },
];

/**
 * Los amistosos no tienen competencia, y por lo tanto tampoco organización, temporada ni fase.
 * Sin un valor explícito para ese caso, cualquier selección en esas facetas los haría
 * desaparecer en silencio: el DT filtraría "modalidad Foam" y perdería sus amistosos de foam
 * sin entender por qué. Con esto son un valor elegible más, y se ven en el contador.
 */
const SIN_VALOR = '__sin_valor__';

type ValorFaceta = { valor: string; label: string };

/**
 * De qué valor(es) de cada faceta participa un partido.
 *
 * `modalidad` y `categoria` salen del PARTIDO, no de su competencia: son campos propios y
 * obligatorios del partido, y los amistosos no tienen competencia de la cual heredarlos. La
 * modalidad de la competencia sólo sirve para etiquetar la competencia en su propia faceta.
 */
const valorDe = (partido: PartidoTimeline, clave: ClaveFaceta): ValorFaceta => {
  switch (clave) {
    case 'modalidad':
      return { valor: partido.modalidad || SIN_VALOR, label: partido.modalidad || 'Sin modalidad' };
    case 'categoria':
      return { valor: partido.categoria || SIN_VALOR, label: partido.categoria || 'Sin categoría' };
    case 'organizacion': {
      const org = partido.competencia?.organizacion;
      return org ? { valor: org._id, label: org.nombre } : { valor: SIN_VALOR, label: 'Amistoso' };
    }
    case 'competencia':
      return partido.competencia
        ? { valor: partido.competencia._id, label: partido.competencia.nombre }
        : { valor: SIN_VALOR, label: 'Amistoso' };
    case 'temporada':
      return partido.temporada
        ? { valor: partido.temporada._id, label: partido.temporada.nombre }
        : { valor: SIN_VALOR, label: 'Sin temporada' };
    case 'fase':
      return partido.fase
        ? { valor: partido.fase._id, label: partido.fase.nombre }
        : { valor: SIN_VALOR, label: 'Sin fase' };
    case 'rival':
      return partido.rival
        ? { valor: partido.rival._id, label: partido.rival.nombre }
        : { valor: SIN_VALOR, label: 'Sin rival' };
    case 'datos': {
      const { oficial, planilla, fuenteEfectiva } = partido.datos;
      if (fuenteEfectiva === 'sin_datos') return { valor: 'sin_datos', label: 'Sin estadísticas' };
      if (oficial.existe && planilla) return { valor: 'ambas', label: 'Oficial + planilla' };
      if (oficial.verificada) return { valor: 'verificada', label: 'Oficial verificada' };
      if (oficial.existe) return { valor: 'oficial', label: 'Oficial sin verificar' };
      return { valor: 'planilla', label: 'Solo mi planilla' };
    }
    default:
      return { valor: SIN_VALOR, label: '—' };
  }
};

export type Filtros = Record<ClaveFaceta, Set<string>>;

const filtrosVacios = (): Filtros => ({
  modalidad: new Set(),
  categoria: new Set(),
  organizacion: new Set(),
  competencia: new Set(),
  temporada: new Set(),
  fase: new Set(),
  rival: new Set(),
  datos: new Set(),
});

/** Vacío = sin restricción. Dentro de una faceta los valores son OR; entre facetas, AND. */
const pasaFaceta = (partido: PartidoTimeline, clave: ClaveFaceta, filtros: Filtros): boolean => {
  const seleccion = filtros[clave];
  if (seleccion.size === 0) return true;
  return seleccion.has(valorDe(partido, clave).valor);
};

const enRango = (partido: PartidoTimeline, desde: string, hasta: string): boolean => {
  if (!desde && !hasta) return true;
  const t = new Date(partido.fecha).getTime();
  if (Number.isNaN(t)) return false;
  // Los inputs date dan 'YYYY-MM-DD' y se leen como día local. El extremo `hasta` incluye
  // el día entero: si no, un partido de las 20:00 del último día quedaba afuera.
  if (desde && t < new Date(`${desde}T00:00:00`).getTime()) return false;
  if (hasta && t > new Date(`${hasta}T23:59:59.999`).getTime()) return false;
  return true;
};

export type OpcionFaceta = { valor: string; label: string; cantidad: number; seleccionada: boolean };

export type ResultadoFiltros = {
  filtros: Filtros;
  desde: string;
  hasta: string;
  partidosFiltrados: PartidoTimeline[];
  /** Opciones de cada faceta con su contador, ya excluida la selección de esa misma faceta. */
  opciones: Record<ClaveFaceta, OpcionFaceta[]>;
  hayFiltros: boolean;
  alternar: (clave: ClaveFaceta, valor: string) => void;
  limpiarFaceta: (clave: ClaveFaceta) => void;
  limpiarTodo: () => void;
  setDesde: (valor: string) => void;
  setHasta: (valor: string) => void;
};

/**
 * Búsqueda facetada sobre los partidos del equipo.
 *
 * Dos reglas hacen que se comporte como el DT espera:
 *
 * 1. El contador de cada opción se calcula aplicando TODOS los filtros MENOS el de su propia
 *    faceta. Si no, al elegir un rival el resto de los rivales mostraría cero y no se podría
 *    agregar un segundo — que es justo lo que uno quiere al comparar.
 * 2. Al cambiar un filtro, las selecciones de otras facetas que quedaron en cero se
 *    deseleccionan solas. Elegir modalidad Foam saca las competencias de Cloth que hubieras
 *    elegido antes, en vez de dejar una combinación imposible que no devuelve nada.
 */
export const useFiltrosPartidos = (partidos: PartidoTimeline[]): ResultadoFiltros => {
  const [filtros, setFiltros] = useState<Filtros>(filtrosVacios);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  /**
   * Saca de cada faceta los valores que ya no existen en el conjunto restante, repitiendo
   * hasta que se estabiliza: quitar una competencia puede vaciar una temporada, que a su vez
   * puede vaciar una fase. El tope de vueltas es una red de seguridad, no una expectativa —
   * hay ocho facetas y cada vuelta sólo puede quitar valores, así que converge sola.
   *
   * `clavePinneada` es la faceta que el usuario acaba de tocar, y no se poda nunca. Sin eso la
   * poda es simétrica y un conflicto borra los dos lados: al elegir Foam teniendo seleccionada
   * una competencia de Cloth, se caían la competencia Y la modalidad, y el filtro terminaba
   * vacío mostrando todo. Lo que uno acaba de pedir es lo que tiene que ganar.
   */
  const podar = useCallback(
    (candidatos: Filtros, d: string, h: string, clavePinneada?: ClaveFaceta): Filtros => {
      let actuales = candidatos;

      for (let vuelta = 0; vuelta < FACETAS.length; vuelta += 1) {
        // Todas las facetas de una misma vuelta se evalúan contra la MISMA foto de los
        // filtros. Si se fueran leyendo los cambios a medida que ocurren, el resultado
        // dependería del orden en que están declaradas las facetas.
        const foto = actuales;
        let huboCambio = false;
        const siguiente: Filtros = { ...foto };

        for (const { clave } of FACETAS) {
          if (clave === clavePinneada) continue;
          if (foto[clave].size === 0) continue;

          const posibles = new Set<string>();
          for (const partido of partidos) {
            if (!enRango(partido, d, h)) continue;
            const pasaElResto = FACETAS.every(
              (f) => f.clave === clave || pasaFaceta(partido, f.clave, foto),
            );
            if (pasaElResto) posibles.add(valorDe(partido, clave).valor);
          }

          const depurada = new Set([...foto[clave]].filter((v) => posibles.has(v)));
          if (depurada.size !== foto[clave].size) {
            siguiente[clave] = depurada;
            huboCambio = true;
          }
        }

        if (!huboCambio) return actuales;
        actuales = siguiente;
      }

      return actuales;
    },
    [partidos],
  );

  const alternar = useCallback(
    (clave: ClaveFaceta, valor: string) => {
      setFiltros((prev) => {
        const seleccion = new Set(prev[clave]);
        if (seleccion.has(valor)) seleccion.delete(valor);
        else seleccion.add(valor);
        return podar({ ...prev, [clave]: seleccion }, desde, hasta, clave);
      });
    },
    [podar, desde, hasta],
  );

  const limpiarFaceta = useCallback(
    (clave: ClaveFaceta) => {
      setFiltros((prev) => podar({ ...prev, [clave]: new Set<string>() }, desde, hasta));
    },
    [podar, desde, hasta],
  );

  const limpiarTodo = useCallback(() => {
    setFiltros(filtrosVacios());
    setDesde('');
    setHasta('');
  }, []);

  // Cambiar el rango también puede dejar selecciones imposibles (elegiste un rival al que
  // sólo enfrentaste en 2024 y después acotaste a 2026).
  const cambiarDesde = useCallback(
    (valor: string) => {
      setDesde(valor);
      setFiltros((prev) => podar(prev, valor, hasta));
    },
    [podar, hasta],
  );

  const cambiarHasta = useCallback(
    (valor: string) => {
      setHasta(valor);
      setFiltros((prev) => podar(prev, desde, valor));
    },
    [podar, desde],
  );

  const partidosFiltrados = useMemo(
    () =>
      partidos.filter(
        (partido) =>
          enRango(partido, desde, hasta) &&
          FACETAS.every((f) => pasaFaceta(partido, f.clave, filtros)),
      ),
    [partidos, filtros, desde, hasta],
  );

  const opciones = useMemo(() => {
    const resultado = {} as Record<ClaveFaceta, OpcionFaceta[]>;

    for (const { clave } of FACETAS) {
      const conteo = new Map<string, { label: string; cantidad: number }>();

      for (const partido of partidos) {
        if (!enRango(partido, desde, hasta)) continue;
        const pasaElResto = FACETAS.every(
          (f) => f.clave === clave || pasaFaceta(partido, f.clave, filtros),
        );
        if (!pasaElResto) continue;

        const { valor, label } = valorDe(partido, clave);
        const actual = conteo.get(valor);
        if (actual) actual.cantidad += 1;
        else conteo.set(valor, { label, cantidad: 1 });
      }

      resultado[clave] = [...conteo.entries()]
        .map(([valor, { label, cantidad }]) => ({
          valor,
          label,
          cantidad,
          seleccionada: filtros[clave].has(valor),
        }))
        .sort((a, b) => b.cantidad - a.cantidad || a.label.localeCompare(b.label, 'es'));
    }

    return resultado;
  }, [partidos, filtros, desde, hasta]);

  const hayFiltros =
    Boolean(desde) || Boolean(hasta) || FACETAS.some((f) => filtros[f.clave].size > 0);

  return {
    filtros,
    desde,
    hasta,
    partidosFiltrados,
    opciones,
    hayFiltros,
    alternar,
    limpiarFaceta,
    limpiarTodo,
    setDesde: cambiarDesde,
    setHasta: cambiarHasta,
  };
};
