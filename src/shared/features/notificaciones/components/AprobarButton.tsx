import React, { useEffect, useState } from 'react';
import type { ISolicitudEdicion } from '../../solicitudes/types/solicitudesEdicion';
import { getSolicitudAprobadores } from '../../solicitudes/services/solicitudesEdicionService';
import type { AprobarButtonProps } from '../types/notificacionesTypes';

export const AprobarButton: React.FC<AprobarButtonProps> = ({
  solicitud,
  accionando,
  onAprobar,
}) => {
  const [puedeAprobar, setPuedeAprobar] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        const aprobadores = await getSolicitudAprobadores(solicitud._id);
        setPuedeAprobar(aprobadores.puedeAprobar);
      } catch (err) {
        console.error('Error verificando aprobadores:', err);
        setPuedeAprobar(false);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [solicitud._id]);

  const handleClick = () => {
    if (!accionando) {
      onAprobar(solicitud);
    }
  };

  if (!puedeAprobar) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      disabled={!!accionando}
      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {cargando ? 'Verificando...' : accionando === solicitud._id ? 'Aprobando...' : 'Aprobar'}
    </button>
  );
};
