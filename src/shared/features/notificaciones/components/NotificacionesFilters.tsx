// Barra de filtros para el panel de notificaciones

import React from 'react';
import type { SolicitudEdicionEstado } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionesFiltersProps } from '../types/notificacionesTypes';

export const NotificacionesFilters: React.FC<NotificacionesFiltersProps> = ({
  // Estados
  fEstado,
  setFEstado,
  fCategoria,
  setFCategoria,
  q,
  setQ,
  fMostrarSoloMias,
  setFMostrarSoloMias,
  autoRefresh,
  setAutoRefresh,

  // Opciones
  showCategoriaFilter = true,
  showEntidadFilter = false,
  showSoloMiasFilter = true,
  entidadesDisponibles = [],
  entidadSeleccionada = 'todas',
  onEntidadChange,

  // Categorías
  categorias = [],

  // Actions
  onReload,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Estado */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Estado:</label>
        <select
          value={fEstado}
          onChange={(e) => setFEstado(e.target.value as SolicitudEdicionEstado | 'todos')}
          className="rounded-lg border-slate-300 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="aceptado">Aceptado</option>
          <option value="rechazado">Rechazado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Categoría */}
      {showCategoriaFilter && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Categoría:</label>
          <select
            value={fCategoria}
            onChange={(e) => setFCategoria(e.target.value)}
            className="rounded-lg border-slate-300 text-sm"
          >
            <option value="Todas">Todas</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      )}

      {/* Entidad (para jugadores/equipos) */}
      {showEntidadFilter && entidadesDisponibles.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Filtrar:</label>
          <select
            value={entidadSeleccionada}
            onChange={(e) => onEntidadChange?.(e.target.value)}
            className="rounded-lg border-slate-300 text-sm"
          >
            <option value="todas">Todos</option>
            {entidadesDisponibles.map((ent) => (
              <option key={ent.id} value={ent.id}>{ent.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Búsqueda */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="w-48 rounded-lg border-slate-300 text-sm"
        />
      </div>

      {/* Solo mías */}
      {showSoloMiasFilter && (
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={fMostrarSoloMias}
            onChange={(e) => setFMostrarSoloMias(e.target.checked)}
          />
          Solo mías
        </label>
      )}

      {/* Auto-refresh */}
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
        />
        Auto 30s
      </label>

      {/* Recargar */}
      <button
        onClick={() => void onReload()}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Recargar
      </button>
    </div>
  );
};

export default NotificacionesFilters;
