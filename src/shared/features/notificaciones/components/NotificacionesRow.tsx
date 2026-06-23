import React from 'react';
import type { SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionesRowProps } from '../types/notificacionesTypes';
import { AprobarButton } from './AprobarButton';

const estadoColors: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  aceptada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
  cancelada: 'bg-gray-100 text-gray-800',
};

export const NotificacionesRow: React.FC<NotificacionesRowProps> = ({
  solicitud,
  labelTipo,
  canApprove,
  accionando,
  isExpanding,
  onToggleExpand,
  onAprobar,
  onRechazar,
  onViewDetails,
}) => {
  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const estadoBadge = () => {
    const colorClass = estadoColors[solicitud.estado] || 'bg-gray-100 text-gray-800';
    const label = solicitud.estado.charAt(0).toUpperCase() + solicitud.estado.slice(1);
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="px-3 py-3">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-slate-600"
          >
            <span className={`transform transition-transform ${isExpanding ? 'rotate-90' : ''}`}>
              ▶
            </span>
            {labelTipo(solicitud.tipo as SolicitudEdicionTipo)}
          </button>
        </td>
        <td className="px-3 py-3">
          {estadoBadge()}
        </td>
        <td className="px-3 py-3 text-sm text-slate-600">
          {formatDate(solicitud.createdAt)}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {canApprove && (
              <AprobarButton
                solicitud={solicitud}
                accionando={accionando}
                onAprobar={onAprobar}
              />
            )}
            {canApprove && (
              <button
                onClick={() => onRechazar(solicitud)}
                disabled={!!accionando}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accionando === `${solicitud._id}-rechazar` ? 'Rechazando...' : 'Rechazar'}
              </button>
            )}
            <button
              onClick={() => onViewDetails(solicitud)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              Ver Detalles
            </button>
          </div>
        </td>
      </tr>
      {isExpanding && (
        <tr className="border-t border-slate-100 bg-slate-50/50">
          <td colSpan={4} className="px-3 py-4">
            <div className="rounded-lg bg-white p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Datos Propuestos:</h4>
              <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">
                {JSON.stringify(solicitud.datosPropuestos, null, 2)}
              </pre>
              {solicitud.motivoRechazo && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-red-700 mb-1">Motivo de Rechazo:</h4>
                  <p className="text-sm text-red-600">{solicitud.motivoRechazo}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
