// Fila individual de solicitud expandible

import React from 'react';
import type { NotificacionesRowProps } from '../types/notificacionesTypes';
import { AprobarButton } from './AprobarButton';

// Maps raw datosPropuestos keys to Spanish labels
const FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre', apellido: 'Apellido', email: 'Email',
  rol: 'Rol', numeroCamiseta: 'Número', posicion: 'Posición',
  equipoNombre: 'Equipo', jugadorNombre: 'Jugador',
  temporadaNombre: 'Temporada', competenciaNombre: 'Competencia',
  equipoId: 'Equipo (ID)', jugadorId: 'Jugador (ID)',
  temporadaId: 'Temporada (ID)', competenciaId: 'Competencia (ID)',
  faseId: 'Fase (ID)', partidoId: 'Partido (ID)',
  contratoId: 'Contrato (ID)', participacionId: 'Participación (ID)',
  jugadorTemporadaId: 'JugadorTemporada (ID)',
  divisionId: 'División', grupoId: 'Grupo',
  fechaInicio: 'Desde', fechaFin: 'Hasta', fecha: 'Fecha', hora: 'Hora',
  marcadorLocal: 'Local', marcadorVisitante: 'Visitante', resultado: 'Resultado',
  estado: 'Estado', mensaje: 'Mensaje', entidadTipo: 'Tipo entidad', entidadId: 'Entidad (ID)',
  descripcion: 'Descripción', sitioWeb: 'Sitio web', telefono: 'Teléfono',
  documentoTipo: 'Documento tipo', documentoNumero: 'Documento nro',
  fechaNacimiento: 'Nacimiento', puntos: 'Puntos', asistencias: 'Asistencias',
  rebotes: 'Rebotes', robos: 'Robos', bloqueos: 'Bloqueos', faltas: 'Faltas',
  observaciones: 'Observaciones',
};

// ID fields that should be hidden when a matching *Nombre field exists
const REDUNDANT_ID_KEYS = new Set(['equipoId', 'jugadorId', 'temporadaId', 'competenciaId']);

function renderDatos(datos: Record<string, any>) {
  const keys = Object.keys(datos).filter(k => {
    // Skip internal/noise keys
    if (k === '__v' || k === '_id') return false;
    // Skip raw ID if we have a name for it
    if (REDUNDANT_ID_KEYS.has(k)) {
      const nameKey = k.replace('Id', 'Nombre');
      if (datos[nameKey]) return false;
    }
    return true;
  });

  if (keys.length === 0) return <span className="text-slate-400 text-xs">Sin datos adicionales</span>;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
      {keys.map(k => {
        const raw = datos[k];
        let value: string;
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'boolean') value = raw ? 'Sí' : 'No';
        else if (typeof raw === 'object') value = JSON.stringify(raw);
        else {
          const s = String(raw);
          // Pretty-print ISO dates
          value = /^\d{4}-\d{2}-\d{2}T/.test(s)
            ? new Date(s).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
            : s;
        }
        return (
          <div key={k}>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {FIELD_LABELS[k] ?? k}
            </dt>
            <dd className="text-sm text-slate-800 truncate" title={value}>{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export const NotificacionesRow: React.FC<NotificacionesRowProps> = ({
  solicitud,
  labelTipo,
  expanded,
  onToggle,
  rechazoEdit,
  setRechazoEdit,
  accionando,
  onAprobar,
  onRechazar,
  onEditar,
  canApprove,
  selected,
  onToggleSelect,
}) => {
  const isRechazando = rechazoEdit?.id === solicitud._id;
  const isAccionando = accionando === solicitud._id;
  const isSelectable = canApprove && solicitud.estado === 'pendiente';

  // Formatear fecha
  const formatDate = (date: string | Date) => {
    try {
      return new Date(date).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  // Badge de estado con colores
  const estadoBadge = () => {
    const baseClasses = 'rounded px-2 py-0.5 text-xs font-medium';
    switch (solicitud.estado) {
      case 'pendiente':
        return <span className={`${baseClasses} bg-amber-100 text-amber-800`}>Pendiente</span>;
      case 'aceptado':
        return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>Aceptado</span>;
      case 'rechazado':
        return <span className={`${baseClasses} bg-rose-100 text-rose-800`}>Rechazado</span>;
      case 'cancelado':
        return <span className={`${baseClasses} bg-slate-100 text-slate-700`}>Cancelado</span>;
      default:
        return <span className={`${baseClasses} bg-slate-100 text-slate-700`}>{solicitud.estado}</span>;
    }
  };

  return (
    <>
      <tr className="border-t border-slate-100">
        {/* Selección */}
        <td className="px-3 py-3">
          {isSelectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Seleccionar solicitud ${labelTipo}`}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          )}
        </td>

        {/* Tipo */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="text-brand-600 hover:underline"
            >
              {expanded ? 'Ocultar' : 'Ver'}
            </button>
            <span className="font-medium text-slate-900">{labelTipo}</span>
          </div>
        </td>

        {/* Estado */}
        <td className="px-3 py-3">
          {estadoBadge()}
        </td>

        {/* Fecha */}
        <td className="px-3 py-3 text-sm text-slate-600">
          {formatDate(solicitud.createdAt)}
        </td>

        {/* Acciones */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Botón Aprobar - solo si canApprove es true */}
            {canApprove && (
              <AprobarButton
                solicitud={solicitud}
                accionando={accionando}
                onAprobar={onAprobar}
              />
            )}

            {/* Botón Editar */}
            <button
              onClick={onEditar}
              disabled={solicitud.estado !== 'pendiente'}
              className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Editar
            </button>

            {/* Rechazar - solo si canApprove es true */}
            {canApprove && (
              <>
                {isRechazando ? (
                  // Modo confirmación de rechazo
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={rechazoEdit?.motivo || ''}
                      onChange={(e) => setRechazoEdit({ id: solicitud._id, motivo: e.target.value })}
                      placeholder="Motivo"
                      className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      disabled={isAccionando || !rechazoEdit?.motivo?.trim()}
                      onClick={onRechazar}
                      className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setRechazoEdit(null)}
                      className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  // Botón de rechazo inicial
                  <button
                    disabled={isAccionando || solicitud.estado !== 'pendiente'}
                    onClick={() => setRechazoEdit({ id: solicitud._id, motivo: '' })}
                    className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    Rechazar
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Fila expandida */}
      {expanded && (
        <tr className="border-t border-slate-100 bg-slate-50/50">
          <td colSpan={5} className="px-3 py-4">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">

              {/* Meta: quién pidió + doble confirmación */}
              <div className="flex flex-wrap items-start gap-x-6 gap-y-2 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Solicitado por</p>
                  {(() => {
                    const cp = solicitud.creadoPor;
                    if (typeof cp === 'object' && cp !== null) {
                      return (
                        <p className="text-sm font-medium text-slate-800">
                          {cp.nombre ?? '—'}
                          {cp.email && <span className="ml-1 text-xs text-slate-400">({cp.email})</span>}
                        </p>
                      );
                    }
                    return <p className="font-mono text-xs text-slate-500">{String(cp)}</p>;
                  })()}
                </div>

                {solicitud.requiereDobleConfirmacion && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Aprobaciones</p>
                    <p className="text-sm font-medium text-slate-800">
                      {solicitud.aceptadoPor?.length ?? 0}
                      <span className="text-slate-400"> / 2</span>
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Doble confirmación</span>
                    </p>
                  </div>
                )}

                {solicitud.entidad && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Entidad</p>
                    <p className="font-mono text-xs text-slate-500">{solicitud.entidad}</p>
                  </div>
                )}

                <div className="ml-auto text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Fecha</p>
                  <p className="text-xs text-slate-500">{formatDate(solicitud.createdAt)}</p>
                </div>
              </div>

              {/* Datos propuestos — legibles */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Datos propuestos</p>
                {renderDatos(solicitud.datosPropuestos || {})}
              </div>

              {/* Motivo de rechazo */}
              {solicitud.estado === 'rechazado' && solicitud.motivoRechazo && (
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 mb-0.5">Motivo de rechazo</p>
                  <p className="text-sm text-rose-800">{solicitud.motivoRechazo}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default NotificacionesRow;
