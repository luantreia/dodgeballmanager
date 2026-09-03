import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { FilaAnalitica } from '../../services/filasService';

/**
 * Análisis cruzado de los partidos filtrados.
 *
 * Es una tabla dinámica de ejes fijos: en vez de arrastrar campos como en un pivot
 * completo, se elige qué va en las filas, qué en las columnas y qué métrica se mide.
 * Cubre las preguntas que un DT realmente se hace —"¿cómo rinde este jugador en los
 * sets que perdemos?"— sin sumar una librería de pivot (jQuery, drag & drop de
 * escritorio, agregadores a configurar) a una app que se usa desde el teléfono.
 *
 * Come del mismo conjunto de filas que el resto de la pantalla, ya filtrado por las facetas y
 * con la fuente resuelta por partido. Antes se pedía sus propios datos, y sólo de las planillas:
 * podía estar contradiciendo a las cifras de arriba sin que nadie lo notara.
 */

type ClaveDimension =
  | 'jugador' | 'rival' | 'categoria' | 'modalidad' | 'resultadoSet' | 'partido'
  | 'competencia' | 'temporada' | 'fase' | 'resultadoPartido' | 'fuente';

const DIMENSIONES: Array<{ clave: ClaveDimension; label: string }> = [
  { clave: 'jugador', label: 'Jugador' },
  { clave: 'rival', label: 'Rival' },
  { clave: 'categoria', label: 'Categoría' },
  { clave: 'modalidad', label: 'Modalidad' },
  { clave: 'resultadoSet', label: 'Resultado del set' },
  { clave: 'partido', label: 'Partido' },
  { clave: 'competencia', label: 'Competencia' },
  { clave: 'temporada', label: 'Temporada' },
  { clave: 'fase', label: 'Fase' },
  { clave: 'resultadoPartido', label: 'Resultado del partido' },
  { clave: 'fuente', label: 'Fuente del dato' },
];

type ClaveMetrica = 'throws' | 'hits' | 'outs' | 'catches' | 'sets' | 'hitPct' | 'survivePct' | 'outsPorSet';

const METRICAS: Array<{ clave: ClaveMetrica; label: string; porcentaje?: boolean; decimales?: number }> = [
  { clave: 'hits', label: 'Hits' },
  { clave: 'throws', label: 'Throws' },
  { clave: 'outs', label: 'Outs' },
  { clave: 'catches', label: 'Catches' },
  { clave: 'sets', label: 'Sets jugados' },
  // Puede pasar de 100%: un solo tiro puede quemar a más de un rival (un "doble"),
  // así que hits y throws no están acotados uno por el otro.
  { clave: 'hitPct', label: 'Hits por throw', porcentaje: true },
  { clave: 'survivePct', label: 'Supervivencia', porcentaje: true },
  { clave: 'outsPorSet', label: 'Outs por set', decimales: 2 },
];

/** Acumulador por celda. Se guardan numeradores y denominadores por separado. */
type Acumulador = {
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survives: number;
  sets: number;
};

const VACIO = (): Acumulador => ({ throws: 0, hits: 0, outs: 0, catches: 0, survives: 0, sets: 0 });

/**
 * Las fechas de partido se guardan a medianoche UTC. Formatearlas con `new Date()` las
 * corre un día hacia atrás en Argentina (UTC-3): un partido del 26/05 se mostraba como
 * 25/05. Se leen los componentes del propio string ISO, sin pasar por la zona horaria.
 */
const etiquetaFecha = (iso: string | null): string => {
  if (!iso) return 'Sin fecha';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'Sin fecha';
  return `${m[3]}/${m[2]}`;
};

/**
 * Etiqueta de un partido. Incluye la modalidad porque un equipo juega dos veces contra
 * el mismo rival el mismo día —uno de foam y otro de cloth— y sin ella las dos filas se
 * fusionaban en una, sumando estadísticas de dos partidos distintos bajo un solo título.
 */
const etiquetaPartido = (fila: FilaAnalitica): string =>
  `${etiquetaFecha(fila.fecha)} vs ${fila.rival} · ${fila.modalidad}`;

const valorDimension = (fila: FilaAnalitica, clave: ClaveDimension): string => {
  switch (clave) {
    // Las filas sin jugador (partidos sin estadísticas) se descartan antes de llegar acá; el
    // fallback existe sólo para que el tipo cierre.
    case 'jugador': return fila.jugador ?? 'Sin jugador';
    case 'rival': return fila.rival;
    case 'categoria': return fila.categoria;
    case 'modalidad': return fila.modalidad;
    case 'resultadoSet': return fila.resultadoSet;
    case 'partido': return etiquetaPartido(fila);
    // Dimensiones que sólo existen desde que el pivot come del dataset unificado: antes las
    // filas venían de las planillas y no traían competencia, temporada ni fase.
    case 'competencia': return fila.competencia;
    case 'temporada': return fila.temporada;
    case 'fase': return fila.fase;
    case 'resultadoPartido': return fila.resultadoPartido;
    case 'fuente': return fila.fuente === 'planilla' ? 'Mi planilla' : 'Oficial';
    default: return '—';
  }
};

/**
 * Las métricas de ratio se calculan sobre los totales acumulados, NO promediando los
 * ratios de cada fila. Un jugador con 1/1 y otro con 2/10 no tienen 75% combinado:
 * tienen 3/11. Promediar porcentajes es el error clásico de estas tablas.
 */
const calcular = (a: Acumulador | undefined, metrica: ClaveMetrica): number | null => {
  if (!a || a.sets === 0) return null;
  switch (metrica) {
    case 'throws': return a.throws;
    case 'hits': return a.hits;
    case 'outs': return a.outs;
    case 'catches': return a.catches;
    case 'sets': return a.sets;
    case 'hitPct': return a.throws > 0 ? (a.hits / a.throws) * 100 : null;
    case 'survivePct': return (a.survives / a.sets) * 100;
    case 'outsPorSet': return a.outs / a.sets;
    default: return null;
  }
};

const formatear = (valor: number | null, metrica: ClaveMetrica): string => {
  if (valor === null) return '—';
  const def = METRICAS.find((m) => m.clave === metrica);
  if (def?.porcentaje) return `${valor.toFixed(0)}%`;
  if (def?.decimales) return valor.toFixed(def.decimales);
  return String(valor);
};

interface Props {
  /**
   * Las filas ya vienen filtradas por el panel de facetas: el pivot analiza lo mismo que
   * muestran las tarjetas de arriba. Antes se las pedia solo, y solo de las planillas, asi
   * que podia estar contradiciendo al resto de la pantalla sin que se notara.
   */
  filas: FilaAnalitica[];
  /** Se llama al tocar una fila cuando las filas son partidos, para abrir su detalle. */
  onAbrirPartido?: (partidoId: string) => void;
}

const SIN_COLUMNAS = '__ninguna__';

/** Más barras que esto no se leen en un teléfono; la tabla de arriba las tiene todas. */
const MAX_BARRAS = 12;

// Secuencial en azul para una sola serie, con acentos diferenciados cuando se abre por
// columnas. Se evita el verde/rojo semántico: acá "ganado" y "perdido" son categorías,
// no un juicio de valor sobre el jugador.
const COLORES = ['#2563eb', '#0d9488', '#a16207', '#7c3aed', '#be123c', '#0369a1'];

const AnalisisCruzado: React.FC<Props> = ({ filas: filasCrudas, onAbrirPartido }) => {
  // Los partidos sin estadisticas aportan una fila sin jugador para el conteo de victorias;
  // en un pivot por jugador solo agregarian una categoria vacia.
  const filas = useMemo(() => filasCrudas.filter((f) => f.jugadorId !== null), [filasCrudas]);

  const [dimFila, setDimFila] = useState<ClaveDimension>('jugador');
  const [dimColumna, setDimColumna] = useState<ClaveDimension | typeof SIN_COLUMNAS>('resultadoSet');
  const [metrica, setMetrica] = useState<ClaveMetrica>('hitPct');

  const tabla = useMemo(() => {
    const celdas = new Map<string, Map<string, Acumulador>>();
    const totalesFila = new Map<string, Acumulador>();
    const totalesColumna = new Map<string, Acumulador>();
    const total = VACIO();

    const sumar = (acc: Acumulador, f: FilaAnalitica) => {
      acc.throws += f.throws;
      acc.hits += f.hits;
      acc.outs += f.outs;
      acc.catches += f.catches;
      if (f.survive) acc.survives += 1;
      acc.sets += 1;
    };

    for (const f of filas) {
      const kf = valorDimension(f, dimFila);
      const kc = dimColumna === SIN_COLUMNAS ? 'Total' : valorDimension(f, dimColumna);

      if (!celdas.has(kf)) celdas.set(kf, new Map());
      const fila = celdas.get(kf)!;
      if (!fila.has(kc)) fila.set(kc, VACIO());
      sumar(fila.get(kc)!, f);

      if (!totalesFila.has(kf)) totalesFila.set(kf, VACIO());
      sumar(totalesFila.get(kf)!, f);

      if (!totalesColumna.has(kc)) totalesColumna.set(kc, VACIO());
      sumar(totalesColumna.get(kc)!, f);

      sumar(total, f);
    }

    // Las filas se ordenan por la métrica elegida: lo que se está midiendo es lo que
    // define qué mirar primero.
    const clavesFila = [...celdas.keys()].sort((a, b) => {
      const va = calcular(totalesFila.get(a), metrica) ?? -Infinity;
      const vb = calcular(totalesFila.get(b), metrica) ?? -Infinity;
      return vb - va;
    });

    const clavesColumna = [...totalesColumna.keys()].sort((a, b) => a.localeCompare(b));

    // Etiqueta de partido -> id, para poder abrir el detalle desde la fila.
    const partidoPorEtiqueta = new Map<string, string>();
    if (dimFila === 'partido') {
      for (const f of filas) partidoPorEtiqueta.set(etiquetaPartido(f), f.partidoId);
    }

    return { celdas, clavesFila, clavesColumna, totalesFila, totalesColumna, total, partidoPorEtiqueta };
  }, [filas, dimFila, dimColumna, metrica]);

  const seriesGrafico = useMemo(
    () => (dimColumna === SIN_COLUMNAS ? ['Total'] : tabla.clavesColumna),
    [dimColumna, tabla.clavesColumna],
  );

  /**
   * Recharts necesita una fila por barra con una clave por serie. Las celdas sin valor
   * se omiten en vez de mandarse como 0: un jugador que no jugó ningún set empatado no
   * tiene 0% de efectividad ahí, no tiene dato.
   */
  const datosGrafico = useMemo(
    () => tabla.clavesFila.slice(0, MAX_BARRAS).map((kf) => {
      const punto: Record<string, string | number> = { nombre: kf };
      for (const kc of seriesGrafico) {
        const v = calcular(tabla.celdas.get(kf)?.get(kc), metrica);
        if (v !== null) punto[kc] = Number(v.toFixed(2));
      }
      return punto;
    }),
    [tabla, seriesGrafico, metrica],
  );

  const selectClase = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

  const maximo = useMemo(() => {
    let max = 0;
    for (const kf of tabla.clavesFila) {
      for (const kc of tabla.clavesColumna) {
        const v = calcular(tabla.celdas.get(kf)?.get(kc), metrica);
        if (v !== null && v > max) max = v;
      }
    }
    return max;
  }, [tabla, metrica]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">Análisis cruzado</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Datos propios
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Cruzá cualquier par de dimensiones sobre los partidos filtrados. Por ejemplo: jugador
          contra resultado del set, para ver quién sostiene el nivel cuando el set se pierde.
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Los partidos filtrados todavía no tienen estadísticas para cruzar.
        </p>
      ) : (
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Filas</span>
              <select className={selectClase} value={dimFila} onChange={(e) => setDimFila(e.target.value as ClaveDimension)}>
                {DIMENSIONES.map((d) => <option key={d.clave} value={d.clave}>{d.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Columnas</span>
              <select
                className={selectClase}
                value={dimColumna}
                onChange={(e) => setDimColumna(e.target.value as ClaveDimension | typeof SIN_COLUMNAS)}
              >
                <option value={SIN_COLUMNAS}>Sin abrir</option>
                {DIMENSIONES.filter((d) => d.clave !== dimFila).map((d) => (
                  <option key={d.clave} value={d.clave}>{d.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Métrica</span>
              <select className={selectClase} value={metrica} onChange={(e) => setMetrica(e.target.value as ClaveMetrica)}>
                {METRICAS.map((m) => <option key={m.clave} value={m.clave}>{m.label}</option>)}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 bg-white px-2 py-2 text-left">
                    {DIMENSIONES.find((d) => d.clave === dimFila)?.label}
                  </th>
                  {tabla.clavesColumna.map((kc) => (
                    <th key={kc} className="px-2 py-2 text-right capitalize">{kc}</th>
                  ))}
                  {tabla.clavesColumna.length > 1 && (
                    <th className="px-2 py-2 text-right text-slate-700">Total</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {tabla.clavesFila.map((kf) => (
                  <tr key={kf} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 bg-white px-2 py-2 font-medium text-slate-900">
                      {dimFila === 'partido' && onAbrirPartido && tabla.partidoPorEtiqueta.get(kf) ? (
                        <button
                          type="button"
                          onClick={() => onAbrirPartido(tabla.partidoPorEtiqueta.get(kf)!)}
                          className="rounded text-left text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          {kf}
                        </button>
                      ) : kf}
                    </td>
                    {tabla.clavesColumna.map((kc) => {
                      const v = calcular(tabla.celdas.get(kf)?.get(kc), metrica);
                      // Un sombreado suave da la lectura de un vistazo sin necesidad
                      // de un gráfico aparte.
                      const intensidad = v !== null && maximo > 0 ? v / maximo : 0;
                      return (
                        <td
                          key={kc}
                          className="px-2 py-2 text-right text-slate-700"
                          style={intensidad > 0 ? { backgroundColor: `rgba(37, 99, 235, ${(intensidad * 0.18).toFixed(3)})` } : undefined}
                        >
                          {formatear(v, metrica)}
                        </td>
                      );
                    })}
                    {tabla.clavesColumna.length > 1 && (
                      <td className="px-2 py-2 text-right font-semibold text-slate-900">
                        {formatear(calcular(tabla.totalesFila.get(kf), metrica), metrica)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 text-slate-900">
                  <td className="sticky left-0 bg-white px-2 py-2 text-xs font-bold uppercase tracking-wide">Total</td>
                  {tabla.clavesColumna.map((kc) => (
                    <td key={kc} className="px-2 py-2 text-right font-semibold tabular-nums">
                      {formatear(calcular(tabla.totalesColumna.get(kc), metrica), metrica)}
                    </td>
                  ))}
                  {tabla.clavesColumna.length > 1 && (
                    <td className="px-2 py-2 text-right font-bold tabular-nums">
                      {formatear(calcular(tabla.total, metrica), metrica)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {datosGrafico.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {METRICAS.find((m) => m.clave === metrica)?.label}
                {dimColumna !== SIN_COLUMNAS ? ` por ${DIMENSIONES.find((d) => d.clave === dimColumna)?.label.toLowerCase()}` : ''}
              </h3>
              <div style={{ width: '100%', height: Math.max(200, datosGrafico.length * 34) }}>
                <ResponsiveContainer>
                  <BarChart data={datosGrafico} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={110}
                      tick={{ fontSize: 11, fill: '#334155' }}
                    />
                    <Tooltip
                      formatter={(v: number) => formatear(v, metrica)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    {seriesGrafico.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {seriesGrafico.map((serie, i) => (
                      <Bar
                        key={serie}
                        dataKey={serie}
                        name={serie}
                        fill={COLORES[i % COLORES.length]}
                        radius={[0, 3, 3, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {tabla.clavesFila.length > MAX_BARRAS && (
                <p className="mt-1 text-xs text-slate-400">
                  El gráfico muestra las {MAX_BARRAS} primeras filas; la tabla las tiene todas.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            {filas.length} registros de {new Set(filas.map((f) => f.partidoId)).size} partidos.
            Los porcentajes se calculan sobre los totales de cada celda, no promediando
            porcentajes: un jugador con 1 de 1 y otro con 2 de 10 dan 3 de 11, no 75%.
            «Hits por throw» puede pasar de 100%: un mismo tiro puede quemar a más de un rival.
          </p>
        </div>
      )}
    </section>
  );
};

export default AnalisisCruzado;
