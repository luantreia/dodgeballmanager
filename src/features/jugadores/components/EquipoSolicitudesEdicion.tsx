import React, { useEffect, useState } from 'react';
import { obtenerSolicitudesEdicion, actualizarSolicitudEdicion, cancelarSolicitudEdicion } from '../services/solicitudesEdicionService';
import { getUsuarioById } from '../../auth/services/usersService';
import type { SolicitudEdicion, Usuario } from '../../../types';
import { getEquipoAdministradoresIds } from '../../equipo/services/equipoService';
import { useAuth } from '../../../app/providers/AuthContext';
import { authFetch } from '../../../utils/authFetch';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

// Interfaces específicas para los datos de las solicitudes
interface DatosCrearJugadorEquipo {
  jugadorId: string;
  equipoId: string;
  fechaInicio?: string;
  fechaFin?: string;
  rol?: string;
}

interface DatosEliminarJugadorEquipo {
  contratoId: string;
}

type DatosSolicitud = DatosCrearJugadorEquipo | DatosEliminarJugadorEquipo;

interface Props {
  equipoId: string;
}

const EquipoSolicitudesEdicion: React.FC<Props> = ({ equipoId }) => {
  const [solicitudes, setSolicitudes] = useState<SolicitudEdicion[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuariosCreadores, setUsuariosCreadores] = useState<Map<string, Usuario>>(new Map());
  const [adminsEquipo, setAdminsEquipo] = useState<string[]>([]);
  const [jugadorNombres, setJugadorNombres] = useState<Map<string, string>>(new Map());
  const [jugadorAdmins, setJugadorAdmins] = useState<Map<string, string[]>>(new Map());
  const { user } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    cargarSolicitudes();
  }, [equipoId]);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      // Cargar todas las solicitudes pendientes
      const todasPendientes = await obtenerSolicitudesEdicion({ estado: 'pendiente' });

      // Filtrar las que están relacionadas con este equipo
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

      // Cargar nombres de jugadores involucrados en las solicitudes
      const jugadorIds = Array.from(new Set(
        relacionadas
          .filter((s) => s.tipo === 'jugador-equipo-crear')
          .map((s) => (s.datosPropuestos as unknown as { jugadorId?: string }).jugadorId)
          .filter((id): id is string => Boolean(id))
      ));

      await Promise.all(jugadorIds.map(async (jid) => {
        try {
          const jugador = await authFetch<{ _id: string; nombre: string; administradores?: any[] }>(`/jugadores/${jid}`);
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
      }));
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'aceptado': return 'bg-green-100 text-green-800';
      case 'rechazado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'jugador-equipo-crear': return 'Solicitud de ingreso';
      case 'jugador-equipo-eliminar': return 'Solicitud de abandono';
      default: return tipo;
    }
  };

  const handleAprobar = async (solicitudId: string) => {
    try {
      await actualizarSolicitudEdicion(solicitudId, { estado: 'aceptado' });
      await cargarSolicitudes();
    } catch (error: any) {
      console.error('Error aprobando solicitud:', error);
      addToast({ type: 'error', title: 'No se pudo aprobar', message: `Status ${error?.status ?? '—'} · ${error?.message ?? 'Error desconocido'}` });
    }
  };

  const handleRechazar = async (solicitudId: string) => {
    try {
      await actualizarSolicitudEdicion(solicitudId, { estado: 'rechazado' });
      await cargarSolicitudes();
    } catch (error: any) {
      console.error('Error rechazando solicitud:', error);
      addToast({ type: 'error', title: 'No se pudo rechazar', message: `Status ${error?.status ?? '—'} · ${error?.message ?? 'Error desconocido'}` });
    }
  };

  const handleCancelar = async (solicitudId: string) => {
    try {
      await cancelarSolicitudEdicion(solicitudId);
      await cargarSolicitudes();
    } catch (error: any) {
      console.error('Error cancelando solicitud:', error);
      addToast({ type: 'error', title: 'No se pudo cancelar', message: `Status ${error?.status ?? '—'} · ${error?.message ?? 'Error desconocido'}` });
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-semibold">Solicitudes Pendientes</h3>
        <p className="text-sm text-slate-500">Solicitudes relacionadas con este equipo.</p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando solicitudes…</p>
      ) : solicitudes.length === 0 ? (
        <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id} className="flex items-start justify-between p-3 border border-slate-100 rounded-lg">
              <div className="text-sm flex-1">
                <div className="font-medium text-slate-900">{getTipoLabel(solicitud.tipo)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {(() => {
                    const userCreador = usuariosCreadores.get(solicitud.creadoPor);
                    if (userCreador) {
                      return `${userCreador.nombre} (${userCreador.email})`;
                    }
                    return `Usuario ${solicitud.creadoPor.slice(-6)}`;
                  })()} | {(() => {
                    const fecha = (solicitud as any).fechaCreacion || (solicitud as any).createdAt;
                    return fecha ? new Date(fecha).toLocaleString('es-AR') : 'Fecha no disponible';
                  })()}
                </div>
                {solicitud.datosPropuestos && solicitud.tipo === 'jugador-equipo-crear' && (() => {
                  const datos = solicitud.datosPropuestos as unknown as DatosCrearJugadorEquipo;
                  return (
                    <div className="text-xs text-slate-400 mt-1">
                      <div className="text-slate-600">
                        Jugador: {jugadorNombres.get(datos.jugadorId) || 'Cargando…'}
                      </div>
                      Rol: {datos.rol || 'jugador'}
                      {datos.fechaInicio && <><br/>Desde: {new Date(datos.fechaInicio).toLocaleDateString()}</>}
                      {datos.fechaFin && <><br/>Hasta: {new Date(datos.fechaFin).toLocaleDateString()}</>}
                    </div>
                  );
                })()}
              </div>
              <div className="ml-4 flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEstadoColor(solicitud.estado)}`}>
                  Pendiente
                </span>
                {(() => {
                  const creadorIdStr = String(solicitud.creadoPor);
                  const usuarioIdStr = user?.id ? String(user.id) : '';

                  // Determinar admins de jugador para esta solicitud
                  const datos = solicitud.datosPropuestos as any;
                  const jugadorId = datos?.jugadorId as string | undefined;
                  const adminsJugadorParaSolicitud = jugadorId ? (jugadorAdmins.get(jugadorId) || []) : [];

                  const creadorEsEquipo = adminsEquipo.includes(creadorIdStr);
                  const creadorEsJugador = adminsJugadorParaSolicitud.includes(creadorIdStr);
                  const usuarioEsAdminEquipo = usuarioIdStr ? adminsEquipo.includes(usuarioIdStr) : false;
                  const usuarioEsAdminJugador = usuarioIdStr ? adminsJugadorParaSolicitud.includes(usuarioIdStr) : false;
                  const esCreador = usuarioIdStr && creadorIdStr === usuarioIdStr;

                  // Puede cancelar: creador o admins del lado creador (equipo o jugador)
                  const puedeCancelar = Boolean(
                    esCreador ||
                    (creadorEsEquipo && usuarioEsAdminEquipo) ||
                    (creadorEsJugador && usuarioEsAdminJugador)
                  );

                  // Puede aprobar/rechazar: solo la contraparte o admin global
                  let puedeAprobar = user?.rol === 'admin';
                  if (!puedeAprobar) {
                    if (creadorEsEquipo) puedeAprobar = usuarioEsAdminJugador;
                    else if (creadorEsJugador) puedeAprobar = usuarioEsAdminEquipo;
                    else puedeAprobar = usuarioEsAdminEquipo; // fallback
                  }

                  return (
                    <div className="flex gap-1">
                      {puedeCancelar ? (
                        <button
                          onClick={() => handleCancelar(solicitud.id)}
                          className="text-xs bg-slate-500 text-white px-2 py-1 rounded hover:bg-slate-600"
                          title="Cancelar solicitud"
                        >
                          Cancelar
                        </button>
                      ) : puedeAprobar ? (
                        <>
                          <button
                            onClick={() => handleAprobar(solicitud.id)}
                            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                            title="Aprobar solicitud"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleRechazar(solicitud.id)}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            title="Rechazar solicitud"
                          >
                            ✗
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

export default EquipoSolicitudesEdicion;
