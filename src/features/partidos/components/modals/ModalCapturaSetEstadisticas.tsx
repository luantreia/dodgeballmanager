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
} from '../../services/partidoService';

type ModalCapturaSetEstadisticasProps = {
  partido: PartidoDetallado | null;
  partidoId: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  numeroSetInicial?: number | null;
  onRefresh?: () => Promise<void> | void;
};

const ESTADISTICAS_INICIALES = { throws: 0, hits: 0, outs: 0, catches: 0 } as const;

const ModalCapturaSetEstadisticas = ({
  partido,
  partidoId,
  token,
  isOpen,
  onClose,
  numeroSetInicial = null,
  onRefresh,
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

  type Stats = { throws: number; hits: number; outs: number; catches: number };
  type Row = { jugadorId?: string; jugadorPartidoId?: string; estadisticas: Stats; statId?: string };
  const [rowsLocal, setRowsLocal] = useState<Row[]>([]);
  const [rowsVisitante, setRowsVisitante] = useState<Row[]>([]);
  const [mapJpToStatId, setMapJpToStatId] = useState<Record<string, string>>({});

  const setsOrdenados = useMemo(() => [...sets].sort((a, b) => a.numeroSet - b.numeroSet), [sets]);
  const setActual = useMemo(
    () => setsOrdenados.find((s) => String(s.numeroSet) === numeroSetSeleccionado),
    [setsOrdenados, numeroSetSeleccionado],
  );

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
            estadisticas: { throws: stat.throws ?? 0, hits: stat.hits ?? 0, outs: stat.outs ?? 0, catches: stat.catches ?? 0 },
            statId: stat._id,
          };
          if (jugadorPartidoId) statMap[jugadorPartidoId] = stat._id;
          if (equipoId === localId) aLocal.push(row);
          else if (equipoId === visitId) aVisit.push(row);
        });

        // Completar con jugadores del partido sin stats (ceros) por equipo
        const setLocal = new Set(aLocal.map((r) => r.jugadorId));
        const setVisit = new Set(aVisit.map((r) => r.jugadorId));
        const faltantesLocal = (opcionesLocal || []).filter((opt) => !setLocal.has(opt.value));
        const faltantesVisit = (opcionesVisitante || []).filter((opt) => !setVisit.has(opt.value));
        aLocal = [
          ...aLocal,
          ...faltantesLocal.map((opt) => ({
            jugadorId: opt.value,
            jugadorPartidoId: mapJugadorToJp[opt.value] ?? opt.value,
            estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0 },
          } as Row)),
        ];
        aVisit = [
          ...aVisit,
          ...faltantesVisit.map((opt) => ({
            jugadorId: opt.value,
            jugadorPartidoId: mapJugadorToJp[opt.value] ?? opt.value,
            estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0 },
          } as Row)),
        ];

        setRowsLocal(aLocal);
        setRowsVisitante(aVisit);
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

  const cambiarEstadistica = useCallback((equipoId: string, idx: number, campo: keyof Stats, delta: number) => {
    const localId = extractEquipoId(partido?.equipoLocal);
    if (equipoId === localId) {
      setRowsLocal((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0 } };
        const value = (cur.estadisticas[campo] ?? 0) + delta;
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, [campo]: Math.max(0, value) } } as Row;
        return next;
      });
    } else {
      setRowsVisitante((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0 } };
        const value = (cur.estadisticas[campo] ?? 0) + delta;
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, [campo]: Math.max(0, value) } } as Row;
        return next;
      });
    }
  }, [partido?.equipoLocal]);

  const onAsignarJugador = useCallback((equipo: 'local' | 'visitante', index: number, jugadorId: string) => {
    const setter = equipo === 'local' ? setRowsLocal : setRowsVisitante;
    setter((prev) => {
      const next = [...prev];
      const jpId = mapJugadorToJp[jugadorId] ?? jugadorId;
      const cur = next[index] ?? { estadisticas: { throws: 0, hits: 0, outs: 0, catches: 0 } };
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
      const process = async (rows: Row[], equipoId: string) => {
        for (const r of rows) {
          if (!r?.jugadorId || !r?.jugadorPartidoId) continue;
          const existingId = r.statId || mapJpToStatId[r.jugadorPartidoId];
          if (existingId) {
            await actualizarEstadisticaJugadorSet(existingId, r.estadisticas);
          } else {
            // Doble chequeo: consultar existencia por (set, jugadorPartido) para evitar E11000
            const existentes = await obtenerEstadisticasJugadorSet({ set: setId, jugadorPartido: r.jugadorPartidoId });
            const yaExiste = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;
            if (yaExiste?._id) {
              await actualizarEstadisticaJugadorSet(yaExiste._id, r.estadisticas);
              setMapJpToStatId((prev) => ({ ...prev, [r.jugadorPartidoId as string]: yaExiste!._id }));
            } else {
              const creado = await crearEstadisticaJugadorSet({
                set: setId,
                jugadorPartido: r.jugadorPartidoId,
                jugador: r.jugadorId,
                equipo: equipoId,
                ...r.estadisticas,
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
  }, [addToast, numeroSetSeleccionado, onRefresh, partido?.equipoLocal, partido?.equipoVisitante, rowsLocal, rowsVisitante, sets, mapJpToStatId]);

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
                  onCambiarEstadistica={(equipoId, idx, campo, delta) => cambiarEstadistica(equipoId, idx, campo as any, delta)}
                  onAsignarJugador={(equipo, index, jugadorId) => onAsignarJugador(equipo, index, jugadorId)}
                  token={token}
                  opcionesJugadoresLocal={opcionesLocal}
                  opcionesJugadoresVisitante={opcionesVisitante}
                />
              );
            })()}

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
