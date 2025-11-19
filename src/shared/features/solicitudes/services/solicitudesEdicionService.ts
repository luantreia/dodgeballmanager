import { authFetch } from '../../../../shared/utils/authFetch';
import type {
  ISolicitudEdicion,
  ISolicitudOpciones,
  ISolicitudContexto,
  ISolicitudFiltros,
  ISolicitudCrearPayload,
  ISolicitudActualizarPayload,
  ISolicitudesPaginadas,
  SolicitudEdicionTipo
} from '../types/solicitudesEdicion';
import {
  SolicitudValidationError,
  SolicitudPermissionError,
  SolicitudBusinessError
} from '../types/solicitudesEdicion';

/**
 * Obtiene todas las solicitudes de edición con filtros opcionales
 * @param filtros Parámetros de filtrado y paginación
 * @returns Lista de solicitudes paginada
 */
export const getSolicitudesEdicion = async (
  filtros: ISolicitudFiltros = {}
): Promise<ISolicitudesPaginadas> => {
  const params = new URLSearchParams();

  if (filtros.tipo) params.set('tipo', filtros.tipo);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.creadoPor) params.set('creadoPor', filtros.creadoPor);
  if (filtros.entidad) params.set('entidad', filtros.entidad);
  if (filtros.page) params.set('page', filtros.page.toString());
  if (filtros.limit) params.set('limit', filtros.limit.toString());

  try {
    const arr = await authFetch<ISolicitudEdicion[]>(`/solicitudes-edicion?${params.toString()}`);
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? arr.length;
    return {
      solicitudes: Array.isArray(arr) ? arr : [],
      total: Array.isArray(arr) ? arr.length : 0,
      page,
      limit,
      totalPages: 1,
    };
  } catch (error: any) {
    if (error.status === 400) {
      throw new SolicitudValidationError(error.message, error.details);
    }
    if (error.status === 403) {
      throw new SolicitudPermissionError(error.message);
    }
    throw new Error(`Error al obtener solicitudes: ${error.message}`);
  }
};

/**
 * Obtiene una solicitud de edición por ID
 * @param id ID de la solicitud
 * @returns Detalles de la solicitud
 */
export const getSolicitudEdicionById = async (id: string): Promise<ISolicitudEdicion> => {
  try {
    return await authFetch<ISolicitudEdicion>(`/solicitudes-edicion/${id}`);
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error('Solicitud no encontrada');
    }
    throw new Error(`Error al obtener solicitud: ${error.message}`);
  }
};

/**
 * Obtiene las opciones de solicitudes disponibles para un contexto
 * @param contexto Contexto para obtener las opciones
 * @returns Tipos de solicitudes disponibles con sus metadatos
 */
export const getSolicitudOpciones = async (
  contexto: ISolicitudContexto
): Promise<{
  contexto: string;
  entidadId: string | null;
  tiposDisponibles: ISolicitudOpciones[];
}> => {
  const params = new URLSearchParams();
  params.set('contexto', contexto.contexto);
  if (contexto.entidadId) {
    params.set('entidadId', contexto.entidadId);
  }

  try {
    return await authFetch<{
      contexto: string;
      entidadId: string | null;
      tiposDisponibles: ISolicitudOpciones[];
    }>(`/solicitudes-edicion/opciones?${params.toString()}`);
  } catch (error: any) {
    throw new Error(`Error al obtener opciones de solicitudes: ${error.message}`);
  }
};

/**
 * Crea una nueva solicitud de edición
 * @param payload Datos para crear la solicitud
 * @returns Solicitud creada
 */
export const crearSolicitudEdicion = async (
  payload: ISolicitudCrearPayload
): Promise<ISolicitudEdicion> => {
  try {
    return await authFetch<ISolicitudEdicion>('/solicitudes-edicion', {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    });
  } catch (error: any) {
    if (error.status === 400) {
      throw new SolicitudValidationError(error.message, error.details);
    }
    if (error.status === 409) {
      throw new SolicitudBusinessError(error.message, error.details);
    }
    throw new Error(`Error al crear solicitud: ${error.message}`);
  }
};

/**
 * Actualiza una solicitud de edición (aprobar/rechazar)
 * @param id ID de la solicitud
 * @param payload Datos para actualizar la solicitud
 * @returns Solicitud actualizada
 */
export const actualizarSolicitudEdicion = async (
  id: string,
  payload: ISolicitudActualizarPayload
): Promise<ISolicitudEdicion> => {
  try {
    return await authFetch<ISolicitudEdicion>(`/solicitudes-edicion/${id}`, {
      method: 'PUT',
      body: payload as unknown as Record<string, unknown>,
    });
  } catch (error: any) {
    if (error.status === 400) {
      throw new SolicitudValidationError(error.message, error.details);
    }
    if (error.status === 403) {
      throw new SolicitudPermissionError(error.message);
    }
    if (error.status === 404) {
      throw new Error('Solicitud no encontrada');
    }
    if (error.status === 409) {
      throw new SolicitudBusinessError(error.message, error.details);
    }
    throw new Error(`Error al actualizar solicitud: ${error.message}`);
  }
};

/**
 * Cancela una solicitud de edición
 * @param id ID de la solicitud a cancelar
 * @returns Mensaje de confirmación
 */
export const cancelarSolicitudEdicion = async (id: string): Promise<{ message: string }> => {
  try {
    return await authFetch<{ message: string }>(`/solicitudes-edicion/${id}`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    if (error.status === 403) {
      throw new SolicitudPermissionError(error.message);
    }
    if (error.status === 404) {
      throw new Error('Solicitud no encontrada');
    }
    throw new Error(`Error al cancelar solicitud: ${error.message}`);
  }
};

/**
 * Verifica si un usuario puede crear una solicitud de un tipo específico
 * @param tipo Tipo de solicitud
 * @param contexto Contexto de la solicitud
 * @param entidadId ID de la entidad relacionada
 * @returns Promise<boolean> Indica si el usuario puede crear la solicitud
 */
export const puedeCrearSolicitud = async (
  tipo: string,
  contexto: ISolicitudContexto
): Promise<boolean> => {
  try {
    const opciones = await getSolicitudOpciones(contexto);
    return opciones.tiposDisponibles.some(opt => opt.tipo === tipo);
  } catch (error) {
    console.error('Error verificando permisos para crear solicitud:', error);
    return false;
  }
};

/**
 * Obtiene solicitudes pendientes para un usuario o entidad específica
 * @param filtro Filtros para obtener solicitudes pendientes
 * @returns Lista de solicitudes pendientes
 */
export const getSolicitudesPendientes = async (
  filtro: {
    tipo?: SolicitudEdicionTipo;
    entidad?: string;
    creadoPor?: string;
  } = {}
): Promise<ISolicitudEdicion[]> => {
  const filtros: ISolicitudFiltros = {
    ...filtro,
    estado: 'pendiente',
  };

  const response = await getSolicitudesEdicion(filtros);
  return response.solicitudes;
};

/**
 * Obtiene el conteo de solicitudes pendientes
 * @param filtro Filtros para contar solicitudes
 * @returns Número de solicitudes pendientes
 */
export const contarSolicitudesPendientes = async (
  filtro: {
    tipo?: SolicitudEdicionTipo;
    entidad?: string;
    creadoPor?: string;
  } = {}
): Promise<number> => {
  const filtros: ISolicitudFiltros = {
    ...filtro,
    estado: 'pendiente',
  };
  try {
    const resp = await getSolicitudesEdicion(filtros);
    return resp.solicitudes.length;
  } catch (error: any) {
    throw new Error(`Error al contar solicitudes pendientes: ${error.message}`);
  }
};

/**
 * Obtiene las estadísticas de solicitudes para dashboard
 * @param filtro Filtros para obtener estadísticas
 * @returns Estadísticas de solicitudes
 */
export const getSolicitudesEstadisticas = async (
  filtro: {
    tipo?: string;
    entidad?: string;
    creadoPor?: string;
  } = {}
): Promise<{
  total: number;
  pendientes: number;
  aceptadas: number;
  rechazadas: number;
  canceladas: number;
}> => {
  try {
    const resp = await getSolicitudesEdicion({
      tipo: filtro.tipo as SolicitudEdicionTipo | undefined,
      entidad: filtro.entidad,
      creadoPor: filtro.creadoPor,
    });
    const solicitudes = resp.solicitudes || [];
    const contar = (e: string) => solicitudes.filter(s => s.estado === (e as any)).length;
    return {
      total: solicitudes.length,
      pendientes: contar('pendiente'),
      aceptadas: contar('aceptado'),
      rechazadas: contar('rechazado'),
      canceladas: contar('cancelado'),
    };
  } catch (error: any) {
    throw new Error(`Error al obtener estadísticas de solicitudes: ${error.message}`);
  }
};

/**
 * Alias para compatibilidad con código existente
 * @deprecated Use actualizarSolicitudEdicion instead
 */
export const actualizarSolicitud = actualizarSolicitudEdicion;