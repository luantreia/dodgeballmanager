// Tipos para solicitudes de edición basados en el modelo Mongodb y solicitudesMeta.js

export type SolicitudEdicionEstado = 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado';

export type SolicitudEdicionTipo = 
  | 'resultadoPartido'
  | 'resultadoSet'
  | 'estadisticasJugadorPartido'
  | 'estadisticasJugadorSet'
  | 'estadisticasEquipoPartido'
  | 'estadisticasEquipoSet'
  | 'jugador-equipo-editar'
  | 'contratoEquipoCompetencia'
  | 'jugador-equipo-crear'
  | 'jugador-equipo-eliminar'
  | 'participacion-temporada-crear'
  | 'participacion-temporada-actualizar'
  | 'participacion-temporada-eliminar'
  | 'jugador-temporada-crear'
  | 'jugador-temporada-actualizar'
  | 'jugador-temporada-eliminar'
  | 'usuario-crear-jugador'
  | 'usuario-crear-equipo'
  | 'usuario-crear-organizacion'
  | 'usuario-solicitar-admin-jugador'
  | 'usuario-solicitar-admin-equipo'
  | 'usuario-solicitar-admin-organizacion';

export interface ISolicitudEdicion {
  _id: string;
  tipo: SolicitudEdicionTipo;
  entidad?: string | null;
  datosPropuestos: Record<string, unknown>;
  estado: SolicitudEdicionEstado;
  aceptadoPor: string[];
  requiereDobleConfirmacion: boolean;
  motivoRechazo?: string;
  fechaAceptacion?: string;
  fechaRechazo?: string;
  creadoPor: string;
  aprobadoPor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISolicitudOpciones {
  tipo: SolicitudEdicionTipo;
  meta: {
    requiereDobleConfirmacion: boolean;
    camposCriticos: string[];
    rolesAprobadores: string[];
    camposPermitidosSinConsenso?: string[];
  };
}

export interface ISolicitudContexto {
  contexto: 'usuario' | 'jugador' | 'equipo' | 'organizacion' | 'competencia' | 'temporada' | 'fase' | 'partido';
  entidadId?: string;
}

export interface ISolicitudFiltros {
  tipo?: SolicitudEdicionTipo;
  estado?: SolicitudEdicionEstado;
  creadoPor?: string;
  entidad?: string;
  page?: number;
  limit?: number;
}

export interface ISolicitudCrearPayload {
  tipo: SolicitudEdicionTipo;
  entidad?: string;
  datosPropuestos: Record<string, unknown>;
}

export interface ISolicitudActualizarPayload {
  estado: 'aceptado' | 'rechazado';
  motivoRechazo?: string;
  datosPropuestos?: Record<string, unknown>;
}

// Tipos específicos para datosPropuestos según el tipo de solicitud
export interface IDatosPropuestosJugadorEquipoCrear {
  jugadorId: string;
  equipoId: string;
  rol?: string;
  numeroCamiseta?: number;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface IDatosPropuestosJugadorEquipoEliminar {
  contratoId: string;
}

export interface IDatosPropuestosContratoJugadorEquipo {
  rol?: string;
  numeroCamiseta?: number;
  desde?: string;
  hasta?: string;
  estado?: string;
  foto?: string;
}

export interface IDatosPropuestosParticipacionTemporada {
  equipoId: string;
  temporadaId: string;
  estado?: string;
  observaciones?: string;
}

export interface IDatosPropuestosParticipacionTemporadaActualizar {
  participacionTemporadaId: string;
  estado?: string;
  observations?: string;
}

export interface IDatosPropuestosParticipacionTemporadaEliminar {
  participacionTemporadaId: string;
}

export interface IDatosPropuestosJugadorTemporada {
  jugadorEquipoId: string;
  participacionTemporadaId: string;
  estado?: string;
  rol?: string;
}

export interface IDatosPropuestosJugadorTemporadaActualizar {
  jugadorTemporadaId: string;
  estado?: string;
  rol?: string;
}

export interface IDatosPropuestosJugadorTemporadaEliminar {
  jugadorTemporadaId: string;
}

export interface IDatosPropuestosResultadoPartido {
  marcadorLocal?: number;
  marcadorVisitante?: number;
  sets?: Array<{
    numeroSet: number;
    ganadorSet: 'local' | 'visitante' | 'pendiente';
    puntosLocal?: number;
    puntosVisitante?: number;
  }>;
}

export interface IDatosPropuestosResultadoSet {
  setNumero: number;
  ganadorSet: 'local' | 'visitante';
  puntosLocal?: number;
  puntosVisitante?: number;
}

export interface IDatosPropuestosEstadisticasJugadorPartido {
  jugadorPartidoId: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  // ... más estadísticas específicas
}

export interface IDatosPropuestosEstadisticasJugadorSet {
  jugadorSetId: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  // ... más estadísticas específicas
}

export interface IDatosPropuestosEstadisticasEquipoPartido {
  equipoPartidoId: string;
  // ... estadísticas del equipo en el partido
}

export interface IDatosPropuestosEstadisticasEquipoSet {
  equipoSetId: string;
  // ... estadísticas del equipo en el set
}

export interface IDatosPropuestosUsuarioCrearJugador {
  nombre: string;
  alias?: string;
  fechaNacimiento: string;
  genero?: string;
  foto?: string;
  nacionalidad?: string;
}

export interface IDatosPropuestosUsuarioCrearEquipo {
  nombre: string;
  escudo?: string;
  foto?: string;
  colores?: string;
  tipo?: string;
  pais?: string;
  descripcion?: string;
  sitioWeb?: string;
}

export interface IDatosPropuestosUsuarioCrearOrganizacion {
  nombre: string;
  descripcion?: string;
  logo?: string;
  sitioWeb?: string;
}

export interface IDatosPropuestosUsuarioSolicitarAdmin {
  jugadorId?: string;
  equipoId?: string;
  organizacionId?: string;
}

// Errores específicos para solicitudes de edición
export class SolicitudEdicionError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SolicitudEdicionError';
  }
}

export class SolicitudValidationError extends SolicitudEdicionError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'SolicitudValidationError';
  }
}

export class SolicitudPermissionError extends SolicitudEdicionError {
  constructor(message: string) {
    super(message, 403, 'PERMISSION_ERROR');
    this.name = 'SolicitudPermissionError';
  }
}

export class SolicitudBusinessError extends SolicitudEdicionError {
  constructor(message: string, details?: any) {
    super(message, 409, 'BUSINESS_ERROR', details);
    this.name = 'SolicitudBusinessError';
  }
}

// Estado de carga para solicitudes
export interface ISolicitudLoadingState {
  loading: boolean;
  error?: string | null;
  success?: boolean;
}

// Respuesta paginada de solicitudes
export interface ISolicitudesPaginadas {
  solicitudes: ISolicitudEdicion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}