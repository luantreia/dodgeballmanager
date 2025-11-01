import { useEffect, useMemo, useState } from 'react';
import {
  getHistorialSolicitudesJugadorEquipo,
  getSolicitudesJugadores,
} from '../../jugadores/services/jugadorEquipoService';
import type { SolicitudJugador, ContratoJugadorResumen } from '../../../types';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

const NotificacionesPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();
  const [pendientes, setPendientes] = useState<SolicitudJugador[]>([]);
  const [historial, setHistorial] = useState<ContratoJugadorResumen[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setPendientes([]);
      setHistorial([]);
      return;
    }

    let cancelado = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [solPendientes, historico] = await Promise.all([
          getSolicitudesJugadores(equipoId),
          getHistorialSolicitudesJugadorEquipo(equipoId),
        ]);
        if (cancelado) return;
        setPendientes(solPendientes);
        setHistorial(historico);
      } catch (err) {
        console.error(err);
        if (!cancelado) {
          addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar las solicitudes del equipo.' });
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      cancelado = true;
    };
  }, [equipoSeleccionado]);

  const historialAgrupado = useMemo(() => {
    if (historial.length === 0) return [] as ContratoJugadorResumen[];
    return historial.filter((item) => item.estado !== 'pendiente');
  }, [historial]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Notificaciones</h1>
        <p className="text-sm text-slate-500">
          Revisá solicitudes, avisos de partidos y cambios importantes.
        </p>
      </header>

      {loading ? <p className="text-sm text-slate-500">Cargando solicitudes…</p> : null}

      {!equipoSeleccionado ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
          Seleccioná un equipo para ver sus solicitudes.
        </p>
      ) : (
        <div className="space-y-8">
          <section>
            <header className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Solicitudes pendientes</h2>
                <p className="text-sm text-slate-500">Invitaciones y solicitudes aún sin resolver.</p>
              </div>
              <span className="text-xs font-medium text-slate-500">{pendientes.length} pendientes</span>
            </header>

            {pendientes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No hay solicitudes pendientes.
              </p>
            ) : (
              <ul className="space-y-3">
                {pendientes.map((solicitud) => (
                  <li
                    key={solicitud.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{solicitud.jugador.nombre}</p>
                        <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                          {solicitud.origen === 'equipo' ? 'Invitación enviada' : 'Solicitud entrante'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Estado: {solicitud.estado} · Fecha:{' '}
                        {solicitud.fechaSolicitud ? new Date(solicitud.fechaSolicitud).toLocaleDateString('es-AR') : '—'}
                      </p>
                      <p className="text-xs text-slate-500">{solicitud.mensaje}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <header className="mb-3 flex items-center justify_between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Historial reciente</h2>
                <p className="text-sm text-slate-500">Solicitudes aceptadas, rechazadas o finalizadas.</p>
              </div>
            </header>

            {historialAgrupado.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No hay movimientos recientes.
              </p>
            ) : (
              <ul className="space-y-3">
                {historialAgrupado.slice(0, 10).map((item) => (
                  <li
                    key={`${item.id}-${item.estado}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.jugadorNombre}</p>
                        <p className="text-xs text-slate-500">
                          Estado: <span className="capitalize">{item.estado}</span>{' '}
                          {item.fechaAceptacion
                            ? `· ${new Date(item.fechaAceptacion).toLocaleDateString('es-AR')}`
                            : item.fechaSolicitud
                              ? `· ${new Date(item.fechaSolicitud).toLocaleDateString('es-AR')}`
                              : ''}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">Rol: {item.rol ?? '—'}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-3">
                      <span>Inicio: {item.fechaInicio ? new Date(item.fechaInicio).toLocaleDateString('es-AR') : '—'}</span>
                      <span>Fin: {item.fechaFin ? new Date(item.fechaFin).toLocaleDateString('es-AR') : '—'}</span>
                      <span>Origen: {item.origen ?? '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default NotificacionesPage;
