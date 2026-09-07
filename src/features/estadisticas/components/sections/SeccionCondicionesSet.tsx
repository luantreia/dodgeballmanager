import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { resumirSets, type SetAnalitico } from '../../utils/setsAnaliticos';
import { calcularCondicion, FACTORES } from '../../utils/condicionesSet';
import { formatearPorcentaje } from '../../utils/metricas';
import TablaScroll from '../../../../shared/components/TablaScroll/TablaScroll';
import { useEsMobile } from '../../../../shared/hooks/useEsMobile';

type Props = {
  sets: SetAnalitico[];
};

/** Debajo de esta muestra el porcentaje de un tramo es ruido; se dibuja atenuado. */
const MUESTRA_CONFIABLE = 5;

const selectClase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

/**
 * Bajo qué condiciones gana sets el equipo.
 *
 * Un factor parte los sets filtrados en tramos —cuántos catches hubo, si los tiros los concentró
 * un jugador o se repartieron, cuántos sobrevivieron— y se mira el porcentaje de sets ganados en
 * cada uno. Responde preguntas del tipo "¿ganamos más cuando el ataque se reparte?".
 *
 * Los tramos van en el orden del factor y no ordenados por resultado: la lectura es la progresión
 * del factor, no un ranking. Y siempre contra la línea del promedio del segmento — un tramo al
 * 60% no significa nada hasta saber si el equipo gana el 40% o el 70% en general.
 */
const SeccionCondicionesSet = ({ sets }: Props) => {
  const [claveFactor, setClaveFactor] = useState(FACTORES[0].clave);
  const esMobile = useEsMobile();

  const factor = FACTORES.find((f) => f.clave === claveFactor) ?? FACTORES[0];
  const tramos = useMemo(() => calcularCondicion(sets, factor), [sets, factor]);
  const base = useMemo(() => resumirSets(sets), [sets]);

  const datos = useMemo(
    () =>
      tramos.map((t) => ({
        tramo: t.tramo,
        porcentaje: t.porcentaje === null ? null : Number((t.porcentaje * 100).toFixed(1)),
        sets: t.sets,
        decididos: t.decididos,
        confiable: t.decididos >= MUESTRA_CONFIABLE,
      })),
    [tramos],
  );

  const promedio = base.porcentaje === null ? null : Number((base.porcentaje * 100).toFixed(1));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">Condiciones del set</h2>
        <p className="mt-1 text-sm text-slate-500">
          Con qué condiciones de juego coincide ganar. Elegí un factor y mirá el porcentaje de sets
          ganados en cada tramo, contra el promedio del equipo en lo que estás filtrando.
        </p>
      </header>

      {sets.length === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Los partidos filtrados no tienen estadísticas cargadas set a set, que es la unidad que
          mide este panel.
        </p>
      ) : (
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Factor
              </span>
              <select
                className={selectClase}
                value={claveFactor}
                onChange={(e) => setClaveFactor(e.target.value)}
              >
                {FACTORES.map((f) => (
                  <option key={f.clave} value={f.clave}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <p className="text-xs text-slate-500">{factor.ayuda}</p>
            </div>
          </div>

          <div style={{ width: '100%', height: Math.max(200, datos.length * 44) }}>
            <ResponsiveContainer>
              <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                {/* En un teléfono de 375px, 120px de eje se llevaban un tercio del ancho y las
                    barras quedaban en muñones de los que no se podía leer nada. */}
                <YAxis
                  type="category"
                  dataKey="tramo"
                  width={esMobile ? 84 : 120}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(valor: number, _n: string, item: { payload?: { decididos?: number } }) => [
                    `${valor}% · ${item.payload?.decididos ?? 0} sets decididos`,
                    'Sets ganados',
                  ]}
                />
                {promedio !== null && (
                  <ReferenceLine
                    x={promedio}
                    stroke="#0f172a"
                    strokeDasharray="4 4"
                    label={{
                      value: `Promedio ${promedio}%`,
                      position: 'top',
                      fontSize: 11,
                      fill: '#0f172a',
                    }}
                  />
                )}
                <Bar dataKey="porcentaje" radius={[0, 3, 3, 0]}>
                  {datos.map((d) => (
                    // Los tramos con poca muestra se atenúan: un 100% sobre 2 sets no tiene que
                    // competir visualmente con un 62% sobre 30.
                    <Cell
                      key={d.tramo}
                      fill={d.confiable ? '#2563eb' : '#bfdbfe'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <TablaScroll>
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 bg-white px-2 py-2 text-left">{factor.label}</th>
                  <th className="px-2 py-2 text-right">Sets</th>
                  <th className="px-2 py-2 text-right">Decididos</th>
                  <th className="px-2 py-2 text-right">Ganados</th>
                  <th className="px-2 py-2 text-right text-slate-700">% ganados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {tramos.map((t) => (
                  <tr key={t.tramo} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 bg-white px-2 py-2 font-medium text-slate-900">
                      {t.tramo}
                      {t.decididos > 0 && t.decididos < MUESTRA_CONFIABLE && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Poca muestra
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">{t.sets}</td>
                    <td className="px-2 py-2 text-right text-slate-500">{t.decididos}</td>
                    <td className="px-2 py-2 text-right text-slate-500">{t.ganados}</td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900">
                      {formatearPorcentaje(t.porcentaje)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 text-slate-900">
                  <td className="sticky left-0 bg-white px-2 py-2 text-xs font-bold uppercase tracking-wide">
                    Total
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{base.sets}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{base.decididos}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{base.ganados}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">
                    {formatearPorcentaje(base.porcentaje)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TablaScroll>

          <p className="text-xs text-slate-500">
            Esto es asociación, no causa: los catches ganan sets casi por definición —el que ataja
            elimina al que tiró y revive a un compañero— y los sets largos acumulan más tiros. El
            panel muestra con qué condiciones coincide ganar, no que provocarlas garantice ganar.
            Los empates y los sets sin cerrar cuentan como sets jugados pero salen del porcentaje.
          </p>
        </div>
      )}
    </section>
  );
};

export default SeccionCondicionesSet;
