// Tipos para el componente unificado de Notificaciones
import type { SolicitudEdicionTipo, SolicitudEdicionEstado, ISolicitudEdicion } from '../../solicitudes/types/solicitudesEdicion';

// Tipo de entidad para filtrado
export type EntityType = 'organizacion' | 'equipo' | 'jugador' | 'none';

// Scope de las solicitudes
export type Scope = 'mine' | 'related' | 'aprobables';

// Props principales del componente NotificacionesPanel
export interface NotificacionesPanelProps {
  // Configuración general
  title: string;
  description?: string;

  // Filtro de tipos de solicitudes (solo estos tipos se mostrarán)
  allowedTipos: readonly SolicitudEdicionTipo[];

  // Configuración de contexto
  entityType: EntityType;
  scope?: Scope;

  // Permisos - si false, solo puede ver (no aprobar/rechazar)
  canApprove: boolean;

  // Filtros adicionales
  showTipoFilter?: boolean;        // Mostrar filtro por tipo específico
  showCategoriaFilter?: boolean;    // Mostrar filtro por categoría
  showEntidadFilter?: boolean;     // Mostrar selector de entidad (para jugadores/equipos)

  // Callbacks
  onSolicitudUpdate?: (s: ISolicitudEdicion) => void;
  onSolicitudCreate?: (s: ISolicitudEdicion) => void;
}

// Estado de filtros de la UI
export interface NotificacionFilterState {
  estado: SolicitudEdicionEstado | 'todos';
  categoria: string;
  tipo: SolicitudEdicionTipo | 'todos';
  query: string;
  soloMias: boolean;
  entidad: string;
  autoRefresh: boolean;
}

// Configuración de categoría
export interface NotificacionCategoriaConfig {
  label: string;
  tipos: readonly SolicitudEdicionTipo[];
}

// Resultado del hook de configuración
export interface UseNotificacionesConfigResult {
  // Context de entidad
  entidadId: string | null;
  entidadNombre: string;
  entidadesDisponibles: Array<{ id: string; nombre: string }>;

  // Filtros activos
  allowedTipos: readonly SolicitudEdicionTipo[];
  scope: Scope;

  // Permisos
  canApprove: boolean;

  // Funciones de categorización
  categoriaDeTipo: (tipo: SolicitudEdicionTipo) => string;
  labelTipo: (tipo: SolicitudEdicionTipo) => string;

  // Categorías disponibles para el frontend actual
  categoriasDisponibles: readonly NotificacionCategoriaConfig[];
}

// Props para AprobarButton
export interface AprobarButtonProps {
  solicitud: ISolicitudEdicion;
  accionando: string | null;
  onAprobar: () => void;
  disabled?: boolean;
}

// Props para NotificacionesFilters
export interface NotificacionesFiltersProps {
  // Estados
  fEstado: SolicitudEdicionEstado | 'todos';
  setFEstado: (v: SolicitudEdicionEstado | 'todos') => void;
  fCategoria: string;
  setFCategoria: (v: string) => void;
  q: string;
  setQ: (v: string) => void;
  fMostrarSoloMias: boolean;
  setFMostrarSoloMias: (v: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;

  // Opciones
  showCategoriaFilter?: boolean;
  showEntidadFilter?: boolean;
  showSoloMiasFilter?: boolean;
  entidadesDisponibles?: Array<{ id: string; nombre: string }>;
  entidadSeleccionada?: string;
  onEntidadChange?: (v: string) => void;

  // Categorías
  categorias: string[];

  // Actions
  onReload: () => void;
}

// Props para NotificacionesTable
export interface NotificacionesTableProps {
  categoria: string;
  items: ISolicitudEdicion[];
  labelTipo: (tipo: SolicitudEdicionTipo) => string;
  expanded: Record<string, boolean>;
  setExpanded: (v: Record<string, boolean>) => void;
  rechazoEdit: { id: string; motivo: string } | null;
  setRechazoEdit: (v: { id: string; motivo: string } | null) => void;
  accionando: string | null;
  onAprobar: (s: ISolicitudEdicion) => void;
  onRechazar: (s: ISolicitudEdicion) => void;
  onEditar: (s: ISolicitudEdicion) => void;
  canApprove: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
}

// Props para NotificacionesRow
export interface NotificacionesRowProps {
  solicitud: ISolicitudEdicion;
  labelTipo: string;
  expanded: boolean;
  onToggle: () => void;
  rechazoEdit: { id: string; motivo: string } | null;
  setRechazoEdit: (v: { id: string; motivo: string } | null) => void;
  accionando: string | null;
  onAprobar: () => void;
  onRechazar: () => void;
  onEditar: () => void;
  canApprove: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}
