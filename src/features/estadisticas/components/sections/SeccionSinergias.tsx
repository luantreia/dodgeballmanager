import { useMemo, useState } from 'react';
import type { SetAnalitico } from '../../utils/setsAnaliticos';
import {
  calcularSinergias,
  ordenarSinergias,
  TAMANO_MAXIMO,
  TAMANO_MINIMO,
  type GrupoSinergia,
  type OrdenSinergia,
} from '../../utils/sinergias';
import { formatearPorcentaje } from '../../utils/metricas';
import TablaScroll from '../../../../shared/components/TablaScroll/TablaScroll';

type Props = {
  sets: SetAnalitico[];
};

const NOMBRE_TAMANO: Record<number, string> = {
  2: 'Duplas',
  3: 'Tríos',
  4: 'Cuartetos',
  5: 'Quintetos',
  6: 'Sextetos',
};

const MINIMOS = [2, 4, 6, 10];

const ORDENES: Array<{ clave: OrdenSinergia; label: string }> = [
  { clave: 'sinergia', label: 'Sinergia' },
  { clave: 'porcentaje', label: '% victoria juntos' },
  { clave: 'sets', label: 'Sets juntos' },
  { clave: 'efectividad', label: 'Efectividad' },
];

const selectClase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

/** La sinergia en puntos porcentuales, con signo. `—` cuando no hay con qué comparar. */
const formatearSinergia = (valor: number | null): string => {
  if (valor === null) return '—';
  const puntos = valor * 100;
  return `${puntos > 0 ? '+' : ''}${puntos.toFixed(0)} pts`;
};

const colorSinergia = (valor: number | null): string => {
  if (valor === null) return 'text-slate-400';
  if (valor > 0.05) return 'text-emerald-700';
  if (valor < -0.05) return 'text-rose-700';
  return 'text-slate-600';
};

const NombresGrupo = ({ nombres }: { nombres: string[] }) => (
  <span className="font-medium text-slate-900">{nombres.join(' + ')}</span>
);

const EtiquetaInseparables = () => (
  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
    Inseparables
  </span>
);

/**
 * La misma fila de la tabla, para pantallas donde la tabla no entra.
 *
 * Diez columnas necesitan 720px; un teléfono tiene 375. Convertida en scroll horizontal, la
 * columna de sinergia —la única razón de ser de la sección— quedaba fuera de la pantalla y sin
 * ninguna señal de que existiera. Acá el número que importa va arriba y grande, y el resto
 * ordenado debajo en pares etiqueta/valor.
 */
const TarjetaFilaGrupo = ({ grupo }: { grupo: GrupoSinergia }) => {
  const dato = (label: string, valor: string) => (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-800">{valor}</dd>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <NombresGrupo nombres={grupo.nombres} />
          {grupo.sinergia === null && (
            <div className="mt-1">
              <EtiquetaInseparables />
            </div>
          )}
        </div>
        <span className={`shrink-0 text-lg font-bold tabular-nums ${colorSinergia(grupo.sinergia)}`}>
          {formatearSinergia(grupo.sinergia)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {dato('Juntos', `${grupo.setsJuntos} sets · ${formatearPorcentaje(grupo.porcentajeJuntos)}`)}
        {dato(
          'Separados',
          `${grupo.setsSeparados} sets · ${formatearPorcentaje(grupo.porcentajeSeparados)}`,
        )}
        {dato('Efectividad', formatearPorcentaje(grupo.efectividad, 1))}
        {dato('Hits por set', grupo.hitsPorSet === null ? '—' : grupo.hitsPorSet.toFixed(1))}
        {dato('Catches', String(grupo.catches))}
        {dato('Supervivencia', formatearPorcentaje(grupo.supervivencia))}
      </dl>
    </div>
  );
};

/**
 * Tarjeta de titular: un grupo destacado, arriba de la tabla.
 * Repite el número que importa y el tamaño de muestra, porque un +30 pts sobre 3 sets y otro
 * sobre 20 no son el mismo hallazgo y la tarjeta no debería dejar que se confundan.
 */
const TarjetaGrupo = ({ grupo, tono }: { grupo: GrupoSinergia; tono: 'bueno' | 'malo' }) => (
  <div
    className={`rounded-xl border p-3 ${
      tono === 'bueno' ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
    }`}
  >
    <p className="text-sm">
      <NombresGrupo nombres={grupo.nombres} />
    </p>
    <p
      className={`mt-1 text-xl font-bold tabular-nums ${
        tono === 'bueno' ? 'text-emerald-700' : 'text-rose-700'
      }`}
    >
      {formatearSinergia(grupo.sinergia)}
    </p>
    <p className="mt-0.5 text-[11px] text-slate-500">
      {formatearPorcentaje(grupo.porcentajeJuntos)} juntos ({grupo.setsJuntos} sets) ·{' '}
      {formatearPorcentaje(grupo.porcentajeSeparados)} separados
    </p>
  </div>
);

/**
 * Sinergias entre jugadores: qué grupos rinden mejor juntos que sueltos.
 *
 * La métrica es on/off — el % de sets ganados con el grupo entero en cancha contra el % de esos
 * mismos jugadores en los sets donde no estuvieron todos. Se eligió sobre el % de victorias a
 * secas porque en un equipo que gana el 70% de los sets casi todos los grupos rondan el 70%: ese
 * ranking premia jugar en un equipo bueno, no la química entre esos jugadores.
 *
 * Come de los mismos sets que el resto de la pantalla, ya filtrados, así que "lo que ves" y "lo
 * que se mide" no pueden separarse.
 */
const SeccionSinergias = ({ sets }: Props) => {
  const [tamano, setTamano] = useState(2);
  const [minSets, setMinSets] = useState(4);
  const [orden, setOrden] = useState<OrdenSinergia>('sinergia');

  // Los seis tamaños salen de una sola pasada: cambiar de duplas a tríos no recalcula nada.
  const sinergias = useMemo(() => calcularSinergias(sets), [sets]);

  const grupos = useMemo(
    () => ordenarSinergias(sinergias.get(tamano) ?? [], { minSets, orden }),
    [sinergias, tamano, minSets, orden],
  );

  const conSinergia = useMemo(() => grupos.filter((g) => g.sinergia !== null), [grupos]);
  const mejores = conSinergia.slice(0, 3);
  /**
   * Los peores salen de lo que quedó después de los mejores, no de los últimos tres a secas.
   * Con menos de seis grupos las dos puntas se solapan, y ver a la misma dupla destacada como
   * la mejor y señalada como la peor al mismo tiempo no es un caso raro —pasa apenas los filtros
   * se ajustan un poco— sino la forma más rápida de que el panel pierda credibilidad.
   */
  const peores = conSinergia.slice(Math.max(3, conSinergia.length - 3)).reverse();
  const inseparables = grupos.length - conSinergia.length;

  const tamanosDisponibles = useMemo(() => {
    const disponibles: number[] = [];
    for (let t = TAMANO_MINIMO; t <= TAMANO_MAXIMO; t += 1) {
      if ((sinergias.get(t)?.length ?? 0) > 0) disponibles.push(t);
    }
    return disponibles;
  }, [sinergias]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">Sinergias</h2>
        <p className="mt-1 text-sm text-slate-500">
          Qué grupos rinden mejor juntos que sueltos. La sinergia es la diferencia entre el
          porcentaje de sets ganados con el grupo completo en cancha y el de esos mismos jugadores
          en los sets donde no estuvieron todos.
        </p>
      </header>

      {sets.length === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Los partidos filtrados no tienen estadísticas cargadas set a set, que es de donde sale
          quién jugó con quién.
        </p>
      ) : (
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Grupo
              </span>
              <select
                className={selectClase}
                value={tamano}
                onChange={(e) => setTamano(Number(e.target.value))}
              >
                {tamanosDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_TAMANO[t]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mínimo de sets juntos
              </span>
              <select
                className={selectClase}
                value={minSets}
                onChange={(e) => setMinSets(Number(e.target.value))}
              >
                {MINIMOS.map((m) => (
                  <option key={m} value={m}>
                    {m} sets o más
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ordenar por
              </span>
              <select
                className={selectClase}
                value={orden}
                onChange={(e) => setOrden(e.target.value as OrdenSinergia)}
              >
                {ORDENES.map((o) => (
                  <option key={o.clave} value={o.clave}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {grupos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ningún {NOMBRE_TAMANO[tamano]?.toLowerCase().replace(/s$/, '') ?? 'grupo'} llegó a{' '}
              {minSets} sets juntos en lo que estás mirando. Bajá el mínimo o ampliá los filtros.
            </p>
          ) : (
            <>
              {mejores.length > 0 && (
                <div className={`grid gap-4 ${peores.length > 0 ? 'lg:grid-cols-2' : ''}`}>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mejores químicas
                    </h3>
                    <div className="space-y-2">
                      {mejores.map((g) => (
                        <TarjetaGrupo key={g.clave} grupo={g} tono="bueno" />
                      ))}
                    </div>
                  </div>
                  {peores.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        A revisar
                      </h3>
                      <div className="space-y-2">
                        {peores.map((g) => (
                          <TarjetaGrupo key={g.clave} grupo={g} tono="malo" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tarjetas en mobile, tabla desde `sm`. La tabla necesita 720px para sus diez
                  columnas: forzarla en 375px la convierte en un carrusel donde la columna de
                  sinergia queda fuera de cuadro. */}
              <div className="space-y-2 sm:hidden">
                {grupos.map((g) => (
                  <TarjetaFilaGrupo key={g.clave} grupo={g} />
                ))}
              </div>

              <TablaScroll className="hidden sm:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="sticky left-0 bg-white px-2 py-2 text-left">Grupo</th>
                      <th className="px-2 py-2 text-right">Sets</th>
                      <th className="px-2 py-2 text-right">% juntos</th>
                      <th className="px-2 py-2 text-right">Sets sep.</th>
                      <th className="px-2 py-2 text-right">% separados</th>
                      <th className="px-2 py-2 text-right text-slate-700">Sinergia</th>
                      <th className="px-2 py-2 text-right">Efect.</th>
                      <th className="px-2 py-2 text-right">Hits/set</th>
                      <th className="px-2 py-2 text-right">Catches</th>
                      <th className="px-2 py-2 text-right">Superv.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {grupos.map((g) => (
                      <tr key={g.clave} className="hover:bg-slate-50/60">
                        <td className="sticky left-0 bg-white px-2 py-2">
                          <NombresGrupo nombres={g.nombres} />
                          {g.sinergia === null && (
                            <span className="ml-2">
                              <EtiquetaInseparables />
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">{g.setsJuntos}</td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {formatearPorcentaje(g.porcentajeJuntos)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-500">{g.setsSeparados}</td>
                        <td className="px-2 py-2 text-right text-slate-500">
                          {formatearPorcentaje(g.porcentajeSeparados)}
                        </td>
                        <td className={`px-2 py-2 text-right font-semibold ${colorSinergia(g.sinergia)}`}>
                          {formatearSinergia(g.sinergia)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {formatearPorcentaje(g.efectividad, 1)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {g.hitsPorSet === null ? '—' : g.hitsPorSet.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">{g.catches}</td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {formatearPorcentaje(g.supervivencia)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaScroll>
            </>
          )}

          <p className="text-xs text-slate-500">
            Sale de {sets.length} sets con estadísticas cargadas set a set; los partidos con
            captura directa no dicen quién jugó con quién y no entran.{' '}
            {inseparables > 0 && (
              <>
                {inseparables} {inseparables === 1 ? 'grupo' : 'grupos'} figuran como
                «inseparables»: nunca jugaron sin estar todos, así que no hay contra qué comparar y
                su sinergia queda sin calcular, no en cero.{' '}
              </>
            )}
            Si un set quedó capturado a medias, aporta las duplas y tríos que sí se cargaron pero
            ningún grupo grande.
          </p>
        </div>
      )}
    </section>
  );
};

export default SeccionSinergias;
