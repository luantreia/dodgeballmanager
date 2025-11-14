import React, { useCallback, useEffect, useState } from 'react';
import { obtenerSolicitudesEdicion, actualizarSolicitudEdicion, cancelarSolicitudEdicion } from '../services/solicitudesEdicionService';
import { getUsuarioById } from '../../auth/services/usersService';
import type { SolicitudEdicion, Usuario } from '../../../types';
import { getEquipoAdministradoresIds } from '../../equipo/services/equipoService';
import { useAuth } from '../../../app/providers/AuthContext';
import { authFetch } from '../../../utils/authFetch';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

interface DatosCrearJugadorEquipo {
  jugadorId: string;
  equipoId: string;
  fechaInicio?: string;
  fechaFin?: string;
  rol?: string;
}

interface Props {
  equipoId: string;
  onRefresh?: () => void;
}

const SolicitudesPendientesSection: React.FC<Props> = ({ equipoId, onRefresh }) => {
  const [solicitudes, setSolicitudes] = useState<SolicitudEdicion[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuariosCreadores, setUsuariosCreadores] = useState<Map<string, Usuario>>(new Map());
  const [adminsEquipo, setAdminsEquipo] = useState<string[]>([]);
  const [jugadorNombres, setJugadorNombres] = useState<Map<string, string>>(new Map());
  const [jugadorAdmins, setJugadorAdmins] = useState<Map<string, string[]>>(new Map());
  const { user } = useAuth();
  const { addToast } = useToast();

  const cargarSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      // Obtener todas las solicitudes pendientes
      const todasPendientes = await obtenerSolicitudesEdicion({ estado: 'pendiente' });

      // Filtrar las que están relacionadas con este equipo (tipo jugador-equipo-crear)
      const relacionadas = todasPendientes.filter((solicitud: SolicitudEdicion) => {
        if (solicitud.tipo === 'jugador-equipo-crear') {
          const datos = solicitud.datosPropuestos as unknown as DatosCrearJugadorEquipo;
          return datos.equipoId === equipoId;
        }
        return false;
      });

      setSolicitudes(relacionadas);

      // Cargar admins del equipo
      try {
        const ids = await getEquipoAdministradoresIds(equipoId);
        setAdminsEquipo(ids);
      } catch (e) {
        console.error('Error cargando administradores del equipo:', e);
      }

      // Cargar usuarios creadores
      const creadorIds = relacionadas.map((s: SolicitudEdicion) => s.creadoPor);
      const idsUnicos = Array.from(new Set(creadorIds));

      for (const creadorId of idsUnicos) {
        try {
          const usuario = await getUsuarioById(creadorId as string);
          setUsuariosCreadores(prev => new Map(prev.set(creadorId as string, usuario)));
        } catch (error) {
          console.error(`Error cargando usuario ${creadorId}:`, error);
        }
      }

      // Cargar nombres de jugadores involucrados
      const jugadorIds = Array.from(
        new Set(
          relacionadas
            .filter((s) => s.tipo === 'jugador-equipo-crear')
            .map((s) => (s.datosPropuestos as unknown as { jugadorId?: string }).jugadorId)
            .filter((id): id is string => Boolean(id))
        )
      );

      await Promise.all(
        jugadorIds.map(async (jid) => {
          try {
            const jugador = await authFetch<{ _id: string; nombre: string; administradores?: any[] }>(
              `/jugadores/${jid}`
            );
            setJugadorNombres(prev => new Map(prev.set(jid, jugador?.nombre)));
            const admins: string[] = Array.isArray(jugador?.administradores)
              ? jugador.administradores.map((a: any) => {
                  if (typeof a === 'string') return a;
                  if (a?._id) return String(a._id);
                  if (a?.id) return String(a.id);
                  return String(a);
                })
              : [];
            setJugadorAdmins(prev => new Map(prev.set(jid, admins)));
          } catch (e) {
            console.error('Error obteniendo jugador', jid, e);
          }
        })
      );
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No pudimos cargar las solicitudes pendientes',
      });
    } finally {
      setLoading(false);
    }
  }, [equipoId, addToast]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'aceptado':
        return 'bg-green-100 text-green-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'jugador-equipo-crear':
        return 'Solicitud de ingreso';
      case 'jugador-equipo-eliminar':
        return 'Solicitud de abandono';
      default:
        return tipo;
    }
  };

  const handleAprobar = async (solicitudId: string) => {
    try {
      await actualizarSolicitudEdicion(solicitudId, { estado: 'aceptado' });
      await cargarSolicitudes();
      onRefresh?.();
      addToast({ type: 'success', title: 'Éxito', message: 'Solicitud aprobada' });
    } catch (error: any) {
      console.error('Error aprobando solicitud:', error);
      addToast({
        type: 'error',
        title: 'No se pudo aprobar',
        message: `Status ${error?.status ?? '—'} · ${error?.message ?? 'Error desconocido'}`,
      });
    }
  };

  const handleRechazar = async (solicitudId: string) => {
    try {
      await actualizarSolicitudEdicion(solicitudId, { estado: 'rechazado' });
      await cargarSolicitudes();
      onRefresh?.();
      addToast({ type: 'success', title: 'Éxito', message: 'Solicitud rechazada' });
    } catch (error: any) {
      console.error('Error rechazando solicitud:', error);
      addToast({
        type: 'error',
        title: 'No se pudo rechazar',
        message: `Status ${error?.status ?? '—'} · ${error?.message ?? 'Error desconocido'}`,
      });
    }
  };

  const handleCancelar = async (solicitudId: string) => {
    try {
      await cancelarSolicitudEdicion(solicitudId);
      await cargarSolicitudes();
      onRefresh?.();
      addToast({ type: 'success', title: 'Éxito', message: 'Solicitud cancelada' });
    } catch (error: any) {
      console.error('Error cancelando solicitud:', error);
      addToast({
        type: 'error',
        title: 'No se pudo cancelar',
        message: `Status ${error?.status ?? '—'} · ${error?.message ?? 'Error desconocido'}`,
      });
    }
  };

  if (solicitudes.length === 0 && !loading) {
    return null; // No mostrar nada si no hay solicitudes
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-semibold text-amber-900">Solicitudes Pendientes</h3>
        <p className="text-sm text-amber-700">
          {loading ? 'Cargando...' : `${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''}`}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-amber-700">Cargando solicitudes…</p>
      ) : solicitudes.length === 0 ? (
        <p className="text-sm text-amber-700">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id} className="flex items-start justify-between gap-4 border border-amber-200 rounded-lg bg-white p-3">
              <div className="flex-1 text-sm">
                <div className="font-semibold text-slate-900">{getTipoLabel(solicitud.tipo)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {(() => {
                    const userCreador = usuariosCreadores.get(solicitud.creadoPor);
                    if (userCreador) {
                      return `${userCreador.nombre} (${userCreador.email})`;
                    }
                    return `Usuario ${solicitud.creadoPor.slice(-6)}`;
                  })()}
                  {' | '}
                  {(() => {
                    const fecha = (solicitud as any).fechaCreacion || (solicitud as any).createdAt;
                    return fecha ? new Date(fecha).toLocaleString('es-AR') : 'Fecha no disponible';
                  })()}
                </div>

                {solicitud.datosPropuestos && solicitud.tipo === 'jugador-equipo-crear' && (() => {
                  const datos = solicitud.datosPropuestos as unknown as DatosCrearJugadorEquipo;
                  return (
                    <div className="mt-2 text-xs bg-amber-100/50 p-2 rounded border border-amber-200">
                      <div className="font-medium text-slate-700">
                        📋 {jugadorNombres.get(datos.jugadorId) || 'Cargando…'}
                      </div>
                      <div className="text-slate-600 mt-1">
                        <div>Rol: <span className="font-medium">{datos.rol || 'jugador'}</span></div>
                        {datos.fechaInicio && (
                          <div>Desde: <span className="font-medium">{new Date(datos.fechaInicio).toLocaleDateString('es-AR')}</span></div>
                        )}
                        {datos.fechaFin && (
                          <div>Hasta: <span className="font-medium">{new Date(datos.fechaFin).toLocaleDateString('es-AR')}</span></div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getEstadoColor(solicitud.estado)}`}>
                  {solicitud.estado}
                </span>

                {(() => {
                  const creadorIdStr = String(solicitud.creadoPor);
                  const usuarioIdStr = user?.id ? String(user.id) : '';

                  const datos = solicitud.datosPropuestos as any;
                  const jugadorId = datos?.jugadorId as string | undefined;
                  const adminsJugadorParaSolicitud = jugadorId ? jugadorAdmins.get(jugadorId) || [] : [];

                  const creadorEsEquipo = adminsEquipo.includes(creadorIdStr);
                  const creadorEsJugador = adminsJugadorParaSolicitud.includes(creadorIdStr);
                  const usuarioEsAdminEquipo = usuarioIdStr ? adminsEquipo.includes(usuarioIdStr) : false;
                  const usuarioEsAdminJugador = usuarioIdStr ? adminsJugadorParaSolicitud.includes(usuarioIdStr) : false;
                  const esCreador = usuarioIdStr && creadorIdStr === usuarioIdStr;

                  const puedeCancelar = Boolean(
                    esCreador || (creadorEsEquipo && usuarioEsAdminEquipo) || (creadorEsJugador && usuarioEsAdminJugador)
                  );

                  let puedeAprobar = user?.rol === 'admin';
                  if (!puedeAprobar) {
                    if (creadorEsEquipo) puedeAprobar = usuarioEsAdminJugador;
                    else if (creadorEsJugador) puedeAprobar = usuarioEsAdminEquipo;
                    else puedeAprobar = usuarioEsAdminEquipo;
                  }

                  return (
                    <div className="flex gap-1">
                      {puedeCancelar ? (
                        <button
                          onClick={() => handleCancelar(solicitud.id)}
                          className="text-xs bg-slate-500 hover:bg-slate-600 text-white px-2 py-1 rounded transition"
                          title="Cancelar solicitud"
                        >
                          Cancelar
                        </button>
                      ) : puedeAprobar ? (
                        <>
                          <button
                            onClick={() => handleAprobar(solicitud.id)}
                            className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded transition"
                            title="Aprobar solicitud"
                          >
                            ✓ Aprobar
                          </button>
                          <button
                            onClick={() => handleRechazar(solicitud.id)}
                            className="text-xs bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded transition"
                            title="Rechazar solicitud"
                          >
                            ✕ Rechazar
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default SolicitudesPendientesSection;
