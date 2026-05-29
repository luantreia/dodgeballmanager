import React, { useState, useMemo, useCallback } from 'react';
import type { ISolicitudEdicion } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionFilterState } from '../types/notificacionesTypes';
import { useNotificacionesData } from '../hooks/useNotificacionesData';
import { NotificacionesFilters } from './NotificacionesFilters';
import { NotificacionesTable } from './NotificacionesTable';

interface NotificacionesPanelProps {
  title: string;
  description?: string;
  allowedTipos: readonly string[];
  entityType: string;
  scope?: string;
  canApprove: boolean;
  showCategoriaFilter?: boolean;
  showEntidadFilter?: boolean;
}

export const NotificacionesPanel: React.FC<NotificacionesPanelProps> = ({
  title,
  description,
}) => {
  const [filters, setFilters] = useState<NotificacionFilterState>({
    estado: 'pendiente',
    categoria: '',
    entidad: '',
    query: '',
    soloMisSolicitudes: false,
    autoRefresh: true,
  });

  const { loading, error, solicitudes, aprobar, rechazar, refresh } = useNotificacionesData({
    scope: 'aprobables',
  });

  const handleViewDetails = useCallback((solicitud: ISolicitudEdicion) => {
    console.log('View details:', solicitud._id);
  }, []);

  // Simple config for dt
  const categoriaDeTipo = (tipo: string): string => {
    if (tipo.includes('resultado') || tipo.includes('Partido')) return 'Partidos';
    if (tipo.includes('estadistica')) return 'Estadísticas';
    if (tipo.includes('jugador-equipo')) return 'Equipos';
    return 'Otros';
  };

  const labelTipo = (tipo: string): string => {
    return tipo.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const categoriasDisponibles = ['Partidos', 'Estadísticas', 'Equipos', 'Otros'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>

      <NotificacionesFilters
        filters={filters}
        onFiltersChange={setFilters}
        categoriasDisponibles={categoriasDisponibles}
        showCategoriaFilter={true}
        showEntidadFilter={false}
        onRefresh={refresh}
        loading={loading}
      />

      <NotificacionesTable
        solicitudes={solicitudes}
        loading={loading}
        error={error}
        filters={filters}
        onFiltersChange={setFilters}
        categoriasDisponibles={categoriasDisponibles}
        categoriaDeTipo={categoriaDeTipo}
        labelTipo={labelTipo}
        canApprove={true}
        showCategoriaFilter={true}
        showEntidadFilter={false}
        onRefresh={refresh}
        onAprobar={aprobar}
        onRechazar={rechazar}
        onViewDetails={handleViewDetails}
      />
    </div>
  );
};
