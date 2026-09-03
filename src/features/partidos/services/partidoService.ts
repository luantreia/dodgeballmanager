import { authFetch } from '../../../shared/utils/authFetch';
import type { Partido, EstadoPartido, JugadorPartido, Competencia } from '../../../shared/utils/types/types';
import { toLocalDatePart, toLocalTimePart } from '../../../shared/utils/formatDate';

type PartidoQuery = {
  equipoId: string;
  tipo?: 'todos' | 'competencia' | 'amistoso';
  estado?: EstadoPartido | EstadoPartido[];
  competenciaId?: string;
  temporadaId?: string;
  faseId?: string;
  /**
   * El backend pagina con un default de 20 (`overtime/src/utils/pagination.js`) ordenando por
   * fecha descendente. Sin mandar `limit` un equipo con historial perdía los partidos viejos
   * en silencio: no aparecían, y tampoco había ningún "cargar más" que los trajera.
   */
  limit?: number;
  page?: number;
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

type BackendTemporada = {
  _id: string;
  nombre?: string;
};

type BackendFase = {
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
  temporada?: BackendTemporada | string;
  fase?: BackendFase | string;
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

const ESTADOS_PARTIDO: readonly EstadoPartido[] = ['programado', 'en_juego', 'finalizado', 'cancelado'];

/**
 * Antes había dos funciones que traducían de ida y de vuelta entre el enum real de Mongoose y
 * un vocabulario inventado en el front (`'pendiente'`, `'confirmado'`). Esa capa existía sólo
 * para sostener la invención y era una trampa: cualquiera que llamara al backend sin pasar por
 * ella filtraba por un estado inexistente y recibía 0 resultados sin error. Ahora el front
 * habla el mismo idioma que el modelo y esto sólo normaliza datos viejos o inesperados.
 */
export const normalizarEstadoPartido = (estado?: string | null): EstadoPartido => {
  if (estado && (ESTADOS_PARTIDO as readonly string[]).includes(estado)) {
    return estado as EstadoPartido;
  }
  // Valores heredados de versiones anteriores del front.
  if (estado === 'pendiente' || estado === 'proximamente') return 'programado';
  if (estado === 'confirmado' || estado === 'en_curso') return 'en_juego';
  return 'programado';
};

const mapPartido = (partido: BackendPartido, contextoEquipoId?: string): Partido => {
  const competencia = mapCompetencia(partido.competencia);
  const local = mapEquipoNombre(partido.equipoLocal);
  const visitante = mapEquipoNombre(partido.equipoVisitante);

  const esLocal = contextoEquipoId && local && local.id === contextoEquipoId;
  const esVisitante = contextoEquipoId && visitante && visitante.id === contextoEquipoId;

  const estado = normalizarEstadoPartido(partido.estado);

  // Partir el ISO en la 'T' devuelve el día y la hora EN UTC. En Argentina (UTC-3) eso mostraba
  // todos los partidos 3 horas más tarde, y los nocturnos directamente al día siguiente: un
  // partido del viernes 21:00 figuraba como sábado 00:00. Hay que convertir a hora local.
  const fechaOriginal = partido.fecha;
  const fecha = toLocalDatePart(fechaOriginal);
  const hora = toLocalTimePart(fechaOriginal);

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
    fecha,
    hora,
    fechaISO: fechaOriginal,
    tipoPartido: competencia ? 'liga' : 'amistoso',
    rival: rivalNombre,
    estado,
    escenario: partido.ubicacion,
    competencia,
    temporada:
      partido.temporada
        ? {
            id: typeof partido.temporada === 'string' ? partido.temporada : partido.temporada._id,
            nombre: typeof partido.temporada === 'string' ? 'Temporada' : partido.temporada.nombre ?? 'Temporada',
          }
        : undefined,
    fase:
      partido.fase
        ? {
            id: typeof partido.fase === 'string' ? partido.fase : partido.fase._id,
            nombre: typeof partido.fase === 'string' ? 'Fase' : partido.fase.nombre ?? 'Fase',
          }
        : undefined,
    equipoLocal: local ? { _id: local.id, nombre: local.nombre } : undefined,
    equipoVisitante: visitante ? { _id: visitante.id, nombre: visitante.nombre } : undefined,
    marcadorLocal: partido.marcadorLocal,
    marcadorVisitante: partido.marcadorVisitante,
  };

  if (
    estado === 'finalizado' ||
    (typeof partido.marcadorLocal === 'number' && typeof partido.marcadorVisitante === 'number')
  ) {
    mapped.resultado = {
      puntosEquipo,
      puntosRival,
    };
  }

  return mapped;
};

/** Tope del backend (`getPaginationParams`). Pedimos todo el historial del equipo de una. */
const LIMITE_MAXIMO_PARTIDOS = 1000;

export const getPartidos = async ({
  equipoId,
  estado,
  competenciaId,
  temporadaId,
  faseId,
  tipo = 'todos',
  limit = LIMITE_MAXIMO_PARTIDOS,
  page,
}: PartidoQuery): Promise<Partido[]> => {
  const params = new URLSearchParams();
  if (equipoId) params.set('equipo', equipoId);
  // La ruta acepta el parámetro repetido para filtrar por varios estados a la vez.
  if (Array.isArray(estado)) estado.forEach((valor) => params.append('estado', valor));
  else if (estado) params.set('estado', estado);
  if (competenciaId) params.set('competencia', competenciaId);
  if (temporadaId) params.set('temporadaId', temporadaId);
  if (faseId) params.set('fase', faseId);
  if (tipo === 'amistoso') params.set('tipo', 'amistoso');
  params.set('limit', String(Math.min(limit, LIMITE_MAXIMO_PARTIDOS)));
  if (page) params.set('page', String(page));

  const response = await authFetch<BackendPartido[] | { items?: BackendPartido[] }>(`/partidos?${params.toString()}`);
  const partidosRaw = Array.isArray(response) ? response : (response?.items || []);
  let partidos = partidosRaw.map((partido) => mapPartido(partido, equipoId));

  if (tipo === 'competencia') {
    partidos = partidos.filter((partido) => Boolean(partido.competencia?.id));
  }

  return partidos;
};

export type TemporadaOption = { _id: string; nombre?: string };
export type FaseOption = { _id: string; nombre?: string };

export const getTemporadasByCompetencia = (competenciaId: string) =>
  authFetch<TemporadaOption[]>(`/temporadas?competencia=${competenciaId}`);

export const getFasesByTemporada = (temporadaId: string) =>
  authFetch<FaseOption[]>(`/fases?temporada=${temporadaId}`);

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
    body.estado = normalizarEstadoPartido(payload.estado);
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

export type PermisosPartido = {
  partidoId: string;
  esCompetencia: boolean;
  canManageLineup: boolean;
  canManageSets: boolean;
  canSetResultado: boolean;
  /**
   * `stats.capture` se evalúa por equipo, así que viene uno por lado. Un DT normalmente puede
   * cargar las estadísticas de su plantel y no las del rival: la grilla del lado que no puede
   * escribir tiene que quedar fuera de la pantalla, no fallar recién al guardar.
   */
  canCaptureStatsLocal: boolean;
  canCaptureStatsVisitante: boolean;
};

/**
 * Qué puede hacer el usuario sobre ESTE partido. Es una capa distinta de los
 * permisos de equipo: en un partido de competencia, la alineación y los sets son
 * del organizador o de quien tenga una asignación vigente, aunque seas admin de
 * uno de los equipos que juegan.
 */
export const getMisPermisosPartido = (partidoId: string) =>
  authFetch<PermisosPartido>(`/partidos/${partidoId}/mis-permisos`);

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

/** De dónde salió la lista de elegibles. Espeja el servicio del backend. */
export type OrigenElegibles = 'partido' | 'temporada' | 'equipo' | 'ninguno';

export interface JugadorElegible {
  jugadorId: string;
  /** Null cuando todavía no existe la convocatoria oficial del partido. */
  jugadorPartidoId: string | null;
  nombre: string;
  numero?: number;
  genero: string | null;
}

export interface JugadoresElegibles {
  origen: OrigenElegibles;
  /** 'Masculino' | 'Femenino' | 'Mixto' | 'Libre', o null en amistosos. */
  categoria: string | null;
  jugadores: JugadorElegible[];
  excluidos: { porFecha: number; porCategoria: number };
}

/**
 * Quiénes pueden aparecer en la captura de este partido.
 *
 * Resuelto por cascada en el backend: convocatoria del partido → lista de buena fe de
 * la temporada → plantel vigente A LA FECHA DEL PARTIDO. Usar esto en vez del plantel
 * crudo es lo que evita ofrecer contratos de años anteriores en un partido reciente.
 */
export const obtenerJugadoresElegibles = (partidoId: string, equipoId: string) =>
  authFetch<JugadoresElegibles>(
    `/partidos/${partidoId}/jugadores-elegibles?equipo=${encodeURIComponent(equipoId)}`,
  );

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
  survive?: boolean;
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

/**
 * Visibilidad que se le pide a una estadística al guardarla.
 * En un partido de competencia dispara la aprobación del organizador; en un
 * amistoso se aplica directo, porque el equipo es la única autoridad.
 */
export type VisibilidadEstadistica = 'organizacion' | 'publica';

export const crearEstadisticaJugadorSet = (payload: {
  set: string;
  jugadorPartido: string;
  jugador: string;
  equipo: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  survive?: boolean;
  visibilidadObjetivo?: VisibilidadEstadistica;
}) =>
  authFetch<EstadisticasJugadorSet>(`/estadisticas/jugador-set`, {
    method: 'POST',
    body: payload,
  });

export const actualizarEstadisticaJugadorSet = (
  id: string,
  payload: Partial<Pick<EstadisticasJugadorSet, 'throws' | 'hits' | 'outs' | 'catches' | 'survive'>> & {
    visibilidadObjetivo?: VisibilidadEstadistica;
  },
) =>
  authFetch<EstadisticasJugadorSet>(`/estadisticas/jugador-set/${id}`, {
    method: 'PUT',
    body: payload,
  });

export const eliminarEstadisticaJugadorSet = (id: string) =>
  authFetch<{ mensaje: string }>(`/estadisticas/jugador-set/${id}`, {
    method: 'DELETE',
  });
