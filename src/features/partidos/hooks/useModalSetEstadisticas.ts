import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEstadisticasJugadorSet, type EstadisticaJugadorSetDetalle } from '../../estadisticas/services/estadisticasService';
import type { SetPartido } from '../services/partidoService';

export type JugadorSet = {
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
  const [serviciosCargados, setServiciosCargados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [jugadoresPorSet, setJugadoresPorSet] = useState<JugadoresPorSet>({});
  const [mostrarConfirmacionManual] = useState(false);
  const [estadisticasManualesDetectadas] = useState(false);
  const [setDataPendiente] = useState<null>(null);

  const setKey = numeroSetSeleccionado || 'sin-set';

  useEffect(() => {
    let cancelado = false;

    const cargarEstadisticas = async (): Promise<void> => {
      const numeroSet = normalizarNumero(numeroSetSeleccionado);
      if (!numeroSet) {
        setJugadoresPorSet({});
        setServiciosCargados(true);
        return;
      }

      try {
        const data = await getEstadisticasJugadorSet(numeroSet.toString());
        if (cancelado) return;

        const agrupado = data.reduce<Record<string, JugadorSet[]>>((acc, detalle) => {
          const jugador = buildJugadoresDesdeDetalle(detalle);
          if (!jugador.equipoId) return acc;
          if (!acc[jugador.equipoId]) acc[jugador.equipoId] = [];
          acc[jugador.equipoId].push(mergeJugador(jugador));
          return acc;
        }, {});

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
  }, [estadisticasSet, numeroSetSeleccionado, partidoId, setKey]);

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

    const mapaAnterior = construirMapaInicial(setAnterior);
    setJugadoresPorSet((prev) => ({
      ...prev,
      [setKey]: mapaAnterior,
    }));
  }, [numeroSetSeleccionado, setKey, setsLocales]);

  const guardar = useCallback(async () => {
    const numeroSet = normalizarNumero(numeroSetSeleccionado);
    if (!numeroSet) return;

    setGuardando(true);

    try {
      const payloadJugadores = Object.entries(jugadoresPorSet[setKey] ?? {}).flatMap(([equipoId, jugadores]) =>
        jugadores.map((jugador) => ({
          equipo: equipoId,
          jugadorPartido: jugador.jugadorPartidoId ?? jugador.jugadorId,
          ...ESTADISTICAS_BASE,
          ...jugador.estadisticas,
        })),
      );

      if (actualizarSetDePartido) {
        await actualizarSetDePartido(numeroSet, {
          estadisticas: payloadJugadores as unknown as SetPartido['estadisticas'],
        });
      }

      actualizarSetSeleccionado({ estadisticas: payloadJugadores });

      await Promise.resolve(refrescarPartidoSeleccionado());
    } catch (error) {
      console.error('Error al guardar estadísticas del set:', error);
      alert(`Error al guardar el set: ${(error as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }, [actualizarSetDePartido, actualizarSetSeleccionado, jugadoresPorSet, numeroSetSeleccionado, refrescarPartidoSeleccionado, setKey]);

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
