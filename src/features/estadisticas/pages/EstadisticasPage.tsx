import { useEffect, useMemo, useState } from 'react';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getEstadisticasEquipo, getHistorialResultados } from '../services/estadisticasService';
import EstadisticaCard from '../../../shared/components/EstadisticaCard';
import { formatDate } from '../../../utils/formatDate';
import { formatNumber } from '../../../utils/formatNumber';
import type { EstadisticaEquipoResumen, EstadisticaJugador } from '../../../types';
import { ArrowTrendingUpIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { SeccionTop5estadisticasDirectas } from '../components/sections/SeccionTop5estadisticasDirectas';



const RESULTADO_STYLES: Record<'W' | 'D' | 'L', string> = {
  W: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  D: 'bg-amber-100 text-amber-700 border border-amber-200',
  L: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const RESULTADO_LABELS: Record<'W' | 'D' | 'L', string> = {
  W: 'Victoria',
  D: 'Empate',
  L: 'Derrota',
};

const EstadisticasPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();
  const [resumen, setResumen] = useState<EstadisticaEquipoResumen | null>(null);
  const [jugadores, setJugadores] = useState<EstadisticaJugador[]>([]);
  const [historial, setHistorial] = useState<
    { fecha: string; resultado: 'W' | 'D' | 'L'; puntosAnotados: number; puntosRecibidos: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setResumen(null);
      setJugadores([]);
      setHistorial([]);
      return;
    }

    let isCancelled = false;

    const fetchEstadisticas = async () => {
      try {
        setLoading(true);
        const [datosEquipo, historialResultados] = await Promise.all([
          getEstadisticasEquipo(equipoId),
          getHistorialResultados(equipoId),
        ]);
        if (isCancelled) return;
        setResumen(datosEquipo.resumen);
        setJugadores(datosEquipo.jugadores);
        setHistorial(historialResultados);
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar las estadísticas.' });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void fetchEstadisticas();

    return () => {
      isCancelled = true;
    };
  }, [equipoSeleccionado?.id]);

  const cards = useMemo(() => {
    if (!resumen) return [];
    return [
      {
        titulo: 'Efectividad',
        valor: `${formatNumber(resumen.efectividadEquipo)}%`,
        descripcion: 'Victorias sobre el total de partidos disputados.',
        icono: <ShieldCheckIcon className="h-6 w-6" />,
        tono: 'emerald' as const,
      },
      {
        titulo: 'Puntos por partido',
        valor: formatNumber(resumen.puntosPorPartido),
        descripcion: 'Promedio ofensivo en la temporada.',
        icono: <ChartBarIcon className="h-6 w-6" />,
        tono: 'brand' as const,
      },
      {
        titulo: 'Posición actual',
        valor: resumen.posicionActual ? `#${resumen.posicionActual}` : '—',
        descripcion: 'Ranking en la competencia activa.',
        icono: <ArrowTrendingUpIcon className="h-6 w-6" />,
        tono: 'amber' as const,
      },
    ];
  }, [resumen]);

  const quickStats = useMemo(() => {
    const victorias = historial.filter((item) => item.resultado === 'W').length;
    const empates = historial.filter((item) => item.resultado === 'D').length;
    const derrotas = historial.filter((item) => item.resultado === 'L').length;

    const totalAnotados = historial.reduce((total, item) => total + item.puntosAnotados, 0);
    const totalRecibidos = historial.reduce((total, item) => total + item.puntosRecibidos, 0);
    const promedioAnotados = historial.length ? totalAnotados / historial.length : null;
    const promedioRecibidos = historial.length ? totalRecibidos / historial.length : null;

    const stats: Array<{ label: string; value: string }> = [
      { label: 'Partidos registrados', value: historial.length.toString() },
      { label: 'Balance reciente', value: `${victorias}-${empates}-${derrotas}` },
    ];

    stats.push({
      label: 'Puntos promedio a favor',
      value: promedioAnotados !== null ? formatNumber(promedioAnotados) : '—',
    });

    stats.push({
      label: 'Puntos promedio en contra',
      value: promedioRecibidos !== null ? formatNumber(promedioRecibidos) : '—',
    });

    if (resumen) {
      stats.push({ label: 'Efectividad global', value: `${formatNumber(resumen.efectividadEquipo)}%` });
      stats.push({ label: 'Posición actual', value: resumen.posicionActual ? `#${resumen.posicionActual}` : '—' });
    }

    return stats;
  }, [historial, resumen]);

  const historialReciente = useMemo(() => historial.slice(0, 5), [historial]);
  const racha = resumen?.racha ?? [];

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Elegí un equipo para ver su rendimiento histórico.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Estadísticas del equipo</h1>
        <p className="text-sm text-slate-500">Seguimiento del rendimiento, ranking y jugadores destacados.</p>
      </header>

      {loading ? <p className="text-sm text-slate-500">Cargando estadísticas…</p> : null}

      {cards.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <EstadisticaCard key={card.titulo} {...card} />
          ))}
        </section>
      ) : !loading ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Todavía no hay métricas generales para este equipo.
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.6fr_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <SeccionTop5estadisticasDirectas equipoId={equipoSeleccionado.id} />
        </div>  

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ranking interno de jugadores</h2>
              <p className="text-sm text-slate-500">Top 10 según sus métricas actuales.</p>
            </div>
            <span className="text-xs uppercase tracking-wide text-slate-400">{jugadores.length} registros</span>
          </header>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Jugador</th>
                  <th className="px-4 py-3 text-right">Partidos</th>
                  <th className="px-4 py-3 text-right">Efectividad</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-right">Bloqueos</th>
                  <th className="px-4 py-3 text-right">Faltas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {jugadores.map((item) => (
                  <tr key={item.jugador.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.jugador.nombre}</td>
                    <td className="px-4 py-3 text-right">{item.partidosJugados}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.efectividad)}%</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.puntosPromedio)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.bloqueosPromedio)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.faltasPromedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jugadores.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">Todavía no hay datos suficientes para este ranking.</p>
            ) : null}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <header className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Resumen rápido</h2>
              <p className="text-sm text-slate-500">Indicadores agregados para un vistazo general.</p>
            </header>
            {quickStats.length > 0 ? (
              <dl className="grid gap-4">
                {quickStats.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-900">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Sin datos agregados todavía.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <header className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Racha reciente</h2>
              <p className="text-sm text-slate-500">Estados de los últimos encuentros disputados.</p>
            </header>
            {racha.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {racha.map((resultado, index) => (
                  <span
                    key={`${resultado}-${index}`}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${RESULTADO_STYLES[resultado]}`}
                  >
                    {RESULTADO_LABELS[resultado]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aún no hay racha registrada para este equipo.</p>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Últimos partidos</h3>
              {historialReciente.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {historialReciente.map((item) => (
                    <li
                      key={item.fecha}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{formatDate(item.fecha)}</p>
                        <p className="text-xs text-slate-500">
                          {item.puntosAnotados} - {item.puntosRecibidos}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${RESULTADO_STYLES[item.resultado]}`}
                      >
                        {RESULTADO_LABELS[item.resultado]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Sin partidos recientes para mostrar.</p>
              )}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Historial de resultados</h2>
            <p className="text-sm text-slate-500">Detalle completo de los encuentros registrados.</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-400">{historial.length} partidos</span>
        </header>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Resultado</th>
                <th className="px-4 py-3 text-right">Puntos anotados</th>
                <th className="px-4 py-3 text-right">Puntos recibidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {historial.map((item) => (
                <tr key={item.fecha} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">{formatDate(item.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{RESULTADO_LABELS[item.resultado]}</td>
                  <td className="px-4 py-3 text-right">{item.puntosAnotados}</td>
                  <td className="px-4 py-3 text-right">{item.puntosRecibidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {historial.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-500">Sin resultados recientes.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default EstadisticasPage;
