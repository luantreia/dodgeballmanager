// Botón de aprobar con verificación de permisos

import React, { useEffect, useState } from 'react';
import { getSolicitudAprobadores } from '../../solicitudes/services/solicitudesEdicionService';
import { useToast } from '../../../components/Toast/ToastProvider';
import type { ISolicitudEdicion } from '../../solicitudes/types/solicitudesEdicion';

interface AprobarButtonProps {
  solicitud: ISolicitudEdicion;
  accionando: string | null;
  onAprobar: () => void;
  disabled?: boolean;
}

export const AprobarButton: React.FC<AprobarButtonProps> = ({
  solicitud,
  accionando,
  onAprobar,
  disabled = false,
}) => {
  const { addToast } = useToast();
  const [puedeAprobar, setPodeAprobar] = useState<boolean | null>(null);
  const [loadingAprobadores, setLoadingAprobadores] = useState(false);

  // Verificar si el usuario puede aprobar esta solicitud
  useEffect(() => {
    // Si no está pendiente, no puede aprobar
    if (solicitud.estado !== 'pendiente') {
      setPodeAprobar(false);
      return;
    }

    let mounted = true;

    const cargar = async () => {
      setLoadingAprobadores(true);
      try {
        const res = await getSolicitudAprobadores(solicitud._id);
        if (mounted) setPodeAprobar(res.puedeAprobar);
      } catch {
        if (mounted) setPodeAprobar(false);
      } finally {
        if (mounted) setLoadingAprobadores(false);
      }
    };

    void cargar();

    return () => { mounted = false; };
  }, [solicitud._id, solicitud.estado]);

  const handleClick = () => {
    if (puedeAprobar === false) {
      addToast({
        type: 'info',
        title: 'No autorizado',
        message: 'No estás habilitado para aprobar esta solicitud.'
      });
      return;
    }
    onAprobar();
  };

  const isDisabled = disabled || accionando === solicitud._id || solicitud.estado !== 'pendiente' || loadingAprobadores;

  return (
    <button
      disabled={isDisabled}
      onClick={handleClick}
      className={`rounded px-3 py-1 text-xs font-semibold text-white transition-colors ${
        puedeAprobar === false
          ? 'bg-slate-400 cursor-not-allowed'
          : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
      }`}
      title={puedeAprobar === false ? 'No podes aprobar esta solicitud' : 'Aprobar solicitud'}
    >
      {loadingAprobadores ? '...' : 'Aprobar'}
    </button>
  );
};

export default AprobarButton;
