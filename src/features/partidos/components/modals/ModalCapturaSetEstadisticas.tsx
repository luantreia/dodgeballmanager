import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { useDebouncedCallback } from '../../../../shared/hooks/useDebouncedCallback';
import { socket } from '../../../../shared/services/socket';
import { getAccessToken } from '../../../../shared/utils/authFetch';
import EquiposEstadisticas from './EquipoEstadisticas';
import type { EstadoGuardadoFila } from '../common/JugadorEstadisticasCard';
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
  pedirOficialSet,
  intercambiarEstadisticasSet,
  getMisPermisosPartido,
  type PermisosPartido,
  type VisibilidadEstadistica,
  type EstadisticasJugadorSet,
} from '../../services/partidoService';
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

type Stats = { throws: number; hits: number; outs: number; catches: number; survive: boolean };
type CampoNumerico = 'throws' | 'hits' | 'outs' | 'catches';
type Row = { jugadorId?: string; jugadorPartidoId?: string; estadisticas: Stats; statId?: string };
type Lado = 'local' | 'visitante';

/**
 * Captura de estadísticas set a set, con el mismo UX que "Mi planilla"
 * (ModalPlanillaEquipo): autoguardado por fila, colaboración en vivo por socket,
 * intercambio de números entre jugadores e indicador de guardado por fila. La
 * diferencia con la planilla es que acá hay DOS lados (local y visitante) en la misma
 * pantalla — cada uno con su propia sala de socket y su propio "Pedir oficial", porque
 * `stats.capture` es un permiso por equipo: normalmente sólo se edita un lado.
 *
 * El autoguardado escribe siempre la fila real (nace 'privada' o retoma lo que ya
 * había); nunca dispara por sí solo una `SolicitudEdicion`. "Pedir oficial" es el único
 * gatillo — junta lo autoguardado de {set, equipo} y arma la solicitud de una sola vez,
 * en vez de que el organizador vea el pedido cambiar mientras el DT todavía tipea.
 */
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
  const [infoElegibles, setInfoElegibles] = useState<JugadoresElegibles | null>(null);
  const [visibilidad, setVisibilidad] = useState<VisibilidadEstadistica>('organizacion');
  const [permisos, setPermisos] = useState<PermisosPartido | null>(null);
  const [pidiendoOficial, setPidiendoOficial] = useState(false);

  const [rowsLocal, setRowsLocal] = useState<Row[]>([]);
  const [rowsVisitante, setRowsVisitante] = useState<Row[]>([]);
  const [mapJpToStatId, setMapJpToStatId] = useState<Record<string, string>>({});

  /** Autoguardado por fila, un mapa por lado — mismo patrón que ModalPlanillaEquipo. */
  const [filasGuardandoLocal, setFilasGuardandoLocal] = useState<Record<number, EstadoGuardadoFila>>({});
  const [filasGuardandoVisitante, setFilasGuardandoVisitante] = useState<Record<number, EstadoGuardadoFila>>({});

  /** Con quién intercambiar: sólo tiene sentido dentro del mismo lado. */
  const [intercambioAbierto, setIntercambioAbierto] = useState<{ equipo: Lado; index: number } | null>(null);

  // Mientras no sepamos los permisos asumimos que puede: el `null` inicial no tiene que ocultar
  // la grilla propia durante el primer render. El backend valida igual en cada request.
  const puedeCapturarLocal = permisos?.canCaptureStatsLocal ?? true;
  const puedeCapturarVisitante = permisos?.canCaptureStatsVisitante ?? true;

  const setsOrdenados = useMemo(() => [...sets].sort((a, b) => a.numeroSet - b.numeroSet), [sets]);
  const setActivo = useMemo(
    () => sets.find((s) => String(s.numeroSet) === String(numeroSetSeleccionado)) ?? null,
    [sets, numeroSetSeleccionado],
  );

  const equipoLocalId = useMemo(() => extractEquipoId(partido?.equipoLocal) ?? '', [partido]);
  const equipoVisitanteId = useMemo(() => extractEquipoId(partido?.equipoVisitante) ?? '', [partido]);

  // Refs para leer el estado más fresco desde callbacks que no pueden depender de él sin
  // volver a crearse en cada tecla (el debounce por fila y los listeners de socket).
  const rowsLocalRef = useRef(rowsLocal);
  rowsLocalRef.current = rowsLocal;
  const rowsVisitanteRef = useRef(rowsVisitante);
  rowsVisitanteRef.current = rowsVisitante;
  const filasGuardandoLocalRef = useRef(filasGuardandoLocal);
  filasGuardandoLocalRef.current = filasGuardandoLocal;
  const filasGuardandoVisitanteRef = useRef(filasGuardandoVisitante);
  filasGuardandoVisitanteRef.current = filasGuardandoVisitante;
  const mapJpToStatIdRef = useRef(mapJpToStatId);
  mapJpToStatIdRef.current = mapJpToStatId;
  const setActivoRef = useRef(setActivo);
  setActivoRef.current = setActivo;

  const hayCambiosSinGuardar = useMemo(
    () =>
      Object.values(filasGuardandoLocal).some((e) => e !== 'guardado') ||
      Object.values(filasGuardandoVisitante).some((e) => e !== 'guardado'),
    [filasGuardandoLocal, filasGuardandoVisitante],
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

  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    const cargarJugadoresPartido = async () => {
      try {
        if (!equipoLocalId || !equipoVisitanteId) return;

        const [elegiblesLocal, elegiblesVisitante] = await Promise.all([
          obtenerJugadoresElegibles(partidoId, equipoLocalId),
          obtenerJugadoresElegibles(partidoId, equipoVisitanteId),
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
  }, [isOpen, partidoId, equipoLocalId, equipoVisitanteId]);

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
          if (equipoId === equipoLocalId) aLocal.push(row);
          else if (equipoId === equipoVisitanteId) aVisit.push(row);
        });

        const slotVacio = (): Row => ({ estadisticas: { ...ESTADISTICAS_SLOT_VACIO } });

        setRowsLocal(completarSlots(aLocal, slotVacio));
        setRowsVisitante(completarSlots(aVisit, slotVacio));
        setMapJpToStatId(statMap);
        setFilasGuardandoLocal({});
        setFilasGuardandoVisitante({});
      } catch (err) {
        console.error('Error cargando estadísticas del set:', err);
      }
    };
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [isOpen, numeroSetSeleccionado, equipoLocalId, equipoVisitanteId, sets]);

  /**
   * Colaboración en vivo: una sala por {set, equipo}, y sólo para los lados que el
   * usuario puede capturar — no tiene sentido escuchar en vivo lo que teclea el rival
   * en un lado que ni siquiera se muestra en pantalla.
   */
  useEffect(() => {
    const setId = setActivo?._id;
    if (!setId) return;

    const ladosAUnirse: Array<{ lado: Lado; equipoId: string }> = [];
    if (puedeCapturarLocal && equipoLocalId) ladosAUnirse.push({ lado: 'local', equipoId: equipoLocalId });
    if (puedeCapturarVisitante && equipoVisitanteId) ladosAUnirse.push({ lado: 'visitante', equipoId: equipoVisitanteId });
    if (ladosAUnirse.length === 0) return;

    const unirse = () => {
      ladosAUnirse.forEach(({ equipoId }) => {
        socket.emit('set:join', { setId, equipoId, token: getAccessToken() });
      });
    };

    const aplicarFilasRemotas = (lado: Lado, filas: EstadisticasJugadorSet[]) => {
      const rowsRef = lado === 'local' ? rowsLocalRef : rowsVisitanteRef;
      const filasGuardandoRef = lado === 'local' ? filasGuardandoLocalRef : filasGuardandoVisitanteRef;
      const setRows = lado === 'local' ? setRowsLocal : setRowsVisitante;

      setMapJpToStatId((prev) => {
        const next = { ...prev };
        filas.forEach((f) => {
          next[f.jugadorPartido] = f._id;
        });
        return next;
      });

      setRows((prev) => {
        let next = prev;
        let cambio = false;
        filas.forEach((fila) => {
          const idxExistente = rowsRef.current.findIndex((r) => r.jugadorPartidoId === fila.jugadorPartido);
          const estadoLocal = idxExistente >= 0 ? filasGuardandoRef.current[idxExistente] : undefined;
          // No pisar una fila que YO tengo pendiente o en vuelo.
          if (estadoLocal === 'pendiente' || estadoLocal === 'guardando') return;

          const estadisticasNuevas: Stats = {
            throws: fila.throws ?? 0,
            hits: fila.hits ?? 0,
            outs: fila.outs ?? 0,
            catches: fila.catches ?? 0,
            survive: Boolean(fila.survive),
          };

          if (idxExistente >= 0) {
            if (!cambio) next = [...next];
            cambio = true;
            next[idxExistente] = { ...next[idxExistente], statId: fila._id, estadisticas: estadisticasNuevas };
            return;
          }

          const jugadorId = mapJpToJugador[fila.jugadorPartido] ?? fila.jugador;
          const idxVacio = next.findIndex((r) => !r.jugadorPartidoId);
          if (idxVacio === -1) return;
          if (!cambio) next = [...next];
          cambio = true;
          next[idxVacio] = {
            jugadorId,
            jugadorPartidoId: fila.jugadorPartido,
            statId: fila._id,
            estadisticas: estadisticasNuevas,
          };
        });
        return cambio ? next : prev;
      });
    };

    const alEstadisticasActualizadas = (payload: { setId: string; equipoId: string; estadisticas: EstadisticasJugadorSet[] }) => {
      if (payload.setId !== setId) return;
      if (payload.equipoId === equipoLocalId) aplicarFilasRemotas('local', payload.estadisticas);
      else if (payload.equipoId === equipoVisitanteId) aplicarFilasRemotas('visitante', payload.estadisticas);
    };

    const alEstadisticaEliminada = (payload: { setId: string; equipoId: string; jugadorPartido: string }) => {
      if (payload.setId !== setId) return;
      const lado: Lado | null =
        payload.equipoId === equipoLocalId ? 'local' : payload.equipoId === equipoVisitanteId ? 'visitante' : null;
      if (!lado) return;
      const rowsRef = lado === 'local' ? rowsLocalRef : rowsVisitanteRef;
      const filasGuardandoRef = lado === 'local' ? filasGuardandoLocalRef : filasGuardandoVisitanteRef;
      const setRows = lado === 'local' ? setRowsLocal : setRowsVisitante;

      setRows((prev) => {
        const idx = rowsRef.current.findIndex((r) => r.jugadorPartidoId === payload.jugadorPartido);
        if (idx === -1) return prev;
        const estadoLocal = filasGuardandoRef.current[idx];
        if (estadoLocal === 'pendiente' || estadoLocal === 'guardando') return prev;
        const next = [...prev];
        next[idx] = { estadisticas: { ...ESTADISTICAS_SLOT_VACIO } };
        return next;
      });
    };

    socket.on('connect', unirse);
    socket.on('set:estadisticas_actualizadas', alEstadisticasActualizadas);
    socket.on('set:estadistica_eliminada', alEstadisticaEliminada);
    if (socket.connected) unirse();
    else socket.connect();

    return () => {
      ladosAUnirse.forEach(({ equipoId }) => socket.emit('set:leave', { setId, equipoId }));
      socket.off('connect', unirse);
      socket.off('set:estadisticas_actualizadas', alEstadisticasActualizadas);
      socket.off('set:estadistica_eliminada', alEstadisticaEliminada);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActivo?._id, equipoLocalId, equipoVisitanteId, puedeCapturarLocal, puedeCapturarVisitante, mapJpToJugador]);

  /** Guarda UNA fila — la clave del autoguardado. Crea si hace falta, actualiza si ya existe. */
  const guardarFilaAhora = useCallback(
    async (lado: Lado, index: number) => {
      const setId = setActivoRef.current?._id;
      const rowsRef = lado === 'local' ? rowsLocalRef : rowsVisitanteRef;
      const setFilasGuardando = lado === 'local' ? setFilasGuardandoLocal : setFilasGuardandoVisitante;
      const equipoId = lado === 'local' ? equipoLocalId : equipoVisitanteId;
      const row = rowsRef.current[index];
      if (!setId || !row?.jugadorId || !row?.jugadorPartidoId || !equipoId) return;

      setFilasGuardando((prev) => ({ ...prev, [index]: 'guardando' }));
      try {
        const existingId = row.statId || mapJpToStatIdRef.current[row.jugadorPartidoId];
        let statId = existingId;

        if (existingId) {
          await actualizarEstadisticaJugadorSet(existingId, { ...row.estadisticas, visibilidadObjetivo: visibilidad });
        } else {
          const existentes = await obtenerEstadisticasJugadorSet({ set: setId, jugadorPartido: row.jugadorPartidoId });
          const yaExiste = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;
          if (yaExiste?._id) {
            await actualizarEstadisticaJugadorSet(yaExiste._id, { ...row.estadisticas, visibilidadObjetivo: visibilidad });
            statId = yaExiste._id;
          } else {
            const creado = await crearEstadisticaJugadorSet({
              set: setId,
              jugadorPartido: row.jugadorPartidoId,
              jugador: row.jugadorId,
              equipo: equipoId,
              ...row.estadisticas,
              visibilidadObjetivo: visibilidad,
            });
            statId = creado._id;
          }
        }

        if (statId) {
          setMapJpToStatId((prev) => ({ ...prev, [row.jugadorPartidoId as string]: statId as string }));
          const rowsSetter = lado === 'local' ? setRowsLocal : setRowsVisitante;
          rowsSetter((prev) => {
            const next = [...prev];
            if (next[index]) next[index] = { ...next[index], statId };
            return next;
          });
        }
        setFilasGuardando((prev) => ({ ...prev, [index]: 'guardado' }));
      } catch (error) {
        setFilasGuardando((prev) => ({ ...prev, [index]: 'error' }));
        addToast({
          type: 'error',
          title: 'No se guardó una fila',
          message: error instanceof Error ? error.message : 'Reintentá tocando algo de esa fila',
        });
      }
    },
    [addToast, equipoLocalId, equipoVisitanteId, visibilidad],
  );

  const { debounced: programarGuardadoFila, flushAll: flushAllFilas } = useDebouncedCallback(
    (clave: string) => {
      const [lado, indexStr] = clave.split(':');
      void guardarFilaAhora(lado as Lado, Number(indexStr));
    },
    600,
  );

  useEffect(() => () => flushAllFilas(), [flushAllFilas]);

  const marcarPendienteYGuardar = useCallback(
    (lado: Lado, index: number) => {
      const setFilasGuardando = lado === 'local' ? setFilasGuardandoLocal : setFilasGuardandoVisitante;
      setFilasGuardando((prev) => ({ ...prev, [index]: 'pendiente' }));
      programarGuardadoFila(`${lado}:${index}`);
    },
    [programarGuardadoFila],
  );

  const cambiarEstadistica = useCallback(
    (equipoIdTocado: string, idx: number, campo: CampoNumerico, delta: number) => {
      const lado: Lado = equipoIdTocado === equipoLocalId ? 'local' : 'visitante';
      const setter = lado === 'local' ? setRowsLocal : setRowsVisitante;
      setter((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { ...ESTADISTICAS_SLOT_VACIO } };
        const value = (cur.estadisticas[campo] ?? 0) + delta;
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, [campo]: Math.max(0, value) } };
        return next;
      });
      marcarPendienteYGuardar(lado, idx);
    },
    [equipoLocalId, marcarPendienteYGuardar],
  );

  const cambiarSurvive = useCallback(
    (equipoIdTocado: string, idx: number, value: boolean) => {
      const lado: Lado = equipoIdTocado === equipoLocalId ? 'local' : 'visitante';
      const setter = lado === 'local' ? setRowsLocal : setRowsVisitante;
      setter((prev) => {
        const next = [...prev];
        const cur = next[idx] ?? { estadisticas: { ...ESTADISTICAS_SLOT_VACIO } };
        next[idx] = { ...cur, estadisticas: { ...cur.estadisticas, survive: value } };
        return next;
      });
      marcarPendienteYGuardar(lado, idx);
    },
    [equipoLocalId, marcarPendienteYGuardar],
  );

  const onAsignarJugador = useCallback(
    (equipo: Lado, index: number, jugadorId: string) => {
      const setter = equipo === 'local' ? setRowsLocal : setRowsVisitante;
      setter((prev) => {
        const next = [...prev];
        const jpId = mapJugadorToJp[jugadorId] ?? jugadorId;
        const cur = next[index] ?? { estadisticas: { ...ESTADISTICAS_SLOT_VACIO } };
        next[index] = { ...cur, jugadorId, jugadorPartidoId: jpId, statId: cur.statId && cur.jugadorPartidoId === jpId ? cur.statId : undefined };
        return next;
      });
      const setFilasGuardando = equipo === 'local' ? setFilasGuardandoLocal : setFilasGuardandoVisitante;
      setFilasGuardando((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      if (jugadorId) marcarPendienteYGuardar(equipo, index);
    },
    [mapJugadorToJp, marcarPendienteYGuardar],
  );

  const solicitarIntercambio = useCallback((equipo: Lado, index: number) => {
    const rows = equipo === 'local' ? rowsLocalRef.current : rowsVisitanteRef.current;
    if (!rows[index]?.jugadorPartidoId) return;
    setIntercambioAbierto({ equipo, index });
  }, []);

  const confirmarIntercambio = useCallback(
    async (indexB: number) => {
      if (!intercambioAbierto) return;
      const { equipo, index: indexA } = intercambioAbierto;
      const setId = setActivoRef.current?._id;
      const rows = equipo === 'local' ? rowsLocalRef.current : rowsVisitanteRef.current;
      const jpA = rows[indexA]?.jugadorPartidoId;
      const jpB = rows[indexB]?.jugadorPartidoId;
      setIntercambioAbierto(null);
      if (!setId || !jpA || !jpB) return;

      const setFilasGuardando = equipo === 'local' ? setFilasGuardandoLocal : setFilasGuardandoVisitante;
      setFilasGuardando((prev) => ({ ...prev, [indexA]: 'guardando', [indexB]: 'guardando' }));

      try {
        const { jugadorPartidoA: resultA, jugadorPartidoB: resultB } = await intercambiarEstadisticasSet(setId, {
          jugadorPartidoA: jpA,
          jugadorPartidoB: jpB,
        });
        const setter = equipo === 'local' ? setRowsLocal : setRowsVisitante;
        setter((prev) => {
          const next = [...prev];
          if (next[indexA]) {
            next[indexA] = {
              ...next[indexA],
              statId: resultB?._id,
              estadisticas: resultB
                ? { throws: resultB.throws, hits: resultB.hits, outs: resultB.outs, catches: resultB.catches, survive: Boolean(resultB.survive) }
                : { ...ESTADISTICAS_SLOT_VACIO },
            };
          }
          if (next[indexB]) {
            next[indexB] = {
              ...next[indexB],
              statId: resultA?._id,
              estadisticas: resultA
                ? { throws: resultA.throws, hits: resultA.hits, outs: resultA.outs, catches: resultA.catches, survive: Boolean(resultA.survive) }
                : { ...ESTADISTICAS_SLOT_VACIO },
            };
          }
          return next;
        });
        setFilasGuardando((prev) => ({ ...prev, [indexA]: 'guardado', [indexB]: 'guardado' }));
      } catch (error) {
        setFilasGuardando((prev) => ({ ...prev, [indexA]: 'error', [indexB]: 'error' }));
        addToast({
          type: 'error',
          title: 'No se pudo intercambiar',
          message: error instanceof Error ? error.message : 'Error inesperado',
        });
      }
    },
    [intercambioAbierto, addToast],
  );

  const pedirOficial = useCallback(async () => {
    if (!setActivo) {
      addToast({ type: 'info', title: 'Elegí un set', message: 'Seleccioná un set antes de pedir oficial' });
      return;
    }
    flushAllFilas();
    setPidiendoOficial(true);
    try {
      const lados: Array<{ equipo: string; editable: boolean }> = [
        { equipo: equipoLocalId, editable: puedeCapturarLocal },
        { equipo: equipoVisitanteId, editable: puedeCapturarVisitante },
      ].filter((l) => l.editable && l.equipo);

      if (lados.length === 0) {
        addToast({ type: 'info', title: 'Nada para pedir', message: 'No tenés permiso de captura sobre ningún equipo de este partido' });
        return;
      }

      const resultados = await Promise.allSettled(
        lados.map((l) => pedirOficialSet(setActivo._id, { equipo: l.equipo, visibilidadObjetivo: visibilidad })),
      );

      const fallidos = resultados.filter((r) => r.status === 'rejected').length;
      const totalPedidas = resultados.reduce(
        (acc, r) => acc + (r.status === 'fulfilled' ? r.value.pedidas : 0),
        0,
      );

      if (fallidos > 0) {
        addToast({ type: 'error', title: 'Hubo un problema', message: `${fallidos} de ${lados.length} pedido(s) fallaron` });
      } else if (totalPedidas === 0) {
        addToast({ type: 'info', title: 'Nada nuevo para pedir', message: 'Ya estaba todo pedido u oficializado' });
      } else {
        addToast({
          type: 'success',
          title: 'Pedido enviado',
          message: esCompetencia
            ? 'La organización tiene que aprobarlo para que pase a ser dato oficial.'
            : 'Como es un amistoso, se aplicó directo — no hacía falta aprobación.',
        });
      }
      await Promise.resolve(onRefresh?.());
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo pedir la oficialización',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setPidiendoOficial(false);
    }
  }, [setActivo, equipoLocalId, equipoVisitanteId, puedeCapturarLocal, puedeCapturarVisitante, visibilidad, esCompetencia, flushAllFilas, onRefresh, addToast]);

  const equiposDelSet = useMemo(
    () => ({ [equipoLocalId || 'local']: rowsLocal, [equipoVisitanteId || 'visitante']: rowsVisitante }) as Record<string, Row[]>,
    [equipoLocalId, equipoVisitanteId, rowsLocal, rowsVisitante],
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Captura de estadísticas por set"
      hasUnsavedChanges={hayCambiosSinGuardar}
      unsavedMessage="Hay filas que todavía no se terminaron de guardar. ¿Cerrar igual?"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {numeroSetSeleccionado ? `Set ${numeroSetSeleccionado}` : 'Ningún set seleccionado'}
            {hayCambiosSinGuardar ? ' · guardando…' : ''}
          </p>
          <button
            type="button"
            onClick={() => void pedirOficial()}
            disabled={pidiendoOficial || !numeroSetSeleccionado}
            className="min-h-[2.75rem] w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold
                       text-white shadow-sm transition [touch-action:manipulation]
                       hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {pidiendoOficial ? 'Pidiendo…' : 'Pedir oficial'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-1 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="selectSet" className="text-sm font-medium text-slate-700">Seleccioná un set</label>
          <select
            id="selectSet"
            value={numeroSetSeleccionado}
            onChange={(e) => {
              flushAllFilas();
              setNumeroSetSeleccionado(e.target.value);
            }}
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
        </div>

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
              const equipoLocalNombre = extractEquipoNombre(partido?.equipoLocal, 'Equipo Local');
              const equipoVisitanteNombre = extractEquipoNombre(partido?.equipoVisitante, 'Equipo Visitante');
              const local = (equiposDelSet[equipoLocalId || 'local'] ?? []) as Row[];
              const visitante = (equiposDelSet[equipoVisitanteId || 'visitante'] ?? []) as Row[];
              return (
                <EquiposEstadisticas
                  equipoLocal={{ _id: equipoLocalId || 'local', nombre: equipoLocalNombre }}
                  equipoVisitante={{ _id: equipoVisitanteId || 'visitante', nombre: equipoVisitanteNombre }}
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
                  estadosGuardadoLocal={local.map((_, i) => filasGuardandoLocal[i])}
                  estadosGuardadoVisitante={visitante.map((_, i) => filasGuardandoVisitante[i])}
                  onSolicitarIntercambio={solicitarIntercambio}
                />
              );
            })()}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="block text-sm font-medium text-slate-700" htmlFor="visibilidad-estadisticas">
                ¿Quién puede ver estas estadísticas al pedir oficial?
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
                {esCompetencia
                  ? 'La organización tiene que aprobar el pedido para que se aplique.'
                  : 'Al ser un amistoso, se aplica directo al pedir oficial: no pasa por aprobación de ningún organizador.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <ModalBase
        isOpen={intercambioAbierto !== null}
        onClose={() => setIntercambioAbierto(null)}
        title="Intercambiar con otro jugador"
        size="sm"
      >
        {intercambioAbierto !== null && (
          <div className="space-y-2 p-1">
            <p className="text-sm text-slate-700">
              Elegí con quién intercambiar los números de este slot. Ninguno de los dos cambia de
              jugador — sólo se cruzan los números.
            </p>
            {(intercambioAbierto.equipo === 'local' ? rowsLocal : rowsVisitante).map((r, i) => {
              if (i === intercambioAbierto.index || !r.jugadorPartidoId) return null;
              const opciones = intercambioAbierto.equipo === 'local' ? opcionesLocal : opcionesVisitante;
              const nombre = opciones.find((o) => o.value === r.jugadorId)?.label ?? 'Jugador';
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => void confirmarIntercambio(i)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  {nombre}
                </button>
              );
            })}
            {(intercambioAbierto.equipo === 'local' ? rowsLocal : rowsVisitante).every(
              (r, i) => i === intercambioAbierto.index || !r.jugadorPartidoId,
            ) && <p className="text-xs text-slate-500">Todavía no hay otro slot con jugador asignado.</p>}
          </div>
        )}
      </ModalBase>
    </ModalBase>
  );
};

export default ModalCapturaSetEstadisticas;
