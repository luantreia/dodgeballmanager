import type { SolicitudEdicionTipo, SolicitudEdicionEstado, ISolicitudEdicion } from '../../solicitudes/types/solicitudesEdicion';

export type EntityType = 'organizacion' | 'equipo' | 'jugador' | 'none';
export type Scope = 'mine' | 'related' | 'aprobables';

export interface NotificacionesPanelProps {
  title: string;
  description?: string;
  allowedTipos: readonly SolicitudEdicionTipo[];
  entityType: EntityType;
  scope?: Scope;
  canApprove: boolean;
  showCategoriaFilter?: boolean;
  showEntidadFilter?: boolean;
}

export interface NotificacionFilterState {
  estado: string;
  categoria: string;
  entidad: string;
  query: string;
  soloMisSolicitudes: boolean;
  autoRefresh: boolean;
}

export interface NotificacionCategoriaConfig {
  categoriasDisponibles: readonly string[];
  categoriaDeTipo: (tipo: SolicitudEdicionTipo) => string;
  labelTipo: (tipo: SolicitudEdicionTipo) => string;
}

export interface UseNotificacionesConfigResult extends NotificacionCategoriaConfig {
  allowedTipos: readonly SolicitudEdicionTipo[];
  canApprove: boolean;
}

export interface AprobarButtonProps {
  solicitud: ISolicitudEdicion;
  accionando: string | null;
  onAprobar: (solicitud: ISolicitudEdicion) => void;
}

export interface NotificacionesFiltersProps {
  filters: NotificacionFilterState;
  onFiltersChange: (filters: NotificacionFilterState) => void;
  categoriasDisponibles: readonly string[];
  showCategoriaFilter?: boolean;
  showEntidadFilter?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
}

export interface NotificacionesTableProps {
  solicitudes: ISolicitudEdicion[];
  loading: boolean;
  error: string | null;
  filters: NotificacionFilterState;
  onFiltersChange: (filters: NotificacionFilterState) => void;
  categoriasDisponibles: readonly string[];
  categoriaDeTipo: (tipo: SolicitudEdicionTipo) => string;
  labelTipo: (tipo: SolicitudEdicionTipo) => string;
  canApprove: boolean;
  showCategoriaFilter?: boolean;
  showEntidadFilter?: boolean;
  onRefresh?: () => void;
  onAprobar: (solicitud: ISolicitudEdicion) => void;
  onRechazar: (solicitud: ISolicitudEdicion) => void;
  onViewDetails: (solicitud: ISolicitudEdicion) => void;
}

export interface NotificacionesRowProps {
  solicitud: ISolicitudEdicion;
  labelTipo: (tipo: SolicitudEdicionTipo) => string;
  canApprove: boolean;
  accionando: string | null;
  isExpanding: boolean;
  onToggleExpand: () => void;
  onAprobar: (solicitud: ISolicitudEdicion) => void;
  onRechazar: (solicitud: ISolicitudEdicion) => void;
  onViewDetails: (solicitud: ISolicitudEdicion) => void;
}

export interface UseNotificacionesDataResult {
  loading: boolean;
  error: string | null;
  solicitudes: ISolicitudEdicion[];
  aprobar: (solicitud: ISolicitudEdicion) => Promise<void>;
  rechazar: (solicitud: ISolicitudEdicion) => Promise<void>;
  refresh: () => void;
}
