import { authFetch } from '../../../utils/authFetch';
import type { Jugador, SolicitudJugador, ContratoJugadorResumen } from '../../../types';

type JugadorEquipoQuery = {
  equipoId: string;
  estado?: 'activo' | 'pendiente' | 'baja';
};

type InvitacionPayload = {
  jugadorId: string;
  equipoId: string;
  rol?: string;
  numeroCamiseta?: number;
  fechaInicio?: string;
  fechaFin?: string | null;
};

type UpdateEstadoPayload = {
  estado: 'aceptado' | 'rechazado' | 'baja';
  motivoRechazo?: string;
};

type ContratoPayload = {
  rol?: string;
  numeroCamiseta?: number;
  fechaInicio?: string;
  fechaFin?: string | null;
};

type BackendJugador = {
  _id: string;
  nombre?: string;
  posicion?: string;
  alias?: string;
  estado?: string;
  numeroCamiseta?: number;
};

type BackendJugadorEquipo = {
  _id: string;
  jugador: BackendJugador | string;
  equipo: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado' | 'baja';
  rol?: string;
  desde?: string;
  hasta?: string;
  fechaSolicitud?: string;
  origen?: 'equipo' | 'jugador';
  fechaAceptacion?: string;
  createdAt?: string;
  updatedAt?: string;
};

const mapJugador = (relacion: BackendJugadorEquipo): Jugador => {
  const jugadorData = typeof relacion.jugador === 'string' ? { _id: relacion.jugador } : relacion.jugador;

  return {
    id: jugadorData._id,
    nombre: jugadorData.nombre ?? jugadorData.alias ?? 'Jugador',
    posicion: jugadorData.posicion ?? 'Jugador',
    numeroCamiseta: jugadorData.numeroCamiseta,
    estado: relacion.estado === 'aceptado' ? 'activo' : relacion.estado === 'baja' ? 'baja' : 'pendiente',
    rolEnEquipo: relacion.rol,
    rol: relacion.rol,
    fechaInicio: relacion.desde ?? undefined,
    fechaFin: relacion.hasta ?? undefined,
    contratoId: relacion._id,
  };
};

const mapSolicitud = (relacion: BackendJugadorEquipo): SolicitudJugador => ({
  id: relacion._id,
  jugador: mapJugador(relacion),
  estado: relacion.estado === 'aceptado' ? 'aceptado' : relacion.estado === 'rechazado' ? 'rechazado' : 'pendiente',
  mensaje: relacion.origen === 'jugador' ? 'Solicitud enviada por el jugador' : 'Invitación del equipo',
  origen: relacion.origen,
  fechaSolicitud: relacion.fechaSolicitud ?? relacion.createdAt,
});

const mapContratoResumen = (relacion: BackendJugadorEquipo): ContratoJugadorResumen => {
  const jugadorData = typeof relacion.jugador === 'string' ? { _id: relacion.jugador } : relacion.jugador;

  return {
    id: relacion._id,
    jugadorNombre: jugadorData.nombre ?? jugadorData.alias ?? 'Jugador',
    estado: relacion.estado,
    rol: relacion.rol,
    origen: relacion.origen,
    fechaInicio: relacion.desde,
    fechaFin: relacion.hasta ?? null,
    fechaSolicitud: relacion.fechaSolicitud ?? relacion.createdAt,
    fechaAceptacion: relacion.fechaAceptacion ?? undefined,
  };
};

export const getJugadoresEquipo = async ({ equipoId, estado }: JugadorEquipoQuery): Promise<Jugador[]> => {
  const queryEstado = estado ? `&estado=${estado}` : '';
  const relaciones = await authFetch<BackendJugadorEquipo[]>(`/jugador-equipo?equipo=${equipoId}${queryEstado}`);
  return relaciones.filter((relacion) => relacion.estado === 'aceptado').map(mapJugador);
};

export const getSolicitudesJugadores = async (equipoId: string): Promise<SolicitudJugador[]> => {
  const relaciones = await authFetch<BackendJugadorEquipo[]>(`/jugador-equipo?equipo=${equipoId}`);
  return relaciones.filter((relacion) => relacion.estado === 'pendiente').map(mapSolicitud);
};

export const getContratosNoActivos = async (equipoId: string): Promise<ContratoJugadorResumen[]> => {
  const relaciones = await authFetch<BackendJugadorEquipo[]>(`/jugador-equipo?equipo=${equipoId}`);
  return relaciones.filter((relacion) => relacion.estado !== 'aceptado').map(mapContratoResumen);
};

export const getHistorialSolicitudesJugadorEquipo = async (
  equipoId: string
): Promise<ContratoJugadorResumen[]> => {
  const relaciones = await authFetch<BackendJugadorEquipo[]>(`/jugador-equipo?equipo=${equipoId}`);
  return relaciones
    .map(mapContratoResumen)
    .sort((a, b) => {
      const fechaA = a.fechaAceptacion ?? a.fechaSolicitud ?? '';
      const fechaB = b.fechaAceptacion ?? b.fechaSolicitud ?? '';
      return new Date(fechaB).getTime() - new Date(fechaA).getTime();
    });
};

export const invitarJugador = (payload: InvitacionPayload) =>
  authFetch<SolicitudJugador>('/jugador-equipo/solicitar-equipo', {
    method: 'POST',
    body: {
      jugador: payload.jugadorId,
      equipo: payload.equipoId,
      rol: payload.rol,
      numeroCamiseta: payload.numeroCamiseta,
      desde: payload.fechaInicio,
      hasta: payload.fechaFin,
    },
  });

export const actualizarEstadoJugador = (contratoId: string, payload: UpdateEstadoPayload) =>
  authFetch(`/jugador-equipo/${contratoId}`, {
    method: 'PUT',
    body: payload,
  });

export const actualizarContratoJugador = (contratoId: string, payload: ContratoPayload) =>
  authFetch(`/jugador-equipo/${contratoId}`, {
    method: 'PUT',
    body: payload,
  });
