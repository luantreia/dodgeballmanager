import { useEffect, useMemo, useState } from 'react';
import PartidoCard from '../../../shared/components/PartidoCard/PartidoCard';
import EstadisticaCard from '../../../shared/components/EstadisticaCard/EstadisticaCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getPartidos } from '../../partidos/services/partidoService';
// Ranking reusable section
import { SeccionTop5estadisticasDirectas } from '../../estadisticas/components/sections/SeccionTop5estadisticasDirectas';
import { getSolicitudesJugadores } from '../../jugadores/services/jugadorEquipoService';
import type {
  EstadisticaEquipoResumen,
  EstadisticaJugador,
  Partido,
  SolicitudJugador,
} from '../../../types';
import { formatNumber } from '../../../utils/formatNumber';
 

const DashboardPage = () => {
  const { equipoSeleccionado, loading: loadingEquipo } = useEquipo();
  const [proximosPartidos, setProximosPartidos] = useState<Partido[]>([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudJugador[]>([]);
  const [resumenEquipo, setResumenEquipo] = useState<EstadisticaEquipoResumen | null>(null);
  const [rankingJugadores, setRankingJugadores] = useState<EstadisticaJugador[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setProximosPartidos([]);
      setSolicitudesPendientes([]);
      setResumenEquipo(null);
      setRankingJugadores([]);
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [partidos, solicitudes] = await Promise.all([
          getPartidos({ equipoId, estado: 'pendiente' }),
          getSolicitudesJugadores(equipoId),
        ]);

        if (isCancelled) return;

        const partidosOrdenados = [...partidos]
          .sort((a, b) => new Date(a.fecha as any).getTime() - new Date(b.fecha as any).getTime())
          .slice(0, 5);
        setProximosPartidos(partidosOrdenados);
        setSolicitudesPendientes(solicitudes);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          setError('No pudimos cargar el resumen del equipo. Intenta nuevamente.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [equipoSeleccionado?.id]);

  

  const statsCards = useMemo(() => {
    if (!resumenEquipo) return [];
    return [
      {
        titulo: 'Efectividad del equipo',
        valor: `${formatNumber(resumenEquipo.efectividadEquipo)}%`,
        descripcion: 'Promedio de victorias sobre el total de partidos.',
        tono: 'brand' as const,
      },
      {
        titulo: 'Puntos por partido',
        valor: formatNumber(resumenEquipo.puntosPorPartido),
        descripcion: 'Promedio en los últimos encuentros.',
        tono: 'emerald' as const,
      },
      {
        titulo: 'Posición actual',
        valor: resumenEquipo.posicionActual ? `#${resumenEquipo.posicionActual}` : '—',
        descripcion: 'Ranking en la competencia vigente.',
        tono: 'amber' as const,
      },
    ];
  }, [resumenEquipo]);

  if (loadingEquipo) {
    return <p className="text-sm text-slate-500">Cargando equipos…</p>;
  }

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Seleccioná un equipo</h2>
        <p className="mt-2 text-sm text-slate-500">
          Elegí uno de tus equipos desde el selector superior para ver el tablero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Hola, {equipoSeleccionado.nombre}</h1>
        <p className="text-sm text-slate-500">
          Gestión rápida del equipo: próximos partidos, solicitudes y rendimiento actual.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((card) => (
          <EstadisticaCard key={card.titulo} {...card} />
        ))}
        <EstadisticaCard
          titulo="Solicitudes pendientes"
          valor={solicitudesPendientes.length}
          descripcion="Jugadores y competencias aguardando tu respuesta."
        />
      </section>

        <div className="flex flex-col gap-4 ">
          <SeccionTop5estadisticasDirectas equipoId={equipoSeleccionado.id} />
        </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Próximos partidos</h2>
            <span className="text-xs uppercase tracking-wide text-slate-400">Próximos 7 días</span>
          </header>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : proximosPartidos.length ? (
            <div className="space-y-4">
              {proximosPartidos.map((partido) => (
                <PartidoCard key={partido.id} partido={partido} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No hay partidos programados para los próximos días.
            </p>
          )}
        </div>

        
      </section>

      {solicitudesPendientes.length ? (
        <section>
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Solicitudes pendientes</h2>
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {solicitudesPendientes.length} en espera
            </span>
          </header>
          <div className="space-y-3">
            {solicitudesPendientes.map((solicitud) => (
              <div
                key={solicitud.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm shadow-sm"
              >
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{solicitud.jugador.nombre}</p>
                  <p className="text-xs text-amber-700">Estado: {solicitud.estado}</p>
                  {solicitud.mensaje ? (
                    <p className="mt-1 text-xs text-amber-800">“{solicitud.mensaje}”</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700"
                >
                  Revisar
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default DashboardPage;
