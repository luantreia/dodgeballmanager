import React, { useReducer, useContext, createContext, useEffect, useCallback, useMemo } from 'react';
import {
  ISolicitudEdicion,
  ISolicitudContexto,
  ISolicitudCrearPayload,
  ISolicitudActualizarPayload,
  ISolicitudFiltros,
  SolicitudEdicionEstado,
  ISolicitudesPaginadas,
} from '../types/solicitudesEdicion';
import { ISolicitudOpciones, ISolicitudLoadingState } from '../types/solicitudesEdicion';
import {
  getSolicitudesEdicion,
  getSolicitudEdicionById,
  getSolicitudOpciones,
  crearSolicitudEdicion,
  actualizarSolicitudEdicion,
  cancelarSolicitudEdicion,
  getSolicitudesPendientes,
  contarSolicitudesPendientes,
} from '../index';

/**
 * Estado de la solicitud actual siendo editada/visualizada
 */
interface SolicitudActual {
  id?: string;
  contexto?: ISolicitudContexto;
  opciones?: ISolicitudOpciones[];
  loadingState?: ISolicitudLoadingState;
}

/**
 * Estado global de solicitudes
 */
interface SolicitudesContextState {
  // Listado
  solicitudes: ISolicitudEdicion[];
  total: number;
  loading: boolean;
  error: string | null;

  // Paginación
  currentPage: number;
  pageSize: number;

  // Filtros
  filtros: ISolicitudFiltros;

  // Solicitud actual
  solicitudActual: SolicitudActual;

  // Estados de carga específicos
  creandoSolicitud: boolean;
  aprobandoSolicitud: boolean;
  cancelandoSolicitud: boolean;

  // Contador de solicitudes pendientes
  pendientesCount: number;
}

type SolicitudesAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SOLICITUDES'; payload: { solicitudes: ISolicitudEdicion[]; total: number } }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_FILTROS'; payload: Partial<ISolicitudFiltros> }
  | { type: 'SET_SOLICITUD_ACTUAL'; payload: SolicitudActual }
  | { type: 'SET_OPCIONES_SOLICITUD'; payload: ISolicitudOpciones[] }
  | { type: 'SET_CREANDO_SOLICITUD'; payload: boolean }
  | { type: 'SET_APROBANDO_SOLICITUD'; payload: boolean }
  | { type: 'SET_CANCELANDO_SOLICITUD'; payload: boolean }
  | { type: 'SET_PENDIENTES_COUNT'; payload: number }
  | { type: 'AGREGAR_SOLICITUD'; payload: ISolicitudEdicion }
  | { type: 'ACTUALIZAR_SOLICITUD'; payload: ISolicitudEdicion }
  | { type: 'RESET_ESTADO' };

interface SolicitudesContextValue {
  // Estado
  solicitudes: ISolicitudEdicion[];
  total: number;
  loading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  filtros: ISolicitudFiltros;
  solicitudActual: SolicitudActual;
  creandoSolicitud: boolean;
  aprobandoSolicitud: boolean;
  cancelandoSolicitud: boolean;
  pendientesCount: number;

  // Acciones
  cargarSolicitudes: (filtros?: ISolicitudFiltros, page?: number) => Promise<void>;
  cargarOpciones: (contexto: ISolicitudContexto) => Promise<void>;
  crearSolicitud: (payload: ISolicitudCrearPayload) => Promise<ISolicitudEdicion>;
  aprobarSolicitud: (id: string, payload: ISolicitudActualizarPayload) => Promise<void>;
  rechazarSolicitud: (id: string, motivoRechazo: string) => Promise<void>;
  cancelarSolicitud: (id: string) => Promise<void>;
  establecerContextoActual: (contexto: ISolicitudContexto) => void;
  limpiarError: () => void;
  resetearEstado: () => void;
  actualizarPagina: (page: number) => void;
}

const initialState: SolicitudesContextState = {
  solicitudes: [],
  total: 0,
  loading: false,
  error: null,
  currentPage: 1,
  pageSize: 10,
  filtros: {},
  solicitudActual: {},
  creandoSolicitud: false,
  aprobandoSolicitud: false,
  cancelandoSolicitud: false,
  pendientesCount: 0,
};

const solicitudesReducer = (state: SolicitudesContextState, action: SolicitudesAction): SolicitudesContextState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_SOLICITUDES':
      return {
        ...state,
        solicitudes: Array.isArray(action.payload.solicitudes) ? action.payload.solicitudes : [],
        total: action.payload.total,
        loading: false,
        error: null,
      };

    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };

    case 'SET_FILTROS':
      return {
        ...state,
        filtros: { ...state.filtros, ...action.payload },
        currentPage: 1, // Reset a primera página cuando cambian filtros
      };

    case 'SET_SOLICITUD_ACTUAL':
      return { ...state, solicitudActual: action.payload };

    case 'SET_OPCIONES_SOLICITUD':
      return {
        ...state,
        solicitudActual: {
          ...state.solicitudActual,
          opciones: action.payload,
        },
      };

    case 'SET_CREANDO_SOLICITUD':
      return { ...state, creandoSolicitud: action.payload };

    case 'SET_APROBANDO_SOLICITUD':
      return { ...state, aprobandoSolicitud: action.payload };

    case 'SET_CANCELANDO_SOLICITUD':
      return { ...state, cancelandoSolicitud: action.payload };

    case 'SET_PENDIENTES_COUNT':
      return { ...state, pendientesCount: action.payload };

    case 'AGREGAR_SOLICITUD':
      return {
        ...state,
        solicitudes: [action.payload, ...(Array.isArray(state.solicitudes) ? state.solicitudes : [])],
        total: state.total + 1,
      };

    case 'ACTUALIZAR_SOLICITUD':
      return {
        ...state,
        solicitudes: (Array.isArray(state.solicitudes) ? state.solicitudes : []).map(s =>
          s._id === action.payload._id ? action.payload : s
        ),
      };

    case 'RESET_ESTADO':
      return initialState;

    default:
      return state;
  }
};

const SolicitudesContext = createContext<SolicitudesContextValue | null>(null);

interface SolicitudesProviderProps {
  children: React.ReactNode;
}

export const SolicitudesProvider: React.FC<SolicitudesProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(solicitudesReducer, initialState);

  /**
   * Cargar solicitudes con filtros
   */
  const cargarSolicitudes = useCallback(
    async (filtros: ISolicitudFiltros = {}, page: number = 1) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const response = await getSolicitudesEdicion({
          ...filtros,
          page,
          limit: state.pageSize,
        });
        dispatch({
          type: 'SET_SOLICITUDES',
          payload: {
            solicitudes: response.solicitudes,
            total: response.total,
          },
        });
        dispatch({ type: 'SET_CURRENT_PAGE', payload: page });
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Error al cargar solicitudes',
        });
      }
    },
    [state.pageSize]
  );

  /**
   * Cargar opciones disponibles para un contexto
   */
  const cargarOpciones = useCallback(async (contexto: ISolicitudContexto) => {
    try {
      const response = await getSolicitudOpciones(contexto);
      dispatch({ type: 'SET_OPCIONES_SOLICITUD', payload: response.tiposDisponibles });
      dispatch({
        type: 'SET_SOLICITUD_ACTUAL',
        payload: {
          contexto,
          opciones: response.tiposDisponibles,
        },
      });
    } catch (error: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.message || 'Error al cargar opciones',
      });
    }
  }, []);

  /**
   * Crear nueva solicitud
   */
  const crearSolicitud = useCallback(
    async (payload: ISolicitudCrearPayload): Promise<ISolicitudEdicion> => {
      dispatch({ type: 'SET_CREANDO_SOLICITUD', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        const response = await crearSolicitudEdicion(payload);
        dispatch({ type: 'AGREGAR_SOLICITUD', payload: response });
        dispatch({ type: 'SET_CREANDO_SOLICITUD', payload: false });
        return response;
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Error al crear solicitud',
        });
        dispatch({ type: 'SET_CREANDO_SOLICITUD', payload: false });
        throw error;
      }
    },
    []
  );

  /**
   * Aprobar solicitud
   */
  const aprobarSolicitud = useCallback(
    async (id: string, payload: ISolicitudActualizarPayload) => {
      dispatch({ type: 'SET_APROBANDO_SOLICITUD', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        const response = await actualizarSolicitudEdicion(id, {
          ...payload,
          estado: 'aceptado',
        });
        dispatch({ type: 'ACTUALIZAR_SOLICITUD', payload: response });
        dispatch({ type: 'SET_APROBANDO_SOLICITUD', payload: false });

        // Actualizar contador de pendientes
        const nuevoPendiente = await contarSolicitudesPendientes();
        dispatch({ type: 'SET_PENDIENTES_COUNT', payload: nuevoPendiente });
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Error al aprobar solicitud',
        });
        dispatch({ type: 'SET_APROBANDO_SOLICITUD', payload: false });
        throw error;
      }
    },
    []
  );

  /**
   * Rechazar solicitud
   */
  const rechazarSolicitud = useCallback(
    async (id: string, motivoRechazo: string) => {
      dispatch({ type: 'SET_APROBANDO_SOLICITUD', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        const response = await actualizarSolicitudEdicion(id, {
          estado: 'rechazado',
          motivoRechazo,
        });
        dispatch({ type: 'ACTUALIZAR_SOLICITUD', payload: response });
        dispatch({ type: 'SET_APROBANDO_SOLICITUD', payload: false });
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Error al rechazar solicitud',
        });
        dispatch({ type: 'SET_APROBANDO_SOLICITUD', payload: false });
        throw error;
      }
    },
    []
  );

  /**
   * Cancelar solicitud
   */
  const cancelarSolicitud = useCallback(async (id: string) => {
    dispatch({ type: 'SET_CANCELANDO_SOLICITUD', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await cancelarSolicitudEdicion(id);
      // Recargar la solicitud para obtener el estado actualizado
      const solicitudActualizada = await getSolicitudEdicionById(id);
      dispatch({ type: 'ACTUALIZAR_SOLICITUD', payload: solicitudActualizada });
      dispatch({ type: 'SET_CANCELANDO_SOLICITUD', payload: false });
    } catch (error: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.message || 'Error al cancelar solicitud',
      });
      dispatch({ type: 'SET_CANCELANDO_SOLICITUD', payload: false });
      throw error;
    }
  }, []);

  /**
   * Establecer contexto actual
   */
  const establecerContextoActual = useCallback((contexto: ISolicitudContexto) => {
    dispatch({ type: 'SET_SOLICITUD_ACTUAL', payload: { contexto } });
  }, []);

  /**
   * Limpiar error
   */
  const limpiarError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  /**
   * Resetear estado completo
   */
  const resetearEstado = useCallback(() => {
    dispatch({ type: 'RESET_ESTADO' });
  }, []);

  /**
   * Actualizar página
   */
  const actualizarPagina = useCallback(
    (page: number) => {
      dispatch({ type: 'SET_CURRENT_PAGE', payload: page });
      cargarSolicitudes(state.filtros, page);
    },
    [state.filtros, cargarSolicitudes]
  );

  /**
   * Cargar contador de pendientes al montar
   */
  useEffect(() => {
    const cargarPendientes = async () => {
      try {
        const count = await contarSolicitudesPendientes();
        dispatch({ type: 'SET_PENDIENTES_COUNT', payload: count });
      } catch (error) {
        console.error('Error al cargar pendientes:', error);
      }
    };
    cargarPendientes();
  }, []);

  const value: SolicitudesContextValue = useMemo(
    () => ({
      solicitudes: state.solicitudes,
      total: state.total,
      loading: state.loading,
      error: state.error,
      currentPage: state.currentPage,
      pageSize: state.pageSize,
      filtros: state.filtros,
      solicitudActual: state.solicitudActual,
      creandoSolicitud: state.creandoSolicitud,
      aprobandoSolicitud: state.aprobandoSolicitud,
      cancelandoSolicitud: state.cancelandoSolicitud,
      pendientesCount: state.pendientesCount,
      cargarSolicitudes,
      cargarOpciones,
      crearSolicitud,
      aprobarSolicitud,
      rechazarSolicitud,
      cancelarSolicitud,
      establecerContextoActual,
      limpiarError,
      resetearEstado,
      actualizarPagina,
    }),
    [
      state,
      cargarSolicitudes,
      cargarOpciones,
      crearSolicitud,
      aprobarSolicitud,
      rechazarSolicitud,
      cancelarSolicitud,
      establecerContextoActual,
      limpiarError,
      resetearEstado,
      actualizarPagina,
    ]
  );

  return (
    <SolicitudesContext.Provider value={value}>
      {children}
    </SolicitudesContext.Provider>
  );
};

/**
 * Hook para usar el contexto de solicitudes
 */
export const useSolicitudes = (): SolicitudesContextValue => {
  const context = useContext(SolicitudesContext);
  if (!context) {
    throw new Error('useSolicitudes debe ser utilizado dentro de SolicitudesProvider');
  }
  return context;
};

export default SolicitudesContext;
