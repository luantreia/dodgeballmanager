import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { getSolicitudesEdicion, actualizarSolicitudEdicion } from '../../solicitudes/services/solicitudesEdicionService';
import type { ISolicitudEdicion } from '../../../shared/utils/types/solicitudesEdicion';

const categoriaDeTipo = (tipo: string): string => {
  if (
    tipo === 'usuario-solicitar-admin-equipo'
  ) return 'Solicitudes de usuarios';

  if (
    tipo === 'jugador-equipo-crear' ||
    tipo === 'jugador-equipo-eliminar' ||
    tipo === 'jugador-equipo-editar'
  ) return 'Contratos';

  if (
    tipo === 'participacion-temporada-crear' ||
    tipo === 'participacion-temporada-actualizar' ||
    tipo === 'participacion-temporada-eliminar' ||
    tipo === 'jugador-temporada-crear' ||
    tipo === 'jugador-temporada-actualizar' ||
    tipo === 'jugador-temporada-eliminar'
  ) return 'Participaciones';

  if (
    tipo === 'resultadoPartido' ||
    tipo === 'resultadoSet' ||
    tipo === 'estadisticasJugadorSet' ||
    tipo === 'estadisticasJugadorPartido' ||
    tipo === 'estadisticasEquipoPartido' ||
    tipo === 'estadisticasEquipoSet'
  ) return 'Partidos';

  return 'Otras';
};

const labelTipo = (t: string) => {
  const map: Partial<Record<string, string>> = {
    'usuario-solicitar-admin-equipo': 'Usuario: Solicitar admin de equipo',
    'jugador-equipo-crear': 'Contrato: Jugador-Equipo (crear)',
    'jugador-equipo-eliminar': 'Contrato: Jugador-Equipo (eliminar)',
    'jugador-equipo-editar': 'Contrato: Jugador-Equipo (editar)',
    'participacion-temporada-crear': 'Participación: Temporada (crear)',
    'participacion-temporada-actualizar': 'Participación: Temporada (actualizar)',
    'participacion-temporada-eliminar': 'Participación: Temporada (eliminar)',
    'jugador-temporada-crear': 'Participación: Jugador-Temporada (crear)',
    'jugador-temporada-actualizar': 'Participación: Jugador-Temporada (actualizar)',
    'jugador-temporada-eliminar': 'Participación: Jugador-Temporada (eliminar)',
    resultadoPartido: 'Partido: Resultado partido',
    resultadoSet: 'Partido: Resultado set',
    estadisticasJugadorSet: 'Partido: Estadísticas jugador set',
    estadisticasJugadorPartido: 'Partido: Estadísticas jugador partido',
    estadisticasEquipoPartido: 'Partido: Estadísticas equipo partido',
    estadisticasEquipoSet: 'Partido: Estadísticas equipo set',
  };
  return map[t] ?? t;
};

const NotificacionesPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<ISolicitudEdicion[]>([]);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rechazoEdit, setRechazoEdit] = useState<{ id: string; motivo: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const [fEstado, setFEstado] = useState<string>((searchParams.get('estado') as any) || 'pendiente');
  const [fCategoria, setFCategoria] = useState<string>(searchParams.get('categoria') || 'Todas');
  const [q, setQ] = useState<string>(searchParams.get('q') || '');

  const cargar = async () => {
    if (!equipoSeleccionado) return;
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (fEstado && fEstado !== 'todos') params.estado = fEstado;
      const data = await getSolicitudesEdicion(params);
      setSolicitudes(data.solicitudes || []);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void cargar(); }, [fEstado, equipoSeleccionado?.id]);

  useEffect(() => {
    if (!autoRefresh || !equipoSeleccionado) return;
    const id = window.setInterval(() => { void cargar(); }, 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fEstado, equipoSeleccionado?.id]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (fEstado && fEstado !== 'todos') sp.set('estado', fEstado);
    if (fCategoria && fCategoria !== 'Todas') sp.set('categoria', fCategoria);
    if (q) sp.set('q', q);
    setSearchParams(sp, { replace: true });
  }, [fEstado, fCategoria, q, setSearchParams]);

  const perteneceAlEquipo = (s: ISolicitudEdicion, equipoId: string) => {
    try {
      if ((s as any).entidad === equipoId) return true;
      const dp = (s as any).datosPropuestos || {};
      return dp.equipoId === equipoId || dp.equipo === equipoId || JSON.stringify(dp).includes(equipoId);
    } catch {
      return false;
    }
  };

  const filtradas = useMemo(() => {
    if (!equipoSeleccionado) return [] as ISolicitudEdicion[];
    const byEquipo = (s: ISolicitudEdicion) => perteneceAlEquipo(s, equipoSeleccionado.id);
    const byCat = (s: ISolicitudEdicion) => (fCategoria === 'Todas' ? true : categoriaDeTipo((s as any).tipo) === fCategoria);
    const byQ = (s: ISolicitudEdicion) => {
      if (!q) return true;
      const txt = `${(s as any).tipo} ${labelTipo((s as any).tipo)} ${JSON.stringify((s as any).datosPropuestos || {})}`.toLowerCase();
      return txt.includes(q.toLowerCase());
    };
    return (solicitudes || []).filter((s) => byEquipo(s) && byCat(s) && byQ(s));
  }, [solicitudes, equipoSeleccionado?.id, fCategoria, q]);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  useEffect(() => { setPage(1); }, [fCategoria, q, fEstado, equipoSeleccionado?.id]);

  const manejarAprobar = async (s: ISolicitudEdicion) => {
    try {
      setAccionando((s as any)._id);
      const updated = await actualizarSolicitudEdicion((s as any)._id, { estado: 'aceptado' } as any);
      setSolicitudes((prev) => prev.map((x) => ((x as any)._id === (s as any)._id ? updated : x)) as any);
      addToast({ type: 'success', title: 'Solicitud aprobada' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error al aprobar', message: e?.message || 'No se pudo aprobar' });
    } finally {
      setAccionando(null);
    }
  };

  const manejarRechazar = async (s: ISolicitudEdicion) => {
    if (!rechazoEdit || rechazoEdit.id !== (s as any)._id || !rechazoEdit.motivo.trim()) {
      addToast({ type: 'info', title: 'Ingresá un motivo', message: 'Escribí un motivo y confirmá' });
      return;
    }
    try {
      setAccionando((s as any)._id);
      const updated = await actualizarSolicitudEdicion((s as any)._id, { estado: 'rechazado', motivoRechazo: rechazoEdit.motivo.trim() } as any);
      setSolicitudes((prev) => prev.map((x) => ((x as any)._id === (s as any)._id ? updated : x)) as any);
      setRechazoEdit(null);
      addToast({ type: 'success', title: 'Solicitud rechazada' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error al rechazar', message: e?.message || 'No se pudo rechazar' });
    } finally {
      setAccionando(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notificaciones</h1>
          <p className="text-sm text-slate-500">Gestioná solicitudes del equipo por categoría.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg border-slate-300 text-sm">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aceptado">Aceptado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className="rounded-lg border-slate-300 text-sm">
            <option>Todas</option>
            <option>Solicitudes de usuarios</option>
            <option>Contratos</option>
            <option>Participaciones</option>
            <option>Partidos</option>
            <option>Otras</option>
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="w-48 rounded-lg border-slate-300 text-sm" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh 30s
          </label>
          <button onClick={() => void cargar()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Recargar</button>
        </div>
      </header>

      {!equipoSeleccionado ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Seleccioná un equipo para ver sus solicitudes.</p>
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Cargando…</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        Object.entries(
          filtradas.reduce((acc: Record<string, ISolicitudEdicion[]>, s) => {
            const cat = categoriaDeTipo((s as any).tipo);
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(s);
            return acc;
          }, {})
        ).map(([cat, items]) => (
          <section key={cat} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{cat}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{items.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Creado</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize).map((s: any) => (
                    <>
                      <tr key={s._id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          <button onClick={() => setExpanded((prev) => ({ ...prev, [s._id]: !prev[s._id] }))} className="mr-2 text-brand-600 hover:underline">
                            {expanded[s._id] ? 'Ocultar' : 'Ver'}
                          </button>
                          {labelTipo(s.tipo)}
                        </td>
                        <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${s.estado === 'pendiente' ? 'bg-amber-100 text-amber-800' : s.estado === 'aceptado' ? 'bg-emerald-100 text-emerald-800' : s.estado === 'rechazado' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{s.estado}</span></td>
                        <td className="px-3 py-2 text-slate-600">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              disabled={accionando === s._id || s.estado !== 'pendiente'}
                              onClick={() => void manejarAprobar(s)}
                              className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                            >
                              Aprobar
                            </button>
                            {rechazoEdit?.id === s._id ? (
                              <>
                                <input value={rechazoEdit?.motivo ?? ''} onChange={(e) => setRechazoEdit({ id: s._id, motivo: e.target.value })} placeholder="Motivo" className="w-40 rounded border border-slate-300 px-2 py-1 text-xs" />
                                <button disabled={accionando === s._id || s.estado !== 'pendiente'} onClick={() => void manejarRechazar(s)} className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300">Confirmar</button>
                                <button onClick={() => setRechazoEdit(null)} className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                              </>
                            ) : (
                              <button disabled={accionando === s._id || s.estado !== 'pendiente'} onClick={() => setRechazoEdit({ id: s._id, motivo: '' })} className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300">Rechazar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded[s._id] ? (
                        <tr className="border-t border-slate-100 bg-slate-50/50">
                          <td colSpan={4} className="px-3 py-3">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="mb-2 text-xs font-semibold text-slate-500">Datos propuestos</p>
                              <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">{JSON.stringify(s.datosPropuestos || {}, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <span className="text-slate-500">Página {page} de {totalPages}</span>
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default NotificacionesPage;
