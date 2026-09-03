import { useMemo } from 'react';
import type { FilaAnalitica } from '../services/filasService';
import type { PartidoTimeline } from '../services/timelineService';
import { aplicarFiltros, type EstadoFiltros } from '../hooks/useFiltrosPartidos';
import {
  calcularMetricasEquipo,
  calcularMetricasJugadores,
  formatearPorcentaje,
  type MetricasEquipo,
} from '../utils/metricas';

export type Segmento = { id: string; nombre: string; estado: EstadoFiltros };

type Props = {
  segmentos: Segmento[];
  partidos: PartidoTimeline[];
  filas: FilaAnalitica[];
  onQuitar: (id: string) => void;
  onLimpiar: () => void;
};

type MetricaFila = {
  label: string;
  valor: (m: MetricasEquipo) => string;
  /** Para la flecha de comparación: más alto es mejor, más bajo es peor, o ni una cosa ni otra. */
  direccion?: 'mas_mejor';
  crudo?: (m: MetricasEquipo) => number | null;
};

const METRICAS_EQUIPO: MetricaFila[] = [
  { label: 'Partidos jugados', valor: (m) => String(m.jugados) },
  { label: 'Ganados', valor: (m) => String(m.ganados), direccion: 'mas_mejor', crudo: (m) => m.ganados },
  { label: 'Perdidos', valor: (m) => String(m.perdidos) },
  {
    label: '% victorias',
    valor: (m) => formatearPorcentaje(m.porcentajeVictorias),
    direccion: 'mas_mejor',
    crudo: (m) => m.porcentajeVictorias,
  },
  { label: 'Sets ganados', valor: (m) => `${m.setsGanados}–${m.setsPerdidos}` },
  {
    label: 'Efectividad (hits/throw)',
    valor: (m) => formatearPorcentaje(m.efectividad, 1),
    direccion: 'mas_mejor',
    crudo: (m) => m.efectividad,
  },
  { label: 'Hits', valor: (m) => String(m.hits), direccion: 'mas_mejor', crudo: (m) => m.hits },
  { label: 'Catches', valor: (m) => String(m.catches), direccion: 'mas_mejor', crudo: (m) => m.catches },
  { label: 'Partidos con datos', valor: (m) => `${m.partidosConDatos} de ${m.partidos}` },
];

/** Flecha contra el primer segmento. Sólo tiene sentido a partir de la segunda columna. */
const Delta = ({ actual, base }: { actual: number | null; base: number | null }) => {
  if (actual === null || base === null || actual === base) return null;
  const mejor = actual > base;
  return (
    <span className={`ml-1 text-[10px] font-bold ${mejor ? 'text-emerald-600' : 'text-rose-600'}`}>
      {mejor ? '▲' : '▼'}
    </span>
  );
};

/**
 * Comparación lado a lado de segmentos: cada uno es un estado de filtros guardado.
 *
 * Un DT no evalúa en absoluto, evalúa contra algo: contra el año pasado, contra otra modalidad,
 * contra otra categoría. Una sola vista filtrada responde "cuánto"; nunca "mejoró o empeoró".
 *
 * Los segmentos se evalúan con la MISMA función de filtrado que usa la pantalla
 * (`aplicarFiltros`), así que lo que compara es exactamente lo que verías si aplicaras esos
 * filtros a mano.
 */
const ComparadorSegmentos = ({ segmentos, partidos, filas, onQuitar, onLimpiar }: Props) => {
  const columnas = useMemo(
    () =>
      segmentos.map((segmento) => {
        const idsPartidos = new Set(
          aplicarFiltros(partidos, segmento.estado).map((p) => p._id),
        );
        const filasSegmento = filas.filter((f) => idsPartidos.has(f.partidoId));
        return {
          segmento,
          equipo: calcularMetricasEquipo(filasSegmento),
          jugadores: calcularMetricasJugadores(filasSegmento),
        };
      }),
    [segmentos, partidos, filas],
  );

  /** Jugadores presentes en al menos un segmento, ordenados por hits totales. */
  const jugadores = useMemo(() => {
    const totales = new Map<string, { nombre: string; hits: number }>();
    for (const columna of columnas) {
      for (const jugador of columna.jugadores) {
        const actual = totales.get(jugador.jugadorId);
        if (actual) actual.hits += jugador.hits;
        else totales.set(jugador.jugadorId, { nombre: jugador.jugador, hits: jugador.hits });
      }
    }
    return [...totales.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.hits - a.hits || a.nombre.localeCompare(b.nombre, 'es'));
  }, [columnas]);

  if (segmentos.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Comparación · {segmentos.length} {segmentos.length === 1 ? 'segmento' : 'segmentos'}
        </h3>
        <button
          type="button"
          onClick={onLimpiar}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          Vaciar comparación
        </button>
      </header>

      {segmentos.length === 1 && (
        <p className="mb-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-900">
          Cambiá los filtros y agregá otro segmento para comparar. Las flechas comparan contra el
          primero.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-2 pr-3 text-xs uppercase tracking-wide text-slate-500">Métrica</th>
              {columnas.map(({ segmento }) => (
                <th key={segmento.id} className="pb-2 pr-3 align-bottom">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">{segmento.nombre}</span>
                    <button
                      type="button"
                      onClick={() => onQuitar(segmento.id)}
                      aria-label={`Quitar ${segmento.nombre}`}
                      className="shrink-0 rounded px-1 text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {METRICAS_EQUIPO.map((metrica) => (
              <tr key={metrica.label} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 text-slate-600">{metrica.label}</td>
                {columnas.map((columna, indice) => (
                  <td key={columna.segmento.id} className="py-1.5 pr-3 font-medium text-slate-800">
                    {metrica.valor(columna.equipo)}
                    {indice > 0 && metrica.direccion === 'mas_mejor' && metrica.crudo && (
                      <Delta
                        actual={metrica.crudo(columna.equipo)}
                        base={metrica.crudo(columnas[0].equipo)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jugadores.length > 0 && (
        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3" open>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Efectividad por jugador
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">Jugador</th>
                  {columnas.map(({ segmento }) => (
                    <th key={segmento.id} className="pb-2 pr-3">
                      {segmento.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {jugadores.map((jugador) => (
                  <tr key={jugador.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 text-slate-800">{jugador.nombre}</td>
                    {columnas.map((columna, indice) => {
                      const m = columna.jugadores.find((j) => j.jugadorId === jugador.id);
                      const base = columnas[0].jugadores.find((j) => j.jugadorId === jugador.id);
                      return (
                        <td key={columna.segmento.id} className="py-1.5 pr-3 text-slate-700">
                          {m ? (
                            <>
                              {formatearPorcentaje(m.efectividad, 1)}
                              <span className="ml-1 text-[10px] text-slate-400">
                                {m.hits}/{m.throws}
                              </span>
                              {indice > 0 && (
                                <Delta actual={m.efectividad} base={base?.efectividad ?? null} />
                              )}
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
};

export default ComparadorSegmentos;
