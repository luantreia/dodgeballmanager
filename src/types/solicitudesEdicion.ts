// Copia de los tipos de solicitudes de edición (compatibilidad entre apps)

export type SolicitudEdicionEstado = 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado';

export type SolicitudEdicionTipo =
  // página partido
  | 'resultadoPartido'
  | 'resultadoSet'
  | 'estadisticasJugadorSet'

  // página jugador
  | 'jugador-equipo-editar'
  | 'jugador-equipo-crear'

  // página competencias
  | 'participacion-temporada-crear'
  | 'participacion-temporada-actualizar'
  | 'participacion-temporada-eliminar'

  // página competencias/temporada
  | 'jugador-temporada-crear'
  | 'jugador-temporada-actualizar'
  | 'jugador-temporada-eliminar'

  // página usuario
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
