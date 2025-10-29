import { useEffect, useMemo, useState } from 'react';
import { useEquipo } from '../context/EquipoContext';
import { getEstadisticasEquipo, getHistorialResultados } from '../api/estadisticas';
import EstadisticaCard from '../components/EstadisticaCard';
import { formatDate } from '../utils/formatDate';
import { formatNumber } from '../utils/formatNumber';
import type { EstadisticaEquipoResumen, EstadisticaJugador } from '../types';
import { ArrowTrendingUpIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const EstadisticasPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const [resumen, setResumen] = useState<EstadisticaEquipoResumen | null>(null);
  const [jugadores, setJugadores] = useState<EstadisticaJugador[]>([]);
  const [historial, setHistorial] = useState<
    { fecha: string; resultado: 'W' | 'D' | 'L'; puntosAnotados: number; puntosRecibidos: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(null);
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          setError('No pudimos cargar las estadísticas.');
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
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Estadísticas del equipo</h1>
        <p className="text-sm text-slate-500">Seguimiento del rendimiento, ranking y jugadores destacados.</p>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Cargando estadísticas…</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <EstadisticaCard key={card.titulo} {...card} />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Ranking interno de jugadores</h2>
          <p className="text-sm text-slate-500">Top 10 según sus métricas actuales.</p>
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Historial de resultados</h2>
            <p className="text-sm text-slate-500">Últimos encuentros con sus marcadores.</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {historial.length} partidos recientes
          </span>
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
                  <td className="px-4 py-3 font-medium text-slate-900">{item.resultado}</td>
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
