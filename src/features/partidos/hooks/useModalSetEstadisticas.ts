import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getEstadisticasJugadorSet,
  getJugadoresPartido,
  crearEstadisticaJugadorSet,
  actualizarEstadisticaJugadorSet,
  buscarEstadisticaJugadorSet,
  type EstadisticaJugadorSetDetalle,
} from '../../estadisticas/services/estadisticasService';
import { obtenerSetsDePartido } from '../services/partidoService';
import type { SetPartido } from '../services/partidoService';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

export type JugadorSet = {
  estadisticaId?: string;
  jugadorId?: string;
  jugadorPartidoId?: string;
  equipoId?: string;
  estadisticas: Record<string, number>;
};

export type JugadoresPorSet = Record<string, Record<string, JugadorSet[]>>;

type UseModalSetEstadisticasParams = {
  partidoId: string;
  numeroSetSeleccionado: string;
  estadisticasSet?: SetPartido | null;
  setsLocales: SetPartido[];
  actualizarSetSeleccionado: (cambios: Partial<SetPartido>) => void;
  refrescarPartidoSeleccionado: () => Promise<void> | void;
  actualizarSetDePartido?: (numeroSet: number, cambios: Partial<SetPartido>) => Promise<SetPartido | null | undefined>;
};

type UseModalSetEstadisticasReturn = {
  serviciosCargados: boolean;
  jugadoresPorSet: JugadoresPorSet;
  equiposDelSet: Record<string, JugadorSet[]>;
  guardar: () => Promise<void>;
  guardando: boolean;
  asignarJugador: (index: number, jugadorId: string, equipoId: string) => void;
  cambiarEstadistica: (equipoId: string, index: number, campo: string, delta: number) => void;
  copiarJugadoresDeSetAnterior: () => void;
  mostrarConfirmacionManual: boolean;
  estadisticasManualesDetectadas: boolean;
  setDataPendiente: unknown;
  confirmarRecalculo: () => void;
  cancelarRecalculo: () => void;
};

const ESTADISTICAS_BASE = {
  throws: 0,
  hits: 0,
  outs: 0,
  catches: 0,
};

const normalizarNumero = (valor: string): number | null => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const buildJugadoresDesdeDetalle = (detalle: EstadisticaJugadorSetDetalle | undefined): JugadorSet => {
  const jugadorPartidoId = typeof detalle?.jugadorPartido === 'object'
    ? detalle?.jugadorPartido?._id
    : typeof detalle?.jugadorPartido === 'string'
      ? detalle?.jugadorPartido
      : undefined;

  const equipoId = typeof detalle?.equipo === 'object'
    ? detalle?.equipo?._id
    : typeof detalle?.equipo === 'string'
      ? detalle?.equipo
      : undefined;

  return {
    estadisticaId: detalle?._id,
    jugadorId: jugadorPartidoId,
    jugadorPartidoId,
    equipoId,
    estadisticas: {
      throws: detalle?.throws ?? 0,
      hits: detalle?.hits ?? 0,
      outs: detalle?.outs ?? 0,
      catches: detalle?.catches ?? 0,
    },
  };
};

const mergeJugador = (jugador: JugadorSet | undefined): JugadorSet => ({
  estadisticaId: jugador?.estadisticaId,
  jugadorId: jugador?.jugadorId,
  jugadorPartidoId: jugador?.jugadorPartidoId,
  equipoId: jugador?.equipoId,
  estadisticas: {
    ...ESTADISTICAS_BASE,
    ...jugador?.estadisticas,
  },
});

const construirMapaInicial = (detalle?: SetPartido | null): Record<string, JugadorSet[]> => {
  if (!detalle?.estadisticas || !Array.isArray(detalle.estadisticas)) {
    return {};
  }

  return detalle.estadisticas.reduce<Record<string, JugadorSet[]>>((acc, current) => {
    const jugador = buildJugadoresDesdeDetalle(current as unknown as EstadisticaJugadorSetDetalle);
    if (!jugador.equipoId) {
      return acc;
    }

    if (!acc[jugador.equipoId]) {
      acc[jugador.equipoId] = [];
    }

    acc[jugador.equipoId].push(mergeJugador(jugador));
    return acc;
  }, {});
};

export const useModalSetEstadisticas = ({
  partidoId,
  numeroSetSeleccionado,
  estadisticasSet,
  setsLocales,
  actualizarSetSeleccionado,
  refrescarPartidoSeleccionado,
  actualizarSetDePartido,
}: UseModalSetEstadisticasParams): UseModalSetEstadisticasReturn => {
  const { addToast } = useToast();
  const [serviciosCargados, setServiciosCargados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [jugadoresPorSet, setJugadoresPorSet] = useState<JugadoresPorSet>({});
  const [mostrarConfirmacionManual] = useState(false);
  const [estadisticasManualesDetectadas] = useState(false);
  const [setDataPendiente] = useState<null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const mapaSetNumeroIdRef = useRef<Record<number, string>>({});
  const [mapJpToJugador, setMapJpToJugador] = useState<Record<string, string>>({});
  const existingByJpRef = useRef<Record<string, string>>({});

  const setKey = numeroSetSeleccionado || 'sin-set';

  const registrarSetsEnMapa = useCallback((sets: Array<Pick<SetPartido, '_id' | 'numeroSet'>>) => {
    if (!sets.length) return;

    let cambio = false;
    const mapaActual = mapaSetNumeroIdRef.current;

    sets.forEach((set) => {
      if (set._id && mapaActual[set.numeroSet] !== set._id) {
        mapaActual[set.numeroSet] = set._id;
        cambio = true;
      }
    });

    if (cambio) {
      setMapVersion((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;

    const cargarSets = async (): Promise<void> => {
      try {
        const sets = await obtenerSetsDePartido(partidoId);
        if (cancelado) return;

        registrarSetsEnMapa(sets);
      } catch (error) {
        console.warn('No se pudieron cargar los sets del partido:', error);
      }
    };

    void cargarSets();

    return () => {
      cancelado = true;
    };
  }, [partidoId]);

  useEffect(() => {
    let cancelado = false;
    const cargarJugadores = async (): Promise<void> => {
      try {
        const data = await getJugadoresPartido(partidoId);
        if (cancelado) return;
        const mapa: Record<string, string> = {};
        data.forEach((jp) => {
          const jpId = jp._id;
          const jugadorId = typeof jp.jugador === 'string' ? jp.jugador : jp.jugador?._id;
          if (jpId && jugadorId) {
            mapa[jpId] = jugadorId;
          }
        });
        setMapJpToJugador(mapa);
      } catch (e) {
        // noop
      }
    };
    void cargarJugadores();
    return () => {
      cancelado = true;
    };
  }, [partidoId]);

  useEffect(() => {
    if (!setsLocales.length) return;
    registrarSetsEnMapa(setsLocales);
  }, [registrarSetsEnMapa, setsLocales]);

  useEffect(() => {
    let cancelado = false;

    const cargarEstadisticas = async (): Promise<void> => {
      const numeroSet = normalizarNumero(numeroSetSeleccionado);
      if (!numeroSet) {
        setJugadoresPorSet({});
        setServiciosCargados(true);
        return;
      }

      const setIdLocal = typeof estadisticasSet?._id === 'string' ? estadisticasSet._id : undefined;
      const mapaActual = mapaSetNumeroIdRef.current;
      const setId = mapaActual[numeroSet] ?? setIdLocal;

      if (setIdLocal && mapaActual[numeroSet] !== setIdLocal) {
        mapaActual[numeroSet] = setIdLocal;
        setMapVersion((prev) => prev + 1);
      }

      if (!setId) {
        setJugadoresPorSet({ [setKey]: construirMapaInicial(estadisticasSet) });
        setServiciosCargados(true);
        return;
      }

      setServiciosCargados(false);

      try {
        const data = await getEstadisticasJugadorSet(setId);
        if (cancelado) return;

        const agrupado = data.reduce<Record<string, JugadorSet[]>>((acc, detalle) => {
          const jugador = buildJugadoresDesdeDetalle(detalle);
          if (!jugador.equipoId) return acc;
          if (!acc[jugador.equipoId]) acc[jugador.equipoId] = [];
          acc[jugador.equipoId].push(mergeJugador(jugador));
          return acc;
        }, {});

        const mapExistentes: Record<string, string> = {};
        data.forEach((detalle) => {
          const jpId = typeof detalle?.jugadorPartido === 'object'
            ? detalle.jugadorPartido?._id
            : typeof detalle?.jugadorPartido === 'string'
              ? detalle.jugadorPartido
              : undefined;
          if (jpId && detalle?._id) {
            mapExistentes[jpId] = detalle._id;
          }
        });
        existingByJpRef.current = mapExistentes;

        const fallback = Object.keys(agrupado).length > 0 ? agrupado : construirMapaInicial(estadisticasSet);

        setJugadoresPorSet({ [setKey]: fallback });
      } catch (error) {
        console.warn('No se pudieron cargar las estadísticas del set:', error);
        setJugadoresPorSet({ [setKey]: construirMapaInicial(estadisticasSet) });
      } finally {
        if (!cancelado) {
          setServiciosCargados(true);
        }
      }
    };

    void cargarEstadisticas();

    return () => {
      cancelado = true;
    };
  }, [estadisticasSet, numeroSetSeleccionado, partidoId, setKey, mapVersion]);

  const equiposDelSet = useMemo<Record<string, JugadorSet[]>>(() => jugadoresPorSet[setKey] ?? {}, [jugadoresPorSet, setKey]);

  const asignarJugador = useCallback((index: number, jugadorId: string, equipoId: string) => {
    setJugadoresPorSet((prev) => {
      const actual = prev[setKey] ?? {};
      const jugadores = actual[equipoId]?.slice() ?? [];
      const existente = jugadores[index];
      jugadores[index] = mergeJugador({
        ...existente,
        jugadorId,
        jugadorPartidoId: jugadorId,
        equipoId,
      });

      return {
        ...prev,
        [setKey]: {
          ...actual,
          [equipoId]: jugadores,
        },
      };
    });
  }, [setKey]);

  const cambiarEstadistica = useCallback((equipoId: string, index: number, campo: string, delta: number) => {
    setJugadoresPorSet((prev) => {
      const actual = prev[setKey] ?? {};
      const jugadores = actual[equipoId]?.slice() ?? [];
      const existente = mergeJugador(jugadores[index]);
      const valorAnterior = Number(existente.estadisticas[campo] ?? 0);
      const nuevoValor = Math.max(0, valorAnterior + delta);

      jugadores[index] = {
        ...existente,
        estadisticas: {
          ...existente.estadisticas,
          [campo]: nuevoValor,
        },
      };

      return {
        ...prev,
        [setKey]: {
          ...actual,
          [equipoId]: jugadores,
        },
      };
    });
  }, [setKey]);

  const copiarJugadoresDeSetAnterior = useCallback(() => {
    const numeroActual = normalizarNumero(numeroSetSeleccionado);
    if (!numeroActual) return;

    const setAnterior = [...setsLocales]
      .filter((set) => set.numeroSet < numeroActual)
      .sort((a, b) => b.numeroSet - a.numeroSet)[0];

    if (!setAnterior) return;

    const setAnteriorId = typeof setAnterior._id === 'string'
      ? setAnterior._id
      : mapaSetNumeroIdRef.current[setAnterior.numeroSet];

    if (setAnteriorId) {
      void (async () => {
        try {
          const data = await getEstadisticasJugadorSet(setAnteriorId);
          const agrupado = data.reduce<Record<string, JugadorSet[]>>((acc, detalle) => {
            const jugador = buildJugadoresDesdeDetalle(detalle);
            if (!jugador.equipoId) return acc;
            if (!acc[jugador.equipoId]) acc[jugador.equipoId] = [];
            acc[jugador.equipoId].push(
              mergeJugador({
                ...jugador,
                estadisticaId: undefined,
                estadisticas: { ...ESTADISTICAS_BASE },
              }),
            );
            return acc;
          }, {});

          setJugadoresPorSet((prev) => ({
            ...prev,
            [setKey]: agrupado,
          }));
        } catch {
          const mapaAnterior = construirMapaInicial(setAnterior);
          setJugadoresPorSet((prev) => ({
            ...prev,
            [setKey]: mapaAnterior,
          }));
        }
      })();
    } else {
      const mapaAnterior = construirMapaInicial(setAnterior);
      setJugadoresPorSet((prev) => ({
        ...prev,
        [setKey]: mapaAnterior,
      }));
    }
  }, [numeroSetSeleccionado, setKey, setsLocales]);

  const guardar = useCallback(async () => {
    const numeroSet = normalizarNumero(numeroSetSeleccionado);
    if (!numeroSet) return;

    setGuardando(true);

    try {
      const setIdLocal = typeof estadisticasSet?._id === 'string' ? estadisticasSet._id : undefined;
      const setId = mapaSetNumeroIdRef.current[numeroSet] ?? setIdLocal;
      if (!setId) {
        addToast({ type: 'error', title: 'Error', message: 'No se pudo identificar el set' });
        return;
      }

      const current = jugadoresPorSet[setKey] ?? {};
      const byJp: Record<string, { id?: string; equipoId: string; stats: Record<string, number> }> = {};

      Object.entries(current).forEach(([equipoId, jugadores]) => {
        (jugadores ?? []).forEach((jugador) => {
          const jpId = jugador.jugadorPartidoId ?? jugador.jugadorId;
          if (!jpId) return;
          const stats = { ...ESTADISTICAS_BASE, ...jugador.estadisticas } as Record<string, number>;
          const existingId = jugador.estadisticaId || existingByJpRef.current[jpId];
          byJp[jpId] = { id: existingId, equipoId, stats };
        });
      });

      for (const [jpId, item] of Object.entries(byJp)) {
        const jugadorId = mapJpToJugador[jpId];
        let statId = item.id;

        if (!statId) {
          const existentes = await buscarEstadisticaJugadorSet(setId, jpId);
          if (Array.isArray(existentes) && existentes.length > 0 && existentes[0]?._id) {
            statId = existentes[0]._id as unknown as string;
            existingByJpRef.current[jpId] = statId;
          }
        }

        if (statId) {
          await actualizarEstadisticaJugadorSet(statId, {
            throws: item.stats.throws,
            hits: item.stats.hits,
            outs: item.stats.outs,
            catches: item.stats.catches,
          });
        } else if (jugadorId) {
          await crearEstadisticaJugadorSet({
            set: setId,
            jugadorPartido: jpId,
            jugador: jugadorId,
            equipo: item.equipoId,
            throws: item.stats.throws,
            hits: item.stats.hits,
            outs: item.stats.outs,
            catches: item.stats.catches,
          });
        }
      }

      setMapVersion((prev) => prev + 1);
      await Promise.resolve(refrescarPartidoSeleccionado());
    } catch (error) {
      console.error('Error al guardar estadísticas del set:', error);
      addToast({ type: 'error', title: 'Error al guardar set', message: (error as Error).message });
    } finally {
      setGuardando(false);
    }
  }, [addToast, estadisticasSet, jugadoresPorSet, numeroSetSeleccionado, refrescarPartidoSeleccionado, setKey, mapJpToJugador]);

  const confirmarRecalculo = useCallback(() => {
    console.info('Confirmar recalculo de estadísticas manuales');
  }, []);

  const cancelarRecalculo = useCallback(() => {
    console.info('Cancelar recalculo de estadísticas manuales');
  }, []);

  return {
    serviciosCargados,
    jugadoresPorSet,
    equiposDelSet,
    guardar,
    guardando,
    asignarJugador,
    cambiarEstadistica,
    copiarJugadoresDeSetAnterior,
    mostrarConfirmacionManual,
    estadisticasManualesDetectadas,
    setDataPendiente,
    confirmarRecalculo,
    cancelarRecalculo,
  };
};
