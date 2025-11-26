import { useState } from 'react';
import { crearSolicitudEdicion } from '../../../shared/features/solicitudes/services/solicitudesEdicionService';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

interface SolicitudPartidoData {
  campo: 'ubicacion' | 'fecha' | 'hora' | 'marcadorLocal' | 'marcadorVisitante' | 'estado' | 'setGanador';
  valorPropuesto: any;
  razon: string;
}

export const useSolicitudEditarPartido = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const solicitarCambio = async (partidoId: string, data: SolicitudPartidoData) => {
    try {
      setLoading(true);
      await crearSolicitudEdicion({
        tipo: 'editarPartidoCompetencia',
        entidad: partidoId,
        datosPropuestos: {
          campo: data.campo,
          valorPropuesto: data.valorPropuesto,
          razon: data.razon,
        },
      });
      addToast({
        type: 'success',
        title: 'Solicitud creada',
        message: 'Tu solicitud ha sido enviada para aprobación',
      });
      return true;
    } catch (error: any) {
      console.error('Error al crear solicitud:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error?.message || 'No pudimos crear la solicitud',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { solicitarCambio, loading };
};
