import { useState, useEffect, useCallback } from 'react';
import type { ISolicitudEdicion, SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';
import { getSolicitudesEdicion } from '../../solicitudes/services/solicitudesEdicionService';
import type { UseNotificacionesDataResult } from '../types/notificacionesTypes';
import type { Scope } from '../types/notificacionesTypes';

interface UseNotificacionesDataProps {
  scope?: Scope;
  allowedTipos?: readonly SolicitudEdicionTipo[];
  entityType?: string;
}

const aprobarSolicitud = async (id: string): Promise<ISolicitudEdicion> => {
  const { actualizarSolicitudEdicion } = await import('../../solicitudes/services/solicitudesEdicionService');
  return actualizarSolicitudEdicion(id, { estado: 'aceptado' });
};

const rechazarSolicitud = async (id: string): Promise<ISolicitudEdicion> => {
  const { actualizarSolicitudEdicion } = await import('../../solicitudes/services/solicitudesEdicionService');
  return actualizarSolicitudEdicion(id, { estado: 'rechazado' });
};

export const useNotificacionesData = ({
  scope = 'aprobables',
  allowedTipos,
  entityType,
}: UseNotificacionesDataProps = {}): UseNotificacionesDataResult => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<ISolicitudEdicion[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters: Record<string, string> = {
        estado: 'pendiente',
      };
      
      const response = await getSolicitudesEdicion(filters);
      let filteredSolicitudes = response.solicitudes;
      
      if (allowedTipos && allowedTipos.length > 0) {
        filteredSolicitudes = filteredSolicitudes.filter(s => 
          allowedTipos.includes(s.tipo as SolicitudEdicionTipo)
        );
      }
      
      setSolicitudes(filteredSolicitudes);
    } catch (err: any) {
      setError(err.message || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, [scope, allowedTipos, entityType, refreshTrigger]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const aprobar = useCallback(async (solicitud: ISolicitudEdicion) => {
    try {
      await aprobarSolicitud(solicitud._id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      throw new Error(`Error al aprobar: ${err.message}`);
    }
  }, []);

  const rechazar = useCallback(async (solicitud: ISolicitudEdicion) => {
    try {
      await rechazarSolicitud(solicitud._id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      throw new Error(`Error al rechazar: ${err.message}`);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return {
    loading,
    error,
    solicitudes,
    aprobar,
    rechazar,
    refresh,
  };
};
