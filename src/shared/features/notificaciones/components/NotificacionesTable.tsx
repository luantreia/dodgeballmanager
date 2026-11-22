// Tabla agrupada por categoría de solicitudes

import React from 'react';
import { DataTable } from 'overtime-kit';
import type { SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionesTableProps } from '../types/notificacionesTypes';
import { AccionesSolicitud, DetalleSolicitud, EstadoSolicitud, formatearFechaSolicitud } from './NotificacionesRow';

/**
 * El detalle de cada solicitud se abre con el botón de la primera celda (renderExpanded de
 * DataTable). El checkbox va en la misma celda que el tipo para que también se pueda seleccionar
 * desde las tarjetas de mobile, donde la primera columna es el título de la tarjeta.
 */
export const NotificacionesTable: React.FC<NotificacionesTableProps> = ({
  categoria,
  items,
  labelTipo,
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
  const seleccionablesIds = items.filter((s) => s.estado === 'pendiente').map((s) => s._id);
  const todasSeleccionadas = seleccionablesIds.length > 0 && seleccionablesIds.every((id) => selectedIds.has(id));
  const etiqueta = (s: (typeof items)[number]) => labelTipo(s.tipo as SolicitudEdicionTipo);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      {/* Header de la categoría */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{categoria}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {items.length}
        </span>
      </div>

      <DataTable
        caption={`Solicitudes: ${categoria}`}
        data={items}
        rowKey={(s) => s._id}
        empty="No hay solicitudes en esta categoría"
        pageSize={0}
        renderExpanded={(s) => <DetalleSolicitud solicitud={s} />}
        columns={[
          {
            id: 'tipo',
            header: (
              <span className="inline-flex items-center gap-2">
                {canApprove && seleccionablesIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={() => onToggleSelectAll(seleccionablesIds)}
                    aria-label={`Seleccionar todas las solicitudes pendientes de ${categoria}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                )}
                Tipo
              </span>
            ),
            sortValue: etiqueta,
            cell: (s) => (
              <span className="inline-flex items-center gap-2">
                {canApprove && s.estado === 'pendiente' && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s._id)}
                    onChange={() => onToggleSelect(s._id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Seleccionar solicitud ${etiqueta(s)}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                )}
                <span className="font-medium text-slate-900">{etiqueta(s)}</span>
              </span>
            ),
          },
          { id: 'estado', header: 'Estado', sortValue: (s) => s.estado, cell: (s) => <EstadoSolicitud solicitud={s} /> },
          {
            id: 'fecha',
            header: 'Fecha',
            sortValue: (s) => (s.createdAt ? new Date(s.createdAt) : null),
            cell: (s) => <span className="text-sm text-slate-600">{formatearFechaSolicitud(s.createdAt)}</span>,
          },
          {
            id: 'acciones',
            header: 'Acciones',
            cell: (s) => (
              <AccionesSolicitud
                solicitud={s}
                rechazoEdit={rechazoEdit}
                setRechazoEdit={setRechazoEdit}
                accionando={accionando}
                onAprobar={() => onAprobar(s)}
                onRechazar={() => onRechazar(s)}
                onEditar={() => onEditar(s)}
                canApprove={canApprove}
              />
            ),
          },
        ]}
      />
    </section>
  );
};
