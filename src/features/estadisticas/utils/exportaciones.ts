import { construirCsv, type ColumnaCsv } from '../../../shared/utils/csv';
import type { FilaAnalitica } from '../services/filasService';
import type { PartidoTimeline } from '../services/timelineService';
import { aplicarFiltros, type EstadoFiltros } from '../hooks/useFiltrosPartidos';
import { calcularMetricasEquipo, calcularMetricasJugadores, type MetricasEquipo } from './metricas';

/**
 * Las exportaciones a CSV de la pantalla de análisis.
 *
 * Regla de diseño, no detalle: **se exporta lo que los filtros dejaron a la vista, nunca todo el
 * historial.** Un botón que baja un dump convierte al CSV en la herramienta de análisis y a la
 * plataforma en un depósito: el DT se lleva un Excel que nadie más puede reproducir ni comparar.
 * Exportando el recorte, el CSV es la salida de un análisis que se hizo acá, y el nombre del
 * archivo lleva de qué recorte salió.
 *
 * Son funciones puras que devuelven el contenido del archivo. Quien las llama se encarga de la
 * descarga (`descargarCsv`), así que todo esto se puede testear sin tocar el DOM.
 */

/** Sólo la fecha, sin hora: es lo que Excel parsea como fecha sin pelear con la zona horaria. */
const soloFecha = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

const COLUMNAS_FILAS: Array<ColumnaCsv<FilaAnalitica>> = [
  { encabezado: 'Fecha', valor: (f) => soloFecha(f.fecha) },
  { encabezado: 'Estado del partido', valor: (f) => f.estadoPartido },
  { encabezado: 'Modalidad', valor: (f) => f.modalidad },
  { encabezado: 'Categoría', valor: (f) => f.categoria },
  { encabezado: 'Organización', valor: (f) => f.organizacion },
  { encabezado: 'Competencia', valor: (f) => f.competencia },
  { encabezado: 'Temporada', valor: (f) => f.temporada },
  { encabezado: 'Fase', valor: (f) => f.fase },
  { encabezado: 'Rival', valor: (f) => f.rival },
  { encabezado: 'Condición', valor: (f) => (f.esLocal ? 'local' : 'visitante') },
  { encabezado: 'Marcador equipo', valor: (f) => f.marcadorEquipo },
  { encabezado: 'Marcador rival', valor: (f) => f.marcadorRival },
  { encabezado: 'Resultado del partido', valor: (f) => f.resultadoPartido },
  // Qué alimentó estos números: el registro de la competencia o la planilla propia del equipo.
  // Sin esta columna el CSV mezcla las dos fuentes sin dejar rastro de cuál es cuál.
  { encabezado: 'Fuente', valor: (f) => f.fuente ?? 'sin datos' },
  { encabezado: 'Set', valor: (f) => f.numeroSet },
  { encabezado: 'Resultado del set', valor: (f) => f.resultadoSet },
  { encabezado: 'Jugador', valor: (f) => f.jugador },
  { encabezado: 'Throws', valor: (f) => f.throws },
  { encabezado: 'Hits', valor: (f) => f.hits },
  { encabezado: 'Outs', valor: (f) => f.outs },
  { encabezado: 'Catches', valor: (f) => f.catches },
  { encabezado: 'Sobrevive', valor: (f) => f.survive },
  // Última y técnica: sirve para cruzar con otra exportación o deduplicar en una tabla dinámica.
  { encabezado: 'ID del partido', valor: (f) => f.partidoId },
];

/**
 * El dataset crudo: una fila por jugador y por set, con el contexto del partido encima. Es la base
 * para cualquier tabla dinámica que el DT quiera armar por su cuenta.
 *
 * Incluye las filas de partidos sin ninguna estadística cargada (jugador vacío y todo en cero).
 * Están a propósito: existen para que un partido ganado sin planilla siga contando como ganado, y
 * si se filtraran acá la cantidad de partidos del CSV no coincidiría con la de la pantalla.
 */
export const csvDeFilas = (filas: FilaAnalitica[]): string => construirCsv(filas, COLUMNAS_FILAS);

type FilaJugador = ReturnType<typeof calcularMetricasJugadores>[number];

const COLUMNAS_JUGADORES: Array<ColumnaCsv<FilaJugador>> = [
  { encabezado: 'Jugador', valor: (j) => j.jugador },
  { encabezado: 'Partidos', valor: (j) => j.partidos },
  { encabezado: 'Sets', valor: (j) => j.sets },
  { encabezado: 'Throws', valor: (j) => j.throws },
  { encabezado: 'Hits', valor: (j) => j.hits },
  { encabezado: 'Outs', valor: (j) => j.outs },
  { encabezado: 'Catches', valor: (j) => j.catches },
  // Las proporciones van como número (0,47), no como texto ("47%"): así se pueden promediar y
  // graficar. Quien abra el archivo le da formato de porcentaje si lo quiere ver así.
  { encabezado: 'Efectividad (hits/throws)', valor: (j) => j.efectividad, decimales: 3 },
  { encabezado: 'Supervivencia (sets)', valor: (j) => j.supervivencia, decimales: 3 },
];

/** La tabla por jugador de lo que está a la vista, ya agregada. */
export const csvDeMetricasPorJugador = (filas: FilaAnalitica[]): string =>
  construirCsv(calcularMetricasJugadores(filas), COLUMNAS_JUGADORES);

export type SegmentoExportable = { id: string; nombre: string; estado: EstadoFiltros };

/**
 * Las métricas del comparador, en el mismo orden en que las muestra la pantalla. A diferencia de
 * la tabla, acá van los valores crudos y no formateados: "3–1" para los sets o "47%" para la
 * efectividad se leen bien pero no se pueden sumar ni graficar en una planilla de cálculo.
 */
const METRICAS_COMPARACION: Array<{ label: string; valor: (m: MetricasEquipo) => number | null }> = [
  { label: 'Partidos', valor: (m) => m.partidos },
  { label: 'Jugados', valor: (m) => m.jugados },
  { label: 'Ganados', valor: (m) => m.ganados },
  { label: 'Perdidos', valor: (m) => m.perdidos },
  { label: 'Empatados', valor: (m) => m.empatados },
  { label: '% victorias', valor: (m) => m.porcentajeVictorias },
  { label: 'Sets ganados', valor: (m) => m.setsGanados },
  { label: 'Sets perdidos', valor: (m) => m.setsPerdidos },
  { label: 'Throws', valor: (m) => m.throws },
  { label: 'Hits', valor: (m) => m.hits },
  { label: 'Outs', valor: (m) => m.outs },
  { label: 'Catches', valor: (m) => m.catches },
  { label: 'Efectividad (hits/throws)', valor: (m) => m.efectividad },
  { label: 'Partidos con datos', valor: (m) => m.partidosConDatos },
];

/**
 * La comparación de segmentos: una fila por métrica y una columna por segmento, igual que en
 * pantalla. Los segmentos se evalúan con `aplicarFiltros`, la MISMA función que usa la pantalla,
 * así que el CSV no puede decir algo distinto de lo que la tabla muestra.
 */
export const csvDeComparacionSegmentos = (
  segmentos: SegmentoExportable[],
  partidos: PartidoTimeline[],
  filas: FilaAnalitica[],
): string => {
  const columnasPorSegmento = segmentos.map((segmento) => {
    const ids = new Set(aplicarFiltros(partidos, segmento.estado).map((p) => p._id));
    return { segmento, metricas: calcularMetricasEquipo(filas.filter((f) => ids.has(f.partidoId))) };
  });

  type FilaComparacion = { label: string; valores: Array<number | null> };

  const registros: FilaComparacion[] = METRICAS_COMPARACION.map((metrica) => ({
    label: metrica.label,
    valores: columnasPorSegmento.map(({ metricas }) => metrica.valor(metricas)),
  }));

  const columnas: Array<ColumnaCsv<FilaComparacion>> = [
    { encabezado: 'Métrica', valor: (f) => f.label },
    ...columnasPorSegmento.map((columna, indice) => ({
      encabezado: columna.segmento.nombre,
      valor: (f: FilaComparacion) => f.valores[indice],
      // En esta tabla cada columna mezcla conteos enteros con proporciones, porque lo que varía
      // por fila es la métrica. No hace falta un decimal por fila: `construirCsv` sólo aplica
      // los decimales a los valores no enteros, así que los conteos salen limpios igual.
      decimales: 3,
    })),
  ];

  return construirCsv(registros, columnas);
};
