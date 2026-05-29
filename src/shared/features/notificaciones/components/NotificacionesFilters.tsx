import React from 'react';
import type { NotificacionesFiltersProps } from '../types/notificacionesTypes';

export const NotificacionesFilters: React.FC<NotificacionesFiltersProps> = ({
  filters,
  onFiltersChange,
  categoriasDisponibles,
  showCategoriaFilter = true,
  showEntidadFilter = false,
  onRefresh,
  loading = false,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <select
        value={filters.estado}
        onChange={(e) => onFiltersChange({ ...filters, estado: e.target.value })}
        className="rounded-lg border-slate-300 text-sm"
      >
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendientes</option>
        <option value="aceptada">Aprobadas</option>
        <option value="rechazada">Rechazadas</option>
      </select>

      {showCategoriaFilter && (
        <select
          value={filters.categoria}
          onChange={(e) => onFiltersChange({ ...filters, categoria: e.target.value })}
          className="rounded-lg border-slate-300 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      )}

      {showEntidadFilter && (
        <select
          value={filters.entidad}
          onChange={(e) => onFiltersChange({ ...filters, entidad: e.target.value })}
          className="rounded-lg border-slate-300 text-sm"
        >
          <option value="">Todas las entidades</option>
          <option value="organizacion">Organizaciones</option>
          <option value="equipo">Equipos</option>
          <option value="jugador">Jugadores</option>
        </select>
      )}

      <input
        type="text"
        value={filters.query}
        onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
        placeholder="Buscar..."
        className="flex-1 min-w-[200px] rounded-lg border-slate-300 text-sm"
      />

      <button
        onClick={onRefresh}
        disabled={loading}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? 'Actualizando...' : 'Actualizar'}
      </button>

      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.soloMisSolicitudes}
          onChange={(e) => onFiltersChange({ ...filters, soloMisSolicitudes: e.target.checked })}
          className="rounded border-slate-300"
        />
        Solo mías
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.autoRefresh}
          onChange={(e) => onFiltersChange({ ...filters, autoRefresh: e.target.checked })}
          className="rounded border-slate-300"
        />
        Auto-refresh
      </label>
    </div>
  );
};
