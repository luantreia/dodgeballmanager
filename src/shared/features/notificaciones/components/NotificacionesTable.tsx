import React, { useMemo, useState } from 'react';
import type { ISolicitudEdicion, SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionesTableProps } from '../types/notificacionesTypes';
import { NotificacionesRow } from './NotificacionesRow';

export const NotificacionesTable: React.FC<NotificacionesTableProps> = ({
  solicitudes,
  loading,
  error,
  filters,
  onFiltersChange,
  categoriasDisponibles,
  categoriaDeTipo,
  labelTipo,
  canApprove,
  showCategoriaFilter = true,
  showEntidadFilter = false,
  onRefresh,
  onAprobar,
  onRechazar,
  onViewDetails,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((s) => {
      if (filters.estado && s.estado !== filters.estado) {
        return false;
      }
      if (filters.categoria) {
        const cat = categoriaDeTipo(s.tipo as SolicitudEdicionTipo);
        if (cat !== filters.categoria) {
          return false;
        }
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const matchTipo = labelTipo(s.tipo as SolicitudEdicionTipo).toLowerCase().includes(q);
        const matchEstado = s.estado.toLowerCase().includes(q);
        if (!matchTipo && !matchEstado) {
          return false;
        }
      }
      return true;
    });
  }, [solicitudes, filters, categoriaDeTipo, labelTipo]);

  const groupedByCategoria = useMemo(() => {
    const grupos: Record<string, ISolicitudEdicion[]> = {};
    for (const s of filteredSolicitudes) {
      const cat = categoriaDeTipo(s.tipo as SolicitudEdicionTipo);
      if (!grupos[cat]) {
        grupos[cat] = [];
      }
      grupos[cat].push(s);
    }
    return grupos;
  }, [filteredSolicitudes, categoriaDeTipo]);

  const toggleExpand = (id: string) => {
    const newExpanded = { ...expanded, [id]: !expanded[id] };
    setExpanded(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (filteredSolicitudes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">No hay solicitudes pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedByCategoria).map(([categoria, items]) => (
        <section key={categoria} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{categoria}</h3>
            <p className="text-sm text-slate-500">{items.length} solicitud(es)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500">
                  <th className="pb-3">Tipo</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3">Fecha</th>
                  <th className="pb-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((solicitud) => (
                  <NotificacionesRow
                    key={solicitud._id}
                    solicitud={solicitud}
                    labelTipo={labelTipo}
                    canApprove={canApprove}
                    accionando={null}
                    isExpanding={!!expanded[solicitud._id]}
                    onToggleExpand={() => toggleExpand(solicitud._id)}
                    onAprobar={onAprobar}
                    onRechazar={onRechazar}
                    onViewDetails={onViewDetails}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};
