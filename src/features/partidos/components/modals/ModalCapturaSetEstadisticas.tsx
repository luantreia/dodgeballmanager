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
  obtenerJugadoresElegibles,
  type JugadoresElegibles,
  obtenerEstadisticasJugadorSet,
  crearEstadisticaJugadorSet,
  actualizarEstadisticaJugadorSet,
  getMisPermisosPartido,
  type PermisosPartido,
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
  const [infoElegibles, setInfoElegibles] = useState<JugadoresElegibles | null>(null);

  type Stats = { throws: number; hits: number; outs: number; catches: number; survive: boolean };
  type CampoNumerico = 'throws' | 'hits' | 'outs' | 'catches';
  type Row = { jugadorId?: string; jugadorPartidoId?: string; estadisticas: Stats; statId?: string };
  const [rowsLocal, setRowsLocal] = useState<Row[]>([]);
  const [rowsVisitante, setRowsVisitante] = useState<Row[]>([]);
  const [mapJpToStatId, setMapJpToStatId] = useState<Record<string, string>>({});
  const [visibilidad, setVisibilidad] = useState<VisibilidadEstadistica>('organizacion');
  const [permisos, setPermisos] = useState<PermisosPartido | null>(null);
  /**
   * Marca que hay números cargados que todavía no se guardaron, para que cerrar por backdrop o
   * Escape pida confirmación. En un celular el fondo del modal se toca sin querer todo el
   * tiempo, y perder una planilla entera de un set por un roce es el peor final posible.
   */
  const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false);

  // Mientras no sepamos los permisos asumimos que puede: el `null` inicial no tiene que ocultar
  // la grilla propia durante el primer render. El backend valida igual en cada request.
  const puedeCapturarLocal = permisos?.canCaptureStatsLocal ?? true;
  const puedeCapturarVisitante = permisos?.canCaptureStatsVisitante ?? true;

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
    if (!isOpen || !partidoId) {
      setPermisos(null);
      return;
    }
    let cancelado = false;
    getMisPermisosPartido(partidoId)
      .then((resp) => {
        if (!cancelado) setPermisos(resp);
      })
      .catch(() => {
        if (!cancelado) setPermisos(null);
      });
    return () => {
      cancelado = true;
    };
  }, [isOpen, partidoId]);

  // Abrir el modal de nuevo, o cambiar de set, arranca de cero: lo que había sin guardar ya se
  // descartó (o se guardó) antes de llegar acá.
  useEffect(() => {
    setHayCambiosSinGuardar(false);
  }, [isOpen, numeroSetSeleccionado]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    const cargarJugadoresPartido = async () => {
      try {
        const localId = extractEquipoId(partido?.equipoLocal);
        const visitanteId = extractEquipoId(partido?.equipoVisitante);
        if (!localId || !visitanteId) return;

        // Las opciones salen de la cascada del backend —convocatoria → lista de buena
        // fe → plantel vigente A LA FECHA DEL PARTIDO— y no del plantel crudo. Antes se
        // listaba /jugador-partido y, cuando no había convocatoria, la grilla caía al
        // plantel entero: aparecían contratos de años anteriores en partidos recientes.
        const [elegiblesLocal, elegiblesVisitante] = await Promise.all([
          obtenerJugadoresElegibles(partidoId, localId),
          obtenerJugadoresElegibles(partidoId, visitanteId),
        ]);
        if (cancelado) return;

        const mapa: Record<string, string> = {};
        const mapaReverse: Record<string, string> = {};

        const aOpciones = (elegibles: JugadoresElegibles) =>
          elegibles.jugadores.map((j) => {
            if (j.jugadorPartidoId) {
              mapa[j.jugadorPartidoId] = j.jugadorId;
              mapaReverse[j.jugadorId] = j.jugadorPartidoId;
            }
            return { value: j.jugadorId, label: j.nombre };
          });

        setOpcionesLocal(aOpciones(elegiblesLocal));
        setOpcionesVisitante(aOpciones(elegiblesVisitante));
        setMapJpToJugador(mapa);
        setMapJugadorToJp(mapaReverse);
        setInfoElegibles(elegiblesLocal);
      } catch (error) {
        console.warn('No se pudieron cargar los jugadores elegibles:', error);
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
    setHayCambiosSinGuardar(true);
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
    setHayCambiosSinGuardar(true);
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
    setHayCambiosSinGuardar(true);
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
        setHayCambiosSinGuardar(false);
        onClose();
        return;
      }

      // Fila ya validada: el filtrado de abajo garantiza que jugador y jugadorPartido existen.
      type FilaCompleta = Row & { jugadorId: string; jugadorPartidoId: string };
      const guardarFila = async (r: FilaCompleta, equipoId: string) => {
        const existingId = r.statId || mapJpToStatId[r.jugadorPartidoId];
        if (existingId) {
          await actualizarEstadisticaJugadorSet(existingId, {
            ...r.estadisticas,
            visibilidadObjetivo: visibilidad,
          });
          return;
        }
        // Doble chequeo: consultar existencia por (set, jugadorPartido) para evitar E11000
        const existentes = await obtenerEstadisticasJugadorSet({ set: setId, jugadorPartido: r.jugadorPartidoId });
        const yaExiste = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;
        if (yaExiste?._id) {
          await actualizarEstadisticaJugadorSet(yaExiste._id, {
            ...r.estadisticas,
            visibilidadObjetivo: visibilidad,
          });
          setMapJpToStatId((prev) => ({ ...prev, [r.jugadorPartidoId]: yaExiste._id }));
          return;
        }
        const creado = await crearEstadisticaJugadorSet({
          set: setId,
          jugadorPartido: r.jugadorPartidoId,
          jugador: r.jugadorId,
          equipo: equipoId,
          ...r.estadisticas,
          visibilidadObjetivo: visibilidad,
        });
        if (creado && creado._id) {
          setMapJpToStatId((prev) => ({ ...prev, [r.jugadorPartidoId]: creado._id }));
        }
      };

      // En paralelo y no en un `for` con `await` adentro: eran hasta 24 round-trips encadenados
      // contra un backend con cold starts, es decir minutos de "Guardando…" en una red de
      // gimnasio. Y con `allSettled` en vez de dejar que la primera excepción corte todo: antes
      // un jugador que fallaba abortaba el resto y el toast genérico no decía qué había quedado
      // guardado y qué no.
      const filas: Array<{ row: FilaCompleta; equipoId: string; nombre: string }> = [];
      const agregar = (rows: Row[], equipoId: string, opciones: Array<{ value: string; label: string }>) => {
        rows.forEach((r) => {
          if (!r?.jugadorId || !r?.jugadorPartidoId) return;
          filas.push({
            row: r as FilaCompleta,
            equipoId,
            nombre: opciones.find((o) => o.value === r.jugadorId)?.label ?? 'jugador',
          });
        });
      };
      if (puedeCapturarLocal) agregar(rowsLocal, localId, opcionesLocal);
      if (puedeCapturarVisitante) agregar(rowsVisitante, visitId, opcionesVisitante);

      const resultados = await Promise.allSettled(
        filas.map(({ row, equipoId }) => guardarFila(row, equipoId))
      );
      const fallidos = resultados
        .map((resultado, i) => (resultado.status === 'rejected' ? filas[i].nombre : null))
        .filter((nombre): nombre is string => nombre !== null);

      if (fallidos.length > 0) {
        addToast({
          type: 'error',
          title: `No se guardaron ${fallidos.length} de ${filas.length}`,
          message: `Falló: ${fallidos.join(', ')}. El resto quedó guardado; reintentá.`,
        });
      } else {
        addToast({ type: 'success', title: 'Guardado', message: 'Estadísticas del set guardadas' });
        setHayCambiosSinGuardar(false);
      }
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
  }, [addToast, numeroSetSeleccionado, onRefresh, partido?.equipoLocal, partido?.equipoVisitante, rowsLocal, rowsVisitante, sets, mapJpToStatId, esCompetencia, onClose, partidoId, visibilidad, puedeCapturarLocal, puedeCapturarVisitante, opcionesLocal, opcionesVisitante]);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Captura de estadísticas por set"
      hasUnsavedChanges={hayCambiosSinGuardar}
      unsavedMessage="Cargaste estadísticas que todavía no guardaste. ¿Cerrar y perderlas?"
    >

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

        {/* Sin esto el filtrado es invisible: alguien busca a un jugador, no lo
            encuentra y no tiene forma de saber si es por la fecha del contrato, por la
            categoría, o porque se olvidó de darlo de alta. */}
        {infoElegibles && (infoElegibles.excluidos.porFecha > 0 || infoElegibles.excluidos.porCategoria > 0) ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {infoElegibles.excluidos.porFecha > 0 ? (
              <p>
                {infoElegibles.excluidos.porFecha} jugador
                {infoElegibles.excluidos.porFecha === 1 ? '' : 'es'} sin contrato vigente a la fecha
                de este partido {infoElegibles.excluidos.porFecha === 1 ? 'no aparece' : 'no aparecen'} en
                la lista.
              </p>
            ) : null}
            {infoElegibles.excluidos.porCategoria > 0 ? (
              <p>
                {infoElegibles.excluidos.porCategoria} jugador
                {infoElegibles.excluidos.porCategoria === 1 ? '' : 'es'} fuera de la categoría{' '}
                {infoElegibles.categoria} de la competencia.
              </p>
            ) : null}
          </div>
        ) : null}

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
                  puedeEditarLocal={puedeCapturarLocal}
                  puedeEditarVisitante={puedeCapturarVisitante}
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
