import { useMemo } from 'react';
import type { FilaAnalitica } from '../services/filasService';
import {
  calcularMetricasEquipo,
  calcularMetricasJugadores,
  formatearPorcentaje,
} from '../utils/metricas';
import TablaScroll from '../../../shared/components/TablaScroll/TablaScroll';

type Props = {
  filas: FilaAnalitica[];
  descripcion: string;
};

/**
 * Las estadísticas de lo que los filtros dejaron a la vista.
 *
 * Antes esta pantalla tenía dos bloques separados —"Oficial · Verificado" arriba y "Mis
 * planillas · Datos propios" abajo, con la aclaración de que no se suman—. Eso era el modelo de
 * datos filtrándose a la interfaz: el DT no piensa en "oficial" contra "mío", piensa en qué pasó
 * en estos partidos. Ahora hay una sola superficie, y qué fuente aporta los números lo decide
 * cada partido (ver `fuentePreferida`). La distinción sigue visible, pero por partido y como
 * etiqueta, no como sección aparte.
 */
const EstadisticasFiltradas = ({ filas, descripcion }: Props) => {
  const equipo = useMemo(() => calcularMetricasEquipo(filas), [filas]);
  const jugadores = useMemo(() => calcularMetricasJugadores(filas), [filas]);

  const fuentes = useMemo(() => {
    const porPartido = new Map<string, FilaAnalitica['fuente']>();
    for (const fila of filas) if (!porPartido.has(fila.partidoId)) porPartido.set(fila.partidoId, fila.fuente);
    let oficial = 0;
    let planilla = 0;
    for (const fuente of porPartido.values()) {
      if (fuente === 'oficial') oficial += 1;
      else if (fuente === 'planilla') planilla += 1;
    }
    return { oficial, planilla };
  }, [filas]);

  const tarjetas = [
    { label: 'Partidos', valor: String(equipo.jugados), pie: `${equipo.ganados}G · ${equipo.perdidos}P · ${equipo.empatados}E` },
    { label: '% victorias', valor: formatearPorcentaje(equipo.porcentajeVictorias), pie: `sobre ${equipo.jugados} jugados` },
    { label: 'Efectividad', valor: formatearPorcentaje(equipo.efectividad, 1), pie: `${equipo.hits} hits / ${equipo.throws} throws` },
    { label: 'Catches', valor: String(equipo.catches), pie: `${equipo.outs} outs recibidos` },
  ];

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-slate-900">Estadísticas</h3>
        <p className="text-xs text-slate-500">{descripcion}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
            <p className="text-xs font-medium text-slate-500">{tarjeta.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{tarjeta.valor}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{tarjeta.pie}</p>
          </div>
        ))}
      </div>

      {/* De dónde salen los números que se están sumando. Es la única aclaración que hace falta:
          sustituye al bloque separado de "datos propios". */}
      {(fuentes.oficial > 0 || fuentes.planilla > 0) && (
        <p className="text-xs text-slate-500">
          {fuentes.oficial > 0 && `${fuentes.oficial} ${fuentes.oficial === 1 ? 'partido usa' : 'partidos usan'} datos oficiales`}
          {fuentes.oficial > 0 && fuentes.planilla > 0 && ' · '}
          {fuentes.planilla > 0 && `${fuentes.planilla} ${fuentes.planilla === 1 ? 'usa tu planilla' : 'usan tu planilla'}`}
          {equipo.partidosConDatos < equipo.partidos &&
            ` · ${equipo.partidos - equipo.partidosConDatos} sin estadísticas cargadas`}
        </p>
      )}

      {jugadores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Ninguno de estos partidos tiene estadísticas cargadas todavía.
        </div>
      ) : (
        <>
          {/* En mobile, una tarjeta por jugador. Las ocho columnas necesitan 560px y en un
              teléfono dejaban visible el nombre y poco más: hits y efectividad, que son las que
              se miran, caían fuera de la pantalla sin ningún indicio de que estuvieran ahí. */}
          <ul className="space-y-2 sm:hidden">
            {jugadores.map((jugador) => (
              <li
                key={jugador.jugadorId}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-900">{jugador.jugador}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {jugador.partidos} PJ · {jugador.sets} sets
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-[11px] text-slate-500">Hits</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{jugador.hits}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Efectividad</dt>
                    <dd className="tabular-nums text-slate-800">
                      {formatearPorcentaje(jugador.efectividad, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Throws</dt>
                    <dd className="tabular-nums text-slate-800">{jugador.throws}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Catches</dt>
                    <dd className="tabular-nums text-slate-800">{jugador.catches}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Supervivencia</dt>
                    <dd className="tabular-nums text-slate-800">
                      {formatearPorcentaje(jugador.supervivencia)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <TablaScroll className="hidden rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Jugador</th>
                <th className="px-3 py-2 text-right">PJ</th>
                <th className="px-3 py-2 text-right">Sets</th>
                <th className="px-3 py-2 text-right">Throws</th>
                <th className="px-3 py-2 text-right">Hits</th>
                <th className="px-3 py-2 text-right">Efec.</th>
                <th className="px-3 py-2 text-right">Catches</th>
                <th className="px-3 py-2 text-right">Superv.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {jugadores.map((jugador) => (
                <tr key={jugador.jugadorId} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-slate-800">{jugador.jugador}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{jugador.partidos}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{jugador.sets}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{jugador.throws}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{jugador.hits}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatearPorcentaje(jugador.efectividad, 1)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{jugador.catches}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {formatearPorcentaje(jugador.supervivencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TablaScroll>
        </>
      )}
    </section>
  );
};

export default EstadisticasFiltradas;
