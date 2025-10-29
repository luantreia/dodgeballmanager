import { authFetch } from '../utils/authFetch';
import type { Partido, JugadorPartido, Competencia } from '../types';

type PartidoQuery = {
  equipoId: string;
  estado?: 'pendiente' | 'confirmado' | 'finalizado' | 'cancelado';
  competenciaId?: string;
};

type PartidoUpdatePayload = Partial<Pick<Partido, 'estado' | 'escenario'>> & {
  fecha?: string;
  hora?: string;
};

type PartidoCreatePayload = {
  equipoId: string;
  rival: string;
  fecha: string;
  hora?: string;
  escenario?: string;
  rivalId?: string;
};

type AlineacionPayload = {
  jugadores: Array<{
    jugadorId: string;
    rol: 'titular' | 'suplente' | 'staff';
  }>;
};

type AsistenciaPayload = {
  confirmoAsistencia: boolean;
  notas?: string;
};

type BackendCompetencia = {
  _id: string;
  nombre?: string;
};

type BackendEquipoRef = {
  _id: string;
  nombre?: string;
};

type BackendPartido = {
  _id: string;
  nombrePartido?: string;
  fecha: string;
  ubicacion?: string;
  competencia?: BackendCompetencia | string;
  equipoLocal?: BackendEquipoRef | string;
  equipoVisitante?: BackendEquipoRef | string;
  marcadorLocal?: number;
  marcadorVisitante?: number;
  estado?: 'programado' | 'en_juego' | 'finalizado' | 'cancelado' | string;
};

const mapCompetencia = (data?: BackendPartido['competencia']): Competencia | undefined => {
  if (!data) return undefined;
  if (typeof data === 'string') {
    return {
      id: data,
      nombre: 'Competencia',
      estado: 'activa',
    };
  }
  return {
    id: data._id,
    nombre: data.nombre ?? 'Competencia',
    estado: 'activa',
  };
};

const mapEquipoNombre = (equipo?: BackendEquipoRef | string): { id: string; nombre: string } | undefined => {
  if (!equipo) return undefined;
  if (typeof equipo === 'string') {
    return { id: equipo, nombre: 'Equipo' };
  }
  return { id: equipo._id, nombre: equipo.nombre ?? 'Equipo' };
};

const mapEstadoPartido = (
  estado?: BackendPartido['estado']
): Partido['estado'] => {
  switch (estado) {
    case 'programado':
      return 'pendiente';
    case 'en_juego':
      return 'confirmado';
    case 'finalizado':
      return 'finalizado';
    case 'cancelado':
      return 'cancelado';
    default:
      return 'pendiente';
  }
};

const mapPartido = (
  partido: BackendPartido,
  contextoEquipoId?: string
): Partido => {
  const competencia = mapCompetencia(partido.competencia);
  const local = mapEquipoNombre(partido.equipoLocal);
  const visitante = mapEquipoNombre(partido.equipoVisitante);

  const esLocal = contextoEquipoId && local && local.id === contextoEquipoId;
  const esVisitante = contextoEquipoId && visitante && visitante.id === contextoEquipoId;

  const estado = mapEstadoPartido(partido.estado);

  let rivalNombre = visitante?.nombre ?? local?.nombre ?? partido.nombrePartido ?? 'Rival';
  if (esLocal && visitante?.nombre) {
    rivalNombre = visitante.nombre;
  } else if (esVisitante && local?.nombre) {
    rivalNombre = local.nombre;
  }

  if (!rivalNombre) {
    rivalNombre = 'Rival';
  }

  const puntosEquipo = esLocal
    ? partido.marcadorLocal ?? 0
    : esVisitante
      ? partido.marcadorVisitante ?? 0
      : partido.marcadorLocal ?? 0;
  const puntosRival = esLocal
    ? partido.marcadorVisitante ?? 0
    : esVisitante
      ? partido.marcadorLocal ?? 0
      : partido.marcadorVisitante ?? 0;

  const mapped: Partido = {
    id: partido._id,
    fecha: partido.fecha,
    rival: rivalNombre,
    estado,
    escenario: partido.ubicacion,
    competencia,
  };

  if (estado === 'finalizado') {
    mapped.resultado = {
      puntosEquipo,
      puntosRival,
    };
  }

  return mapped;
};

export const getPartidos = async ({ equipoId, estado, competenciaId }: PartidoQuery): Promise<Partido[]> => {
  const params = new URLSearchParams();
  if (equipoId) params.set('equipo', equipoId);
  if (estado) params.set('estado', estado);
  if (competenciaId) params.set('competencia', competenciaId);

  const partidos = await authFetch<BackendPartido[]>(`/partidos?${params.toString()}`);
  return partidos.map((partido) => mapPartido(partido, equipoId));
};

export const getPartido = async (partidoId: string, equipoId?: string): Promise<Partido> => {
  const partido = await authFetch<BackendPartido>(`/partidos/${partidoId}`);
  return mapPartido(partido, equipoId);
};

export const crearPartidoAmistoso = async (payload: PartidoCreatePayload): Promise<Partido> => {
  const partido = await authFetch<BackendPartido>('/partidos', {
    method: 'POST',
    body: {
      equipo: payload.equipoId,
      rival: payload.rival,
      equipoVisitante: payload.rivalId,
      fecha: payload.fecha,
      hora: payload.hora,
      escenario: payload.escenario,
      tipo: 'amistoso',
    },
  });

  return mapPartido(partido, payload.equipoId);
};

export const actualizarPartido = async (
  partidoId: string,
  payload: PartidoUpdatePayload,
  equipoId?: string
): Promise<Partido> => {
  const partido = await authFetch<BackendPartido>(`/partidos/${partidoId}`, {
    method: 'PATCH',
    body: payload,
  });

  return mapPartido(partido, equipoId);
};

export const getAlineacion = (partidoId: string) =>
  authFetch<JugadorPartido[]>(`/jugador-partido?partido=${partidoId}`);

export const guardarAlineacion = (partidoId: string, payload: AlineacionPayload) =>
  authFetch<JugadorPartido[]>(`/jugador-partido/${partidoId}`, {
    method: 'PUT',
    body: payload,
  });

export const registrarAsistencia = (jugadorPartidoId: string, payload: AsistenciaPayload) =>
  authFetch<JugadorPartido>(`/jugador-partido/${jugadorPartidoId}/asistencia`, {
    method: 'PATCH',
    body: payload,
  });
