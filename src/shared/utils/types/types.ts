import type { PartidoEstado } from '../../types/modelos.generado';

// =====================================================================================
// TYPES CONSOLIDADOS - overtime-gestion-dt
// Ubicación: shared/utils/types/types.ts
// =====================================================================================

// ========================================
// TIPOS GENERALES DE USUARIO Y ENTIDADES
// ========================================

export type RolUsuario = 'lector' | 'editor' | 'admin';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  emailVerificado?: boolean;
}

export interface AdminUser {
  _id: string;
  nombre?: string;
  email?: string;
}

// ========================================
// TIPOS DE EQUIPOS
// ========================================

export interface RedesSociales {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
}

export interface Equipo {
  id: string;
  nombre: string;
  logoUrl?: string;
  staff?: string[];
  descripcion?: string;
  redesSociales?: RedesSociales;
  /** Un equipo sin verificar opera normalmente pero no puede inscribirse a competencias. */
  verificado?: boolean;
}

// ========================================
// TIPOS DE JUGADORES
// ========================================

export type EstadoJugador = 'activo' | 'pendiente' | 'baja';

export interface Jugador {
  id: string;
  nombre: string;
  posicion: string;
  estado: EstadoJugador;
  numeroCamiseta?: number;
  rolEnEquipo?: string;
  rol?: string;
  fechaInicio?: string;
  fechaFin?: string | null;
  contratoId?: string;
  creadoPor?: string;
  administradores?: string[];
  alias?: string;
  fechaNacimiento?: string;
  genero?: string;
  foto?: string;
  nacionalidad?: string;
}

// ========================================
// TIPOS DE SOLICITUDES DE JUGADORES
// ========================================

export interface SolicitudJugador {
  id: string;
  jugador: Jugador;
  estado: 'pendiente' | 'aceptado' | 'rechazado';
  mensaje?: string;
  origen?: 'equipo' | 'jugador';
  fechaSolicitud?: string;
  solicitadoPor?: string;
  equipo?: { id: string; nombre?: string; creadoPor?: string; administradores?: string[] };
  fechaInicio?: string;
  fechaFin?: string | null;
}

export interface ContratoJugadorResumen {
  id: string;
  jugadorNombre: string;
  estado: string;
  rol?: string;
  origen?: 'equipo' | 'jugador';
  fechaInicio?: string;
  fechaFin?: string | null;
  fechaSolicitud?: string;
  fechaAceptacion?: string;
}

// ========================================
// TIPOS DE COMPETENCIAS Y TEMPORADAS
// ========================================

export interface Competencia {
  id: string;
  nombre: string;
  estado: 'activa' | 'finalizada' | 'inscripcion';
  faseActual?: string;
  posicionActual?: number;
}

export interface TemporadaJugador {
  id: string;
  nombre?: string;
  competencia: {
    id?: string;
    nombre?: string;
    modalidad?: string;
    categoria?: string;
  };
  equipo: {
    id?: string;
    nombre?: string;
  };
  fechaInicio?: string;
  fechaFin?: string | null;
  estado?: 'activo' | 'baja' | string;
  rol?: string;
  descripcion?: string;
}

export interface EquipoCompetencia {
  id: string;
  equipo: Equipo;
  competencia: Competencia;
  estado: 'pendiente' | 'aceptado' | 'rechazado';
  fixtureUrl?: string;
}

// ========================================
// TIPOS DE PARTIDOS
// ========================================

/**
 * Ya no es una copia a mano del enum de Mongoose: es el enum de Mongoose.
 *
 * `PartidoEstado` sale de `modelos.generado.ts`, que produce `scripts/generarTipos.js` en el
 * repo del backend leyendo el schema. Antes esto era un espejo escrito a mano, y espejarlo mal
 * es exactamente lo que pasó: aparecieron `'pendiente'`, `'confirmado'`, `'proximamente'` y
 * `'en_curso'`, ninguno de los cuales existe en el modelo. Y el filtro `?estado=` del backend
 * mete el valor tal cual en la query de Mongo, así que un estado inexistente no da error —
 * devuelve 0 resultados y deja una sección de la app vacía sin que nadie se entere.
 *
 * Para agregar un estado: se agrega al schema y se corre `npm run tipos` en el backend.
 */
export type EstadoPartido = PartidoEstado;

export interface Partido {
  id: string;
  /** Fecha local `YYYY-MM-DD`, ya convertida desde el UTC del backend. Para mostrar. */
  fecha: string;
  /** Hora local `HH:mm`. Para mostrar. */
  hora?: string;
  /**
   * El instante original del backend, sin recortar. Para comparar y ordenar: `fecha` sola se
   * parsea como medianoche UTC y hace que el partido de esta tarde quede "en el pasado".
   */
  fechaISO?: string;
  tipoPartido?: 'liga' | 'amistoso';
  rival?: string;
  equipoLocal?: {
    _id: string;
    nombre: string;
    escudo?: string;
  };
  equipoVisitante?: {
    _id: string;
    nombre: string;
    escudo?: string;
  };
  marcadorLocal?: number;
  marcadorVisitante?: number;
  estado: EstadoPartido;
  escenario?: string;
  competencia?: Competencia;
  temporada?: {
    id: string;
    nombre: string;
  };
  fase?: {
    id: string;
    nombre: string;
  };
  resultado?: {
    puntosEquipo: number;
    puntosRival: number;
  };
}

export interface JugadorPartido {
  id: string;
  partidoId: string;
  jugador: Jugador;
  rol: 'jugador' | 'entrenador';
  confirmoAsistencia?: boolean;
  notas?: string;
  equipo?: string | { _id?: string };
  numero?: number;
}

export interface SolicitudCompetencia {
  id: string;
  competencia: Competencia;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fechaSolicitud: string;
}

// ========================================
// TIPOS DE ESTADÍSTICAS
// ========================================

export interface EstadisticaJugador {
  jugador: Jugador;
  partidosJugados: number;
  puntosPromedio: number;
  bloqueosPromedio: number;
  efectividad: number;
  faltasPromedio: number;
}

export interface EstadisticaEquipoResumen {
  racha: Array<'W' | 'D' | 'L'>;
  efectividadEquipo: number;
  puntosPorPartido: number;
  posicionActual?: number;
}

export interface DashboardResumen {
  proximosPartidos: Partido[];
  jugadoresActivos: number;
  solicitudesPendientes: number;
  resumenEquipo?: EstadisticaEquipoResumen;
}

export interface Notificacion {
  id: string;
  tipo: 'jugador' | 'competencia' | 'partido' | 'sistema';
  titulo: string;
  descripcion: string;
  fecha: string;
  leida: boolean;
  relacionadoId?: string;
}
