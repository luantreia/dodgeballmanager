// Tabla agrupada por categoría de solicitudes

import React from 'react';
import type { SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionesTableProps } from '../types/notificacionesTypes';
import { NotificacionesRow } from './NotificacionesRow';

export const NotificacionesTable: React.FC<NotificacionesTableProps> = ({
  categoria,
  items,
  labelTipo,
  expanded,
  setExpanded,
  rechazoEdit,
  setRechazoEdit,
  accionando,
  onAprobar,
  onRechazar,
  onEditar,
  canApprove,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}) => {
  // Función para toggle expandido
  const handleToggle = (id: string) => {
    const newExpanded = { ...expanded, [id]: !expanded[id] };
    setExpanded(newExpanded);
  };

  const seleccionablesIds = items.filter((s) => s.estado === 'pendiente').map((s) => s._id);
  const todasSeleccionadas = seleccionablesIds.length > 0 && seleccionablesIds.every((id) => selectedIds.has(id));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      {/* Header de la categoría */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{categoria}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {items.length}
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">
                {canApprove && seleccionablesIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={() => onToggleSelectAll(seleccionablesIds)}
                    aria-label={`Seleccionar todas las solicitudes pendientes de ${categoria}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                )}
              </th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((solicitud) => (
              <NotificacionesRow
                key={solicitud._id}
                solicitud={solicitud}
                labelTipo={labelTipo(solicitud.tipo as SolicitudEdicionTipo)}
                expanded={!!expanded[solicitud._id]}
                onToggle={() => handleToggle(solicitud._id)}
                rechazoEdit={rechazoEdit}
                setRechazoEdit={setRechazoEdit}
                accionando={accionando}
                onAprobar={() => onAprobar(solicitud)}
                onRechazar={() => onRechazar(solicitud)}
                onEditar={() => onEditar(solicitud)}
                canApprove={canApprove}
                selected={selectedIds.has(solicitud._id)}
                onToggleSelect={() => onToggleSelect(solicitud._id)}
              />
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            No hay solicitudes en esta categoría
          </div>
        )}
      </div>
    </section>
  );
};
