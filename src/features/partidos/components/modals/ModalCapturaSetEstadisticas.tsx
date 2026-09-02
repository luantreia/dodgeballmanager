import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import EquiposEstadisticas from './EquipoEstadisticas';
import {
  obtenerSetsDePartido,
  type PartidoDetallado,
  type SetPartido,
  extractEquipoId,
  extractEquipoNombre,
  obtenerJugadoresDePartido,
  obtenerEstadisticasJugadorSet,
  crearEstadisticaJugadorSet,
  actualizarEstadisticaJugadorSet,
  type VisibilidadEstadistica,
} from '../../services/partidoService';

import { crearSolicitudEdicion } from '../../../../shared/features/solicitudes/services/solicitudesEdicionService';
import { completarSlots, ESTADISTICAS_SLOT_VACIO } from '../../constants/capturaSet';

type ModalCapturaSetEstadisticasProps = {
  partido: PartidoDetallado | null;
  partidoId: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  numeroSetInicial?: number | null;
  onRefresh?: () => Promise<void> | void;
  esCompetencia?: boolean;
};

const ESTADISTICAS_INICIALES = { throws: 0, hits: 0, outs: 0, catches: 0, survive: false } as const;

const ModalCapturaSetEstadisticas = ({
  partido,
  partidoId,
  token,
  isOpen,
  onClose,
  numeroSetInicial = null,
  onRefresh,
  esCompetencia,
}: ModalCapturaSetEstadisticasProps) => {
  const { addToast } = useToast();
  const [sets, setSets] = useState<SetPartido[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [numeroSetSeleccionado, setNumeroSetSeleccionado] = useState<string>('');
  const [mapJpToJugador, setMapJpToJugador] = useState<Record<string, string>>({});
  const [mapJugadorToJp, setMapJugadorToJp] = useState<Record<string, string>>({});
  const [opcionesLocal, setOpcionesLocal] = useState<Array<{ value: string; label: string }>>([]);
  const [opcionesVisitante, setOpcionesVisitante] = useState<Array<{ value: string; label: string }>>([]);
  const [guardando, setGuardando] = useState(false);

  type Stats = { throws: number; hits: number; outs: number; catches: number; survive: boolean };
  type CampoNumerico = 'throws' | 'hits' | 'outs' | 'catches';
  type Row = { jugadorId?: string; jugadorPartidoId?: string; estadisticas: Stats; statId?: string };
  const [rowsLocal, setRowsLocal] = useState<Row[]>([]);
  const [rowsVisitante, setRowsVisitante] = useState<Row[]>([]);
  const [mapJpToStatId, setMapJpToStatId] = useState<Record<string, string>>({});
  const [visibilidad, setVisibilidad] = useState<VisibilidadEstadistica>('organizacion');

  const setsOrdenados = useMemo(() => [...sets].sort((a, b) => a.numeroSet - b.numeroSet), [sets]);

  const cargarSets = useCallback(async () => {
    try {
      setLoadingSets(true);
      const data = await obtenerSetsDePartido(partidoId);
      setSets(data);
      if ((numeroSetInicial || numeroSetInicial === 0) && !numeroSetSeleccionado) {
        setNumeroSetSeleccionado(String(numeroSetInicial));
      } else if (!numeroSetSeleccionado && data.length > 0) {
        const ultimo = data.reduce((max, s) => (s.numeroSet > max.numeroSet ? s : max), data[0]);
        setNumeroSetSeleccionado(String(ultimo.numeroSet));
      }
    } catch (err) {
      console.error(err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar los sets' });
    } finally {
      setLoadingSets(false);
    }
  }, [addToast, numeroSetInicial, numeroSetSeleccionado, partidoId]);

  useEffect(() => {
    if (!isOpen) return;
    void cargarSets();
  }, [isOpen, cargarSets]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    const cargarJugadoresPartido = async () => {
      try {
        const data = await obtenerJugadoresDePartido(partidoId);
        if (cancelado) return;
        const mapa: Record<string, string> = {};
        const mapaReverse: Record<string, string> = {};
        const localId = extractEquipoId(partido?.equipoLocal);
        const visitanteId = extractEquipoId(partido?.equipoVisitante);
        const optsLocal: Array<{ value: string; label: string }> = [];
        const optsVisit: Array<{ value: string; label: string }> = [];
        data.forEach((jp) => {
          const jpId = jp._id;
          const jugadorId = typeof jp.jugador === 'string' ? jp.jugador : jp.jugador?._id;
          const jugadorNombre = typeof jp.jugador === 'string' ? 'Jugador' : (jp.jugador?.fullName || jp.jugador?.nombre || 'Jugador');
          if (jpId && jugadorId) {
            mapa[jpId] = jugadorId;
            mapaReverse[jugadorId] = jpId;
          }
          const equipoRef = jp.equipo as any;
          const eqId = typeof equipoRef === 'string' ? equipoRef : equipoRef?._id;
          if (jugadorId && eqId) {
            const opt = { value: jugadorId, label: jugadorNombre };
            if (eqId === localId) optsLocal.push(opt);
            else if (eqId === visitanteId) optsVisit.push(opt);
          }
        });
        setMapJpToJugador(mapa);
        setMapJugadorToJp(mapaReverse);
        setOpcionesLocal(optsLocal);
        setOpcionesVisitante(optsVisit);
      } catch (error) {
        console.warn('No se pudieron cargar jugadores del partido:', error);
      }
    };
    void cargarJugadoresPartido();
    return () => {
      cancelado = true;
    };
  }, [isOpen, partidoId, partido?.equipoLocal, partido?.equipoVisitante]);

  // Cargar estadísticas del set seleccionado y prellenar filas (incluye JugadorPartido sin stats con ceros)
  useEffect(() => {
    if (!isOpen || !numeroSetSeleccionado) return;
    let cancelado = false;
    const cargar = async () => {
      try {
        const setId = sets.find((s) => String(s.numeroSet) === String(numeroSetSeleccionado))?._id;
        if (!setId) return;
        const data = await obtenerEstadisticasJugadorSet({ set: setId });
        if (cancelado) return;
        const localId = extractEquipoId(partido?.equipoLocal);
        const visitId = extractEquipoId(partido?.equipoVisitante);
        let aLocal: Row[] = [];
        let aVisit: Row[] = [];
        const statMap: Record<string, string> = {};
        data.forEach((stat: any) => {
          const jugadorId = typeof stat.jugador === 'string' ? stat.jugador : stat.jugador?._id;
          const jugadorPartidoId = typeof stat.jugadorPartido === 'string' ? stat.jugadorPartido : stat.jugadorPartido?._id ?? stat.jugadorPartido;
          const equipoId = typeof stat.equipo === 'string' ? stat.equipo : stat.equipo?._id;
          const row: Row = {
            jugadorId,
            jugadorPartidoId,
            estadisticas: {
              throws: stat.throws ?? 0,
              hits: stat.hits ?? 0,
              outs: stat.outs ?? 0,
              catches: stat.catches ?? 0,
              survive: Boolean(stat.survive),
            },
            statId: stat._id,
          };
          if (jugadorPartidoId) statMap[jugadorPartidoId] = stat._id;
          if (equipoId === localId) aLocal.push(row);
          else if (equipoId === visitId) aVisit.push(row);
        });

        // La grilla son JUGADORES_POR_SET slots: los que ya tienen estadísticas
        // cargadas en este set, y el resto vacíos para elegir de la convocatoria.
        //
        // Antes esto rellenaba con la convocatoria ENTERA. Como la grilla recorta a 6,
        // se veían 6 jugadores arbitrarios mientras el estado guardaba a todos: al
        // guardar se creaban filas en cero para gente que nunca apareció en pantalla.
        // Lo que ves y lo que se guarda tienen que ser lo mismo.
        const slotVacio = (): Row => ({
          estadisticas: { ...ESTADISTICAS_SLOT_VACIO },
        });

        setRowsLocal(completarSlots(aLocal, slotVacio));
        setRowsVisitante(completarSlots(aVisit, slotVacio));
        setMapJpToStatId(statMap);
      } catch (err) {
        console.error('Error cargando estadísticas del set:', err);
      }
    };
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [isOpen, numeroSetSeleccionado, partido?.equipoLocal, partido?.equipoVisitante, sets, opcionesLocal, opcionesVisitante, mapJugadorToJp]);

  const equiposDelSet = useMemo(() => {
    const localId = extractEquipoId(partido?.equipoLocal) ?? 'local';
    const visitId = extractEquipoId(partido?.equipoVisitante) ?? 'visitante';
    return {
      [localId]: rowsLocal,
      [visitId]: rowsVisitante,
    } as Record<string, Row[]>;
  }, [partido?.equipoLocal, partido?.equipoVisitante, rowsLocal, rowsVisitante]);

  const cambiarEstadistica = useCallback((equipoId: string, idx: number, campo: CampoNumerico, delta: number) => {
    const localId = extractEquipoId(partido?.equipoLocal);
    if (equipoId === localId) {
      setRowsLocal((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0, survive: false } };
        const value = (cur.estadisticas[campo] ?? 0) + delta;
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, [campo]: Math.max(0, value) } } as Row;
        return next;
      });
    } else {
      setRowsVisitante((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0, survive: false } };
        const value = (cur.estadisticas[campo] ?? 0) + delta;
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, [campo]: Math.max(0, value) } } as Row;
        return next;
      });
    }
  }, [partido?.equipoLocal]);

  const cambiarSurvive = useCallback((equipoId: string, idx: number, value: boolean) => {
    const localId = extractEquipoId(partido?.equipoLocal);
    if (equipoId === localId) {
      setRowsLocal((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0, survive: false } };
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, survive: value } } as Row;
        return next;
      });
    } else {
      setRowsVisitante((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0, survive: false } };
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, survive: value } } as Row;
        return next;
      });
    }
  }, [partido?.equipoLocal]);

  const onAsignarJugador = useCallback((equipo: 'local' | 'visitante', index: number, jugadorId: string) => {
    const setter = equipo === 'local' ? setRowsLocal : setRowsVisitante;
    setter((prev) => {
      const next = [...prev];
      const jpId = mapJugadorToJp[jugadorId] ?? jugadorId;
      const cur = next[index] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0, survive: false } };
      next[index] = { ...cur, jugadorId, jugadorPartidoId: jpId, statId: cur.statId && cur.jugadorPartidoId === jpId ? cur.statId : undefined };
      return next;
    });
  }, [mapJugadorToJp]);

  const guardar = useCallback(async () => {
    try {
      setGuardando(true);
      const setId = sets.find((s) => String(s.numeroSet) === String(numeroSetSeleccionado))?._id;
      if (!setId) return;
      const localId = extractEquipoId(partido?.equipoLocal) ?? '';
      const visitId = extractEquipoId(partido?.equipoVisitante) ?? '';

      if (esCompetencia) {
        // Enviar solicitud en lugar de guardar directamente
        const estadisticasLocal = rowsLocal
          .filter(r => r.jugadorId && r.jugadorPartidoId)
          .map(r => ({
            jugadorId: r.jugadorId,
            jugadorPartidoId: r.jugadorPartidoId,
            estadisticas: r.estadisticas
          }));

        const estadisticasVisitante = rowsVisitante
          .filter(r => r.jugadorId && r.jugadorPartidoId)
          .map(r => ({
            jugadorId: r.jugadorId,
            jugadorPartidoId: r.jugadorPartidoId,
            estadisticas: r.estadisticas
          }));

        await crearSolicitudEdicion({
          // 'estadisticasJugadorSet' pide publicar una fila que YA existe y espera
          // su _id en `entidad`. Acá se proponen números que todavía no existen,
          // así que el tipo es otro y `entidad` es el partido. Con el tipo viejo el
          // backend hacía findByIdAndUpdate(partidoId) y descartaba los datos.
          tipo: 'estadisticas-set-propuesta',
          entidad: partidoId,
          datosPropuestos: {
            setId,
            numeroSet: numeroSetSeleccionado,
            localId,
            visitId,
            estadisticasLocal,
            estadisticasVisitante
          }
        });
        
        addToast({ type: 'success', title: 'Solicitud enviada', message: 'Se solicitó la actualización de estadísticas' });
        onClose();
        return;
      }

      const process = async (rows: Row[], equipoId: string) => {
        for (const r of rows) {
          if (!r?.jugadorId || !r?.jugadorPartidoId) continue;
          const existingId = r.statId || mapJpToStatId[r.jugadorPartidoId];
          if (existingId) {
            await actualizarEstadisticaJugadorSet(existingId, {
              ...r.estadisticas,
              visibilidadObjetivo: visibilidad,
            });
          } else {
            // Doble chequeo: consultar existencia por (set, jugadorPartido) para evitar E11000
            const existentes = await obtenerEstadisticasJugadorSet({ set: setId, jugadorPartido: r.jugadorPartidoId });
            const yaExiste = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;
            if (yaExiste?._id) {
              await actualizarEstadisticaJugadorSet(yaExiste._id, {
                ...r.estadisticas,
                visibilidadObjetivo: visibilidad,
              });
              setMapJpToStatId((prev) => ({ ...prev, [r.jugadorPartidoId as string]: yaExiste!._id }));
            } else {
              const creado = await crearEstadisticaJugadorSet({
                set: setId,
                jugadorPartido: r.jugadorPartidoId,
                jugador: r.jugadorId,
                equipo: equipoId,
                ...r.estadisticas,
                visibilidadObjetivo: visibilidad,
              });
              if (creado && creado._id) {
                setMapJpToStatId((prev) => ({ ...prev, [r.jugadorPartidoId as string]: creado._id }));
              }
            }
          }
        }
      };
      await process(rowsLocal, localId);
      await process(rowsVisitante, visitId);
      addToast({ type: 'success', title: 'Guardado', message: 'Estadísticas del set guardadas' });
      await Promise.resolve(onRefresh?.());
      // refrescar stats para obtener ids creados
      const data = await obtenerEstadisticasJugadorSet({ set: setId });
      const byEquipo = (equipoId: string) => data.filter((d) => d.equipo === equipoId);
      const rebuild = (arr: Row[], equipoId: string) => arr.map((r) => {
        const found = byEquipo(equipoId).find((d) => d.jugadorPartido === r.jugadorPartidoId);
        return found ? { ...r, statId: found._id } : r;
      });
      setRowsLocal((prev) => rebuild(prev, localId));
      setRowsVisitante((prev) => rebuild(prev, visitId));
    } catch (err) {
      console.error(err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos guardar las estadísticas' });
    } finally {
      setGuardando(false);
    }
  }, [addToast, numeroSetSeleccionado, onRefresh, partido?.equipoLocal, partido?.equipoVisitante, rowsLocal, rowsVisitante, sets, mapJpToStatId, esCompetencia, onClose, partidoId, visibilidad]);

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} bodyClassName="p-0" size="xl" title="Captura de estadísticas por set">

      <div className="space-y-4 px-1 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="selectSet" className="text-sm font-medium text-slate-700">Seleccioná un set</label>
          <select
            id="selectSet"
            value={numeroSetSeleccionado}
            onChange={(e) => setNumeroSetSeleccionado(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            disabled={loadingSets || setsOrdenados.length === 0}
          >
            <option value="" disabled>Elegí un set…</option>
            {setsOrdenados.map((s) => (
              <option key={s._id} value={String(s.numeroSet)}>
                Set {s.numeroSet} • {s.estadoSet}
              </option>
            ))}
          </select>

          {null}
        </div>

        {!numeroSetSeleccionado ? (
          <p className="italic text-slate-500">Elegí un set para capturar estadísticas.</p>
        ) : null}

        {numeroSetSeleccionado && (
          <div className="space-y-4">
            {(() => {
              const equipoLocalId = extractEquipoId(partido?.equipoLocal) ?? 'local';
              const equipoVisitanteId = extractEquipoId(partido?.equipoVisitante) ?? 'visitante';
              const equipoLocalNombre = extractEquipoNombre(partido?.equipoLocal, 'Equipo Local');
              const equipoVisitanteNombre = extractEquipoNombre(partido?.equipoVisitante, 'Equipo Visitante');
              const local = (equiposDelSet[equipoLocalId] ?? []) as Row[];
              const visitante = (equiposDelSet[equipoVisitanteId] ?? []) as Row[];
              return (
                <EquiposEstadisticas
                  equipoLocal={{ _id: equipoLocalId, nombre: equipoLocalNombre }}
                  equipoVisitante={{ _id: equipoVisitanteId, nombre: equipoVisitanteNombre }}
                  estadisticas={{
                    local: local.map((j) => ({
                      jugadorId: j.jugadorId ?? mapJpToJugador[j.jugadorPartidoId ?? ''],
                      estadisticas: { ...ESTADISTICAS_INICIALES, ...j.estadisticas },
                    })),
                    visitante: visitante.map((j) => ({
                      jugadorId: j.jugadorId ?? mapJpToJugador[j.jugadorPartidoId ?? ''],
                      estadisticas: { ...ESTADISTICAS_INICIALES, ...j.estadisticas },
                    })),
                  }}
                  onCambiarEstadistica={(equipoId, idx, campo, delta) => cambiarEstadistica(equipoId, idx, campo, delta)}
                  onCambiarSurvive={cambiarSurvive}
                  onAsignarJugador={(equipo, index, jugadorId) => onAsignarJugador(equipo, index, jugadorId)}
                  token={token}
                  opcionesJugadoresLocal={opcionesLocal}
                  opcionesJugadoresVisitante={opcionesVisitante}
                />
              );
            })()}

            {!esCompetencia ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="visibilidad-estadisticas"
                >
                  ¿Quién puede ver estas estadísticas?
                </label>
                <select
                  id="visibilidad-estadisticas"
                  value={visibilidad}
                  onChange={(event) => setVisibilidad(event.target.value as VisibilidadEstadistica)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-72"
                >
                  <option value="organizacion">Solo mi equipo y la organización</option>
                  <option value="publica">Públicas (visibles en el portal)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Al ser un amistoso, la visibilidad se aplica al guardar: no pasa por aprobación de
                  ningún organizador.
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!numeroSetSeleccionado) {
                    addToast({ type: 'info', title: 'Elegí un set', message: 'Seleccioná un set antes de guardar' });
                    return;
                  }
                  await guardar();
                }}
                disabled={guardando || !numeroSetSeleccionado}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar estadísticas del set'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default ModalCapturaSetEstadisticas;
