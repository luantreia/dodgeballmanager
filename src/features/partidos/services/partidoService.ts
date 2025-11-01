import { authFetch } from '../../../utils/authFetch';
import type { Partido, JugadorPartido, Competencia } from '../../../types';

type PartidoQuery = {
  equipoId: string;
  estado?: 'pendiente' | 'confirmado' | 'finalizado' | 'cancelado';
  competenciaId?: string;
};

type PartidoUpdatePayload = {
  estado?: Partido['estado'] | BackendPartido['estado'];
  escenario?: Partido['escenario'];
  ubicacion?: string;
  fecha?: string;
  hora?: string;
  nombrePartido?: string;
  marcadorLocal?: number;
  marcadorVisitante?: number;
  marcadorModificadoManualmente?: boolean;
  modalidad?: string;
  categoria?: string;
  competencia?: string | BackendCompetencia;
};

type PartidoCreatePayload = {
  equipoId: string;
  rival: string;
  fecha: string;
  hora?: string;
  escenario?: string;
  rivalId: string;
  modalidad: 'Foam' | 'Cloth';
  categoria: 'Masculino' | 'Femenino' | 'Mixto' | 'Libre';
};

type AlineacionPayload = {
  jugadores: Array<{
    jugadorId: string;
    rol: 'jugador' | 'entrenador';
  }>;
};

type AsistenciaPayload = {
  confirmoAsistencia: boolean;
  notas?: string;
};

export type JugadorSimple = {
  _id?: string;
  nombre?: string;
  apellido?: string;
  alias?: string;
  name?: string;
  fullName?: string;
};

export type EquipoReferencia = string | { _id: string };

export interface JugadorPartidoResumen {
  _id: string;
  jugador: JugadorSimple | string;
  equipo: EquipoReferencia;
}

export type JugadorPartidoCreatePayload = {
  partido: string;
  jugador: string;
  equipo: string;
  creadoPor?: string;
};

export type PartidoDetallado = BackendPartido & {
  marcadorModificadoManualmente?: boolean;
  modalidad?: string;
  categoria?: string;
  sets?: SetPartido[];
  modoVisualizacion?: 'automatico' | 'manual';
  modoEstadisticas?: 'automatico' | 'manual';
};

export type SetPartido = {
  _id: string;
  partido: string;
  numeroSet: number;
  estadoSet: 'pendiente' | 'en_juego' | 'finalizado' | string;
  ganadorSet: 'local' | 'visitante' | 'pendiente' | string;
  estadisticas?: unknown;
  creadoPor?: string;
  marcadorLocal?: number;
  marcadorVisitante?: number;
};

export type CrearSetPayload = {
  partido: string;
  numeroSet: number;
  estadoSet?: SetPartido['estadoSet'];
  ganadorSet?: SetPartido['ganadorSet'];
};

export type ActualizarSetPayload = Partial<Omit<SetPartido, '_id' | 'partido' | 'numeroSet'>>;

type BackendCompetencia = {
  _id: string;
  nombre?: string;
};

type BackendEquipoRef = {
  _id: string;
  nombre?: string;
};

export type EquipoRef = BackendEquipoRef | string | null | undefined;

export const extractEquipoId = (equipo?: EquipoRef): string | undefined => {
  if (!equipo) return undefined;
  return typeof equipo === 'string' ? equipo : equipo._id;
};

export const extractEquipoNombre = (equipo?: EquipoRef, fallback: string = 'Equipo'): string => {
  if (!equipo) return fallback;
  if (typeof equipo === 'string') {
    return equipo || fallback;
  }
  return equipo.nombre ?? fallback;
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

export const mapEstadoPartido = (estado?: BackendPartido['estado']): Partido['estado'] => {
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

export const mapEstadoPartidoToBackend = (
  estado?: Partido['estado'] | BackendPartido['estado'],
): BackendPartido['estado'] => {
  switch (estado) {
    case 'pendiente':
    case 'programado':
    case undefined:
      return 'programado';
    case 'confirmado':
    case 'en_juego':
      return 'en_juego';
    case 'finalizado':
      return 'finalizado';
    case 'cancelado':
      return 'cancelado';
    default:
      return 'programado';
  }
};

const mapPartido = (partido: BackendPartido, contextoEquipoId?: string): Partido => {
  const competencia = mapCompetencia(partido.competencia);
  const local = mapEquipoNombre(partido.equipoLocal);
  const visitante = mapEquipoNombre(partido.equipoVisitante);

  const esLocal = contextoEquipoId && local && local.id === contextoEquipoId;
  const esVisitante = contextoEquipoId && visitante && visitante.id === contextoEquipoId;

  const estado = mapEstadoPartido(partido.estado);

  const fechaOriginal = partido.fecha;
  const [fechaISO, horaISO] = fechaOriginal.includes('T') ? fechaOriginal.split('T') : [fechaOriginal, undefined];
  const hora = horaISO ? horaISO.replace('Z', '').slice(0, 5) : undefined;

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
    fecha: fechaISO,
    hora,
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
      equipoLocal: payload.equipoId,
      rival: payload.rival,
      equipoVisitante: payload.rivalId,
      fecha: payload.fecha,
      hora: payload.hora,
      escenario: payload.escenario,
      tipo: 'amistoso',
      modalidad: payload.modalidad,
      categoria: payload.categoria,
    },
  });

  return mapPartido(partido, payload.equipoId);
};

export const actualizarPartido = async (
  partidoId: string,
  payload: PartidoUpdatePayload,
  equipoId?: string
): Promise<Partido> => {
  const body: Record<string, unknown> = { ...payload };

  if (payload.estado !== undefined) {
    body.estado = mapEstadoPartidoToBackend(payload.estado);
  }

  if (payload.escenario !== undefined && payload.ubicacion === undefined) {
    body.ubicacion = payload.escenario;
  }

  delete body.escenario;

  const partido = await authFetch<BackendPartido>(`/partidos/${partidoId}`, {
    method: 'PUT',
    body,
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

export const crearJugadorPartido = (payload: JugadorPartidoCreatePayload) =>
  authFetch<JugadorPartidoResumen>('/jugador-partido', {
    method: 'POST',
    body: payload,
  });

export const eliminarJugadorPartido = (jugadorPartidoId: string) =>
  authFetch<void>(`/jugador-partido/${jugadorPartidoId}`, { method: 'DELETE' });

export const obtenerJugadoresDePartido = (partidoId: string) =>
  authFetch<JugadorPartidoResumen[]>(`/jugador-partido?partido=${partidoId}`);

export const actualizarEstadisticasEquipoPartido = (
  partidoId: string,
  equipoId: string,
  creadoPor: string = 'usuario',
) =>
  authFetch<void>(`/estadisticas/equipo-partido/actualizar`, {
    method: 'POST',
    body: {
      partidoId,
      equipoId,
      creadoPor,
    },
  });

export const getPartidoDetallado = (partidoId: string) =>
  authFetch<PartidoDetallado>(`/partidos/${partidoId}`);

export const obtenerSetsDePartido = (partidoId: string) =>
  authFetch<SetPartido[]>(`/set-partido?partido=${partidoId}`);

export const crearSetPartido = (partidoId: string, payload: Omit<CrearSetPayload, 'partido'>) =>
  authFetch<SetPartido>('/set-partido', {
    method: 'POST',
    body: { ...payload, partido: partidoId },
  });

export const actualizarSetPartido = (setId: string, payload: ActualizarSetPayload) =>
  authFetch<SetPartido>(`/set-partido/${setId}`, {
    method: 'PUT',
    body: payload,
  });

export const eliminarSetPartido = (setId: string) =>
  authFetch<void>(`/set-partido/${setId}`, { method: 'DELETE' });

export const recalcularMarcadorPartido = (partidoId: string) =>
  authFetch<PartidoDetallado>(`/partidos/${partidoId}/recalcular-marcador`, { method: 'PUT' });

export const eliminarPartido = (partidoId: string) =>
  authFetch<{ message: string }>(`/partidos/${partidoId}`, { method: 'DELETE' });

export const actualizarModoEstadisticasPartido = (
  partidoId: string,
  modo: 'manual' | 'automatico',
) =>
  authFetch<PartidoDetallado>(`/partidos/${partidoId}`, {
    method: 'PUT',
    body: { modoEstadisticas: modo },
  });

export const actualizarModoVisualizacionPartido = (
  partidoId: string,
  modo: 'manual' | 'automatico',
) =>
  authFetch<PartidoDetallado>(`/partidos/${partidoId}`, {
    method: 'PUT',
    body: { modoVisualizacion: modo },
  });

export const editarPartido = actualizarPartido;

// --- Estadisticas Jugador Set ---
export type EstadisticasJugadorSet = {
  _id: string;
  set: string;
  jugadorPartido: string;
  jugador: string;
  equipo: string;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
};

export const obtenerEstadisticasJugadorSet = (query: {
  set?: string;
  jugadorPartido?: string;
  jugador?: string;
  equipo?: string;
}) => {
  const params = new URLSearchParams();
  if (query.set) params.set('set', query.set);
  if (query.jugadorPartido) params.set('jugadorPartido', query.jugadorPartido);
  if (query.jugador) params.set('jugador', query.jugador);
  if (query.equipo) params.set('equipo', query.equipo);
  return authFetch<EstadisticasJugadorSet[]>(`/estadisticas/jugador-set?${params.toString()}`);
};

export const crearEstadisticaJugadorSet = (payload: {
  set: string;
  jugadorPartido: string;
  jugador: string;
  equipo: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
}) =>
  authFetch<EstadisticasJugadorSet>(`/estadisticas/jugador-set`, {
    method: 'POST',
    body: payload,
  });

export const actualizarEstadisticaJugadorSet = (
  id: string,
  payload: Partial<Pick<EstadisticasJugadorSet, 'throws' | 'hits' | 'outs' | 'catches'>>,
) =>
  authFetch<EstadisticasJugadorSet>(`/estadisticas/jugador-set/${id}`, {
    method: 'PUT',
    body: payload,
  });

export const eliminarEstadisticaJugadorSet = (id: string) =>
  authFetch<{ mensaje: string }>(`/estadisticas/jugador-set/${id}`, {
    method: 'DELETE',
  });
