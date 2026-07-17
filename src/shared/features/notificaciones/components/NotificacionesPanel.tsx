// Componente principal unificado de Notificaciones
// Reemplaza las páginas individuales de cada frontend

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSolicitudesEdicion, actualizarSolicitudEdicion } from '../../solicitudes/services/solicitudesEdicionService';
import { useToast } from '../../../components/Toast/ToastProvider';
import SolicitudEditModalSimple from '../../solicitudes/components/SolicitudEditModalSimple';
import type { ISolicitudEdicion, SolicitudEdicionEstado } from '../../solicitudes/types/solicitudesEdicion';
import type { NotificacionesPanelProps } from '../types/notificacionesTypes';
import { NotificacionesFilters } from './NotificacionesFilters';
import { NotificacionesTable } from './NotificacionesTable';

export const NotificacionesPanel: React.FC<NotificacionesPanelProps> = ({
  title,
  description,
  allowedTipos,
  entityType,
  scope = 'related',
  canApprove,
  showCategoriaFilter = true,
  showEntidadFilter = false,
  onSolicitudUpdate,
}) => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<ISolicitudEdicion[]>([]);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rechazoEdit, setRechazoEdit] = useState<{ id: string; motivo: string } | null>(null);
  const [openSolicitud, setOpenSolicitud] = useState<ISolicitudEdicion | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aprobandoSeleccion, setAprobandoSeleccion] = useState(false);

  // Filtros de UI
  const [fEstado, setFEstado] = useState<SolicitudEdicionEstado | 'todos'>(
    (searchParams.get('estado') as SolicitudEdicionEstado) || 'pendiente'
  );
  const [fCategoria, setFCategoria] = useState<string>(searchParams.get('categoria') || 'Todas');
  const [q, setQ] = useState<string>(searchParams.get('q') || '');
  const [fMostrarSoloMias, setFMostrarSoloMias] = useState<boolean>(
    searchParams.get('soloMias') === 'true'
  );

  // Mapa de categorías por tipo
  const categoriaDeTipo = useCallback((tipo: string): string => {
    if (tipo.startsWith('usuario-crear-') || tipo.startsWith('usuario-solicitar-') || tipo === 'jugador-claim') {
      return 'Solicitudes de usuarios';
    }
    if (tipo.startsWith('jugador-equipo-')) return 'Contratos';
    if (tipo.startsWith('participacion-temporada-') || tipo === 'contratoEquipoCompetencia') return 'Inscripciones';
    if (tipo.startsWith('jugador-temporada-')) return 'Lista de buena fe';
    if (tipo.startsWith('resultado') || tipo.startsWith('editarPartido')) return 'Partidos';
    if (tipo.startsWith('estadisticas')) return 'Estadísticas';
    return 'Otros';
  }, []);

  // Labels amigables
  const labelTipo = useCallback((tipo: string): string => {
    const labels: Record<string, string> = {
      'usuario-crear-jugador': 'Crear jugador',
      'usuario-crear-equipo': 'Crear equipo',
      'usuario-crear-organizacion': 'Crear organización',
      'usuario-solicitar-admin-jugador': 'Solicitar admin jugador',
      'usuario-solicitar-admin-equipo': 'Solicitar admin equipo',
      'usuario-solicitar-admin-organizacion': 'Solicitar admin org',
      'jugador-claim': 'Reclamar perfil',
      'jugador-equipo-crear': 'Nuevo contrato',
      'jugador-equipo-editar': 'Editar contrato',
      'jugador-equipo-eliminar': 'Eliminar contrato',
      'participacion-temporada-crear': 'Inscribir equipo',
      'participacion-temporada-actualizar': 'Actualizar inscripción',
      'participacion-temporada-eliminar': 'Eliminar inscripción',
      'contratoEquipoCompetencia': 'Registro competencia',
      'jugador-temporada-crear': 'Agregar a lista',
      'jugador-temporada-actualizar': 'Editar en lista',
      'jugador-temporada-eliminar': 'Quitar de lista',
      'resultadoPartido': 'Resultado partido',
      'editarPartidoCompetencia': 'Editar partido',
      'resultadoSet': 'Resultado set',
      'estadisticasJugadorSet': 'Stats jugador set',
      'estadisticasJugadorPartido': 'Stats jugador partido',
      'estadisticasEquipoPartido': 'Stats equipo partido',
      'estadisticasEquipoSet': 'Stats equipo set',
    };
    return labels[tipo] ?? tipo;
  }, []);

  // Cargar datos
  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (fEstado !== 'todos') params.estado = fEstado;
      params.scope = fMostrarSoloMias ? 'mine' : scope;

      const data = await getSolicitudesEdicion(params);

      // Filtrar por tipos permitidos
      const allowedSet = new Set(allowedTipos);
      const filtradas = data.solicitudes.filter((s: ISolicitudEdicion) => allowedSet.has(s.tipo as any));
      setSolicitudes(filtradas);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, [fEstado, fMostrarSoloMias, scope, allowedTipos]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => { void cargar(); }, 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, cargar]);

  // Sync URL
  useEffect(() => {
    const sp = new URLSearchParams();
    if (fEstado !== 'todos') sp.set('estado', fEstado);
    if (fCategoria !== 'Todas') sp.set('categoria', fCategoria);
    if (q) sp.set('q', q);
    if (fMostrarSoloMias) sp.set('soloMias', 'true');
    setSearchParams(sp, { replace: true });
  }, [fEstado, fCategoria, q, fMostrarSoloMias, setSearchParams]);

  // Filtrar solicitudes
  const filtradas = useMemo(() => {
    return solicitudes.filter((s: ISolicitudEdicion) => {
      // Filtrar por categoría
      if (fCategoria !== 'Todas') {
        const cat = categoriaDeTipo(s.tipo);
        if (cat !== fCategoria) return false;
      }
      // Filtrar por búsqueda
      if (q) {
        const txt = `${s.tipo} ${labelTipo(s.tipo)} ${JSON.stringify(s.datosPropuestos || {})}`.toLowerCase();
        if (!txt.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [solicitudes, fCategoria, q, categoriaDeTipo, labelTipo]);

  // Agrupar por categoría
  const categorias = useMemo(() => {
    const grupos: Record<string, ISolicitudEdicion[]> = {};
    for (const s of filtradas) {
      const cat = categoriaDeTipo(s.tipo);
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(s);
    }
    return grupos;
  }, [filtradas, categoriaDeTipo]);

  // Lista de categorías únicas
  const listaCategorias = useMemo(() => Object.keys(categorias), [categorias]);

  // Acciones
  const manejarAprobar = async (s: ISolicitudEdicion) => {
    try {
      setAccionando(s._id);
      const updated = await actualizarSolicitudEdicion(s._id, { estado: 'aceptado' });
      setSolicitudes((prev) => prev.map((x) => (x._id === s._id ? { ...updated } : x)));
      onSolicitudUpdate?.({ ...updated });
      addToast({ type: 'success', title: 'Solicitud aprobada' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error al aprobar', message: e?.message });
    } finally {
      setAccionando(null);
    }
  };

  const manejarRechazar = async (s: ISolicitudEdicion) => {
    if (!rechazoEdit || rechazoEdit.id !== s._id || !rechazoEdit.motivo.trim()) {
      addToast({ type: 'info', title: 'Ingresá un motivo', message: 'Escribí un motivo y confirmá' });
      return;
    }
    try {
      setAccionando(s._id);
      const updated = await actualizarSolicitudEdicion(s._id, { estado: 'rechazado', motivoRechazo: rechazoEdit.motivo.trim() });
      setSolicitudes((prev) => prev.map((x) => (x._id === s._id ? { ...updated } : x)));
      onSolicitudUpdate?.({ ...updated });
      setRechazoEdit(null);
      addToast({ type: 'success', title: 'Solicitud rechazada' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error al rechazar', message: e?.message });
    } finally {
      setAccionando(null);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const todasSeleccionadas = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (todasSeleccionadas) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const manejarAprobarSeleccionadas = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setAprobandoSeleccion(true);
    try {
      const resultados = await Promise.allSettled(
        ids.map((id) => actualizarSolicitudEdicion(id, { estado: 'aceptado' }))
      );

      const exitosas = resultados.filter((r) => r.status === 'fulfilled').length;
      const fallidas = resultados.length - exitosas;

      const actualizadas = new Map<string, ISolicitudEdicion>();
      resultados.forEach((r) => {
        if (r.status === 'fulfilled') actualizadas.set(r.value._id, r.value);
      });
      setSolicitudes((prev) => prev.map((x) => actualizadas.get(x._id) ?? x));
      actualizadas.forEach((s) => onSolicitudUpdate?.(s));

      setSelectedIds(new Set());

      if (fallidas === 0) {
        addToast({ type: 'success', title: `${exitosas} solicitud${exitosas === 1 ? '' : 'es'} aprobada${exitosas === 1 ? '' : 's'}` });
      } else {
        addToast({
          type: exitosas > 0 ? 'info' : 'error',
          title: `${exitosas} aprobada${exitosas === 1 ? '' : 's'}, ${fallidas} no se pudo${fallidas === 1 ? '' : 'ieron'} aprobar`,
          message: 'Revisá las que fallaron: puede que no tengas permisos para aprobarlas.',
        });
      }
    } finally {
      setAprobandoSeleccion(false);
    }
  };

  const handleOpenEditar = (s: ISolicitudEdicion) => setOpenSolicitud(s);
  const handleSaved = (updated: ISolicitudEdicion) => {
    setSolicitudes((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
    onSolicitudUpdate?.(updated);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </header>

        {/* Filtros */}
        <NotificacionesFilters
          fEstado={fEstado}
          setFEstado={setFEstado}
          fCategoria={fCategoria}
          setFCategoria={setFCategoria}
          q={q}
          setQ={setQ}
          fMostrarSoloMias={fMostrarSoloMias}
          setFMostrarSoloMias={setFMostrarSoloMias}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          showCategoriaFilter={showCategoriaFilter}
          showSoloMiasFilter={true}
          categorias={listaCategorias}
          onReload={() => void cargar()}
        />

        {/* Barra de acción masiva */}
        {canApprove && selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <span className="text-sm font-medium text-brand-800">
              {selectedIds.size} solicitud{selectedIds.size === 1 ? '' : 'es'} seleccionada{selectedIds.size === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={aprobandoSeleccion}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Deseleccionar
              </button>
              <button
                onClick={manejarAprobarSeleccionadas}
                disabled={aprobandoSeleccion}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {aprobandoSeleccion ? 'Aprobando…' : 'Aprobar seleccionadas'}
              </button>
            </div>
          </div>
        )}

        {/* Contenido */}
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Cargando…</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
        ) : (
          Object.entries(categorias).map(([cat, items]) => (
            <NotificacionesTable
              key={cat}
              categoria={cat}
              items={items}
              labelTipo={labelTipo}
              expanded={expanded}
              setExpanded={setExpanded}
              rechazoEdit={rechazoEdit}
              setRechazoEdit={setRechazoEdit}
              accionando={accionando}
              onAprobar={manejarAprobar}
              onRechazar={manejarRechazar}
              onEditar={handleOpenEditar}
              canApprove={canApprove}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
            />
          ))
        )}

        {/* Empty state */}
        {!loading && !error && filtradas.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No hay solicitudes que coincidan con los filtros seleccionados
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {openSolicitud && (
        <SolicitudEditModalSimple
          solicitud={{ ...openSolicitud, id: openSolicitud._id } as any}
          onClose={() => setOpenSolicitud(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
};
