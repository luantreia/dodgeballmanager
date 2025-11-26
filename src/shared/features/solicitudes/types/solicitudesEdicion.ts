export type SolicitudEdicionEstado = 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado';

export type SolicitudEdicionTipo =
  //pagina partido
  | 'resultadoPartido'
  | 'resultadoSet'
  | 'estadisticasJugadorPartido'
  | 'estadisticasJugadorSet'
  | 'estadisticasEquipoPartido'
  | 'estadisticasEquipoSet'
  | 'editarPartidoCompetencia'
  //pagina jugador
  | 'jugador-equipo-crear'
  | 'jugador-equipo-eliminar'
  | 'jugador-equipo-editar'
  | 'contratoEquipoCompetencia'
  | 'solicitarEstadisticasJugador'
  //pagina competencias
  | 'participacion-temporada-crear'
  | 'participacion-temporada-actualizar'
  | 'participacion-temporada-eliminar'
  //pagina competencias/temporada
  | 'jugador-temporada-crear'
  | 'jugador-temporada-actualizar'
  | 'jugador-temporada-eliminar'
  //pagina usuario
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
  datosPropuestos: Record<string, any>;
  estado: SolicitudEdicionEstado;
  aceptadoPor: string[];
  requiereDobleConfirmacion?: boolean;
  motivoRechazo?: string;
  fechaAceptacion?: string;
  fechaRechazo?: string;
  creadoPor: string;
  aprobadoPor?: string;
  createdAt: string;
  updatedAt: string;
}

export type SolicitudEdicion = ISolicitudEdicion & { id: string };

export interface ISolicitudOpciones {
  tipo: SolicitudEdicionTipo;
  titulo: string;
  descripcion: string;
  requiereEntidad: boolean;
  camposRequeridos: string[];
  camposOpcionales?: string[];
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
  // Alcance lógico de las solicitudes solicitadas.
  // 'mine': solo las creadas por el usuario.
  // 'related': creadas por el usuario o donde el usuario puede aprobar.
  // 'aprobables': solo aquellas donde el usuario es aprobador potencial.
  scope?: 'mine' | 'related' | 'aprobables';
  page?: number;
  limit?: number;
}

export interface ISolicitudLoadingState {
  loading: boolean;
  error?: string | null;
  success?: boolean;
}

export interface ISolicitudesPaginadas {
  solicitudes: ISolicitudEdicion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ISolicitudAprobadores {
  aprobadores: {
    administradores: string[];
    organizacion: string[];
    global: string[];
  };
  puedeAprobar: boolean;
}

export interface ISolicitudCrearPayload {
  tipo: SolicitudEdicionTipo;
  entidad?: string;
  datosPropuestos: Record<string, any>;
}

export interface ISolicitudActualizarPayload {
  estado?: 'aceptado' | 'rechazado';
  motivoRechazo?: string;
  datosPropuestos?: Record<string, any>;
}

// Interfaces específicas para datos propuestos
export interface IDatosPropuestosJugadorEquipoCrear {
  jugadorId: string;
  equipoId: string;
  rol?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface IDatosPropuestosJugadorEquipoEliminar {
  contratoId: string;
}

export interface IDatosPropuestosContratoJugadorEquipo {
  rol?: string;
  fechaInicio?: string;
  fechaFin?: string;
  estado?: string;
  foto?: string;
}

export interface IDatosPropuestosParticipacionTemporada {
  equipoId: string;
  temporadaId: string;
  divisionId?: string;
  grupoId?: string;
}

export interface IDatosPropuestosParticipacionTemporadaActualizar {
  divisionId?: string;
  grupoId?: string;
}

export interface IDatosPropuestosParticipacionTemporadaEliminar {
  participacionId: string;
}

export interface IDatosPropuestosJugadorTemporada {
  jugadorId: string;
  temporadaId: string;
  equipoId: string;
  numeroCamiseta?: number;
  posicion?: string;
}

export interface IDatosPropuestosJugadorTemporadaActualizar {
  numeroCamiseta?: number;
  posicion?: string;
}

export interface IDatosPropuestosJugadorTemporadaEliminar {
  jugadorTemporadaId: string;
}

export interface IDatosPropuestosResultadoPartido {
  marcadorLocal?: number;
  marcadorVisitante?: number;
  resultado?: 'local' | 'visitante' | 'empate';
  fecha?: string;
  hora?: string;
  observaciones?: string;
}

export interface IDatosPropuestosResultadoSet {
  setId: string;
  marcadorLocal?: number;
  marcadorVisitante?: number;
  resultado?: 'local' | 'visitante' | 'empate';
}

export interface IDatosPropuestosEstadisticasJugadorPartido {
  jugadorId: string;
  partidoId: string;
  puntos?: number;
  asistencias?: number;
  rebotes?: number;
  robos?: number;
  bloqueos?: number;
  faltas?: number;
}

export interface IDatosPropuestosEstadisticasJugadorSet {
  jugadorId: string;
  setId: string;
  puntos?: number;
  asistencias?: number;
  rebotes?: number;
  robos?: number;
  bloqueos?: number;
  faltas?: number;
}

export interface IDatosPropuestosEstadisticasEquipoPartido {
  equipoId: string;
  partidoId: string;
  puntosTotales?: number;
  rebotesTotales?: number;
}

export interface IDatosPropuestosEstadisticasEquipoSet {
  equipoId: string;
  setId: string;
  puntosTotales?: number;
  rebotesTotales?: number;
}

export interface IDatosPropuestosUsuarioCrearJugador {
  nombre: string;
  apellido: string;
  email: string;
  fechaNacimiento?: string;
  telefono?: string;
  documentoTipo?: string;
  documentoNumero?: string;
}

export interface IDatosPropuestosUsuarioCrearEquipo {
  nombre: string;
  descripcion?: string;
  logo?: string;
  sitioWeb?: string;
  colores?: string[];
  categoria?: string;
  genero?: string;
}

export interface IDatosPropuestosUsuarioCrearOrganizacion {
  nombre: string;
  descripcion?: string;
  logo?: string;
  sitioWeb?: string;
  tipo?: string;
}

export interface IDatosPropuestosUsuarioSolicitarAdmin {
  entidadId: string;
  entidadTipo: 'jugador' | 'equipo' | 'organizacion';
  mensaje?: string;
}

// Clases de error
export class SolicitudValidationError extends Error {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'SolicitudValidationError';
    this.details = details;
  }
}

export class SolicitudPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolicitudPermissionError';
  }
}

export class SolicitudBusinessError extends Error {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'SolicitudBusinessError';
    this.details = details;
  }
}
