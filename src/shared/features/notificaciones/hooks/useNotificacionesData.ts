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
}: UseNotificacionesDataProps = {}): UseNotificacionesDataResult => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<ISolicitudEdicion[]>([]);

  const fetchSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: Record<string, string> = {
        estado: 'pendiente',
        ...(scope ? { scope } : {}),
      };

      const response = await getSolicitudesEdicion(filters as any);
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
  }, [scope, allowedTipos]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  useEffect(() => {
    const interval = setInterval(fetchSolicitudes, 30000);
    return () => clearInterval(interval);
  }, [fetchSolicitudes]);

  const aprobar = useCallback(async (solicitud: ISolicitudEdicion) => {
    try {
      await aprobarSolicitud(solicitud._id);
      await fetchSolicitudes();
    } catch (err: any) {
      throw new Error(`Error al aprobar: ${err.message}`);
    }
  }, [fetchSolicitudes]);

  const rechazar = useCallback(async (solicitud: ISolicitudEdicion) => {
    try {
      await rechazarSolicitud(solicitud._id);
      await fetchSolicitudes();
    } catch (err: any) {
      throw new Error(`Error al rechazar: ${err.message}`);
    }
  }, [fetchSolicitudes]);

  const refresh = useCallback(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  return {
    loading,
    error,
    solicitudes,
    aprobar,
    rechazar,
    refresh,
  };
};
