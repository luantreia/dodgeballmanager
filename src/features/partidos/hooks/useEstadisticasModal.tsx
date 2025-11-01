import { useState, useCallback } from 'react';
import { extractEquipoId, type EquipoRef } from '../services/partidoService';
import {
  getJugadoresPartido,
  getEstadisticasJugadorPartidoManual,
  guardarEstadisticaJugadorPartido,
  actualizarEstadisticaJugadorPartido,
  guardarEstadisticaManualJugadorPartido,
  actualizarEstadisticaManualJugadorPartido,
  recalcularEstadisticasEquipoPartido,
  type EstadisticaJugadorPartidoPayload,
  type EstadisticaManualJugador,
} from '../../estadisticas/services/estadisticasService';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

export type TipoAutocompletado = 'automatico' | 'manual-previo' | null;

export type JugadorBackend = {
  _id: string;
  jugador:
    | string
    | {
        _id?: string;
        nombre?: string;
        apellido?: string;
        name?: string;
        fullName?: string;
      };
  equipo: string | { _id?: string };
};

export type EstadisticaManualBackend = {
  _id?: string;
  jugadorPartido: {
    _id: string;
    equipo?: string | { _id?: string };
  };
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  tipoCaptura?: 'manual' | 'automatico';
};

type EstadisticaCaptura = {
  jugadorPartido: string;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  tipoCaptura: 'manual';
  fuente: 'manual-con-autocompletado-automatico' | 'manual-con-autocompletado-manual-previo' | 'captura-directa';
  _id?: string;
};

export type EstadisticaEstado = EstadisticaManualBackend & {
  fuente?: 'autocompletado-automatico' | 'autocompletado-manual-previo';
};

export type EstadisticasMap = Record<string, EstadisticaEstado>;

export type PartidoReferencia = {
  equipoLocal?: EquipoRef;
  equipoVisitante?: EquipoRef;
};

export type EstadisticaCampoEditable = 'throws' | 'hits' | 'outs' | 'catches';

type JugadoresAsignadosResponse = JugadorBackend[];

type EstadisticasJugadorPartidoManualResponse = EstadisticaManualBackend[];

type UseEstadisticasModalReturn = {
  jugadores: JugadorBackend[];
  estadisticas: EstadisticasMap;
  loading: boolean;
  guardando: boolean;
  seleccionesLocal: string[];
  seleccionesVisitante: string[];
  mostrarAsignacion: boolean;
  tipoAutocompletado: TipoAutocompletado;
  jugadoresSeleccionadosLocal: Set<string>;
  jugadoresSeleccionadosVisitante: Set<string>;
  asignandoJugadores: boolean;
  setSeleccionesLocal: React.Dispatch<React.SetStateAction<string[]>>;
  setSeleccionesVisitante: React.Dispatch<React.SetStateAction<string[]>>;
  setMostrarAsignacion: React.Dispatch<React.SetStateAction<boolean>>;
  setJugadoresSeleccionadosLocal: React.Dispatch<React.SetStateAction<Set<string>>>;
  setJugadoresSeleccionadosVisitante: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAsignandoJugadores: React.Dispatch<React.SetStateAction<boolean>>;
  cargarJugadoresYEstadisticas: (
    partido: PartidoReferencia | null,
    datosIniciales?: EstadisticaManualBackend[],
    hayDatosAutomaticos?: boolean,
  ) => Promise<void>;
  cambiarEstadistica: (jugadorPartidoId: string, campo: EstadisticaCampoEditable, valor: number) => void;
  guardarEstadisticas: (partido: PartidoReferencia) => Promise<boolean>;
};

const extractId = (value: string | { _id?: string } | EquipoRef | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    const maybeId = (value as { _id?: string })._id;
    return typeof maybeId === 'string' ? maybeId : undefined;
  }
  return undefined;
};

const buildCapturaPayload = (
  jugadorPartidoId: string,
  stats: EstadisticaEstado | undefined,
  tipoAutocompletado: TipoAutocompletado,
): EstadisticaCaptura => {
  const fuente: EstadisticaCaptura['fuente'] = tipoAutocompletado === 'automatico'
    ? 'manual-con-autocompletado-automatico'
    : tipoAutocompletado === 'manual-previo'
      ? 'manual-con-autocompletado-manual-previo'
      : 'captura-directa';

  return {
    jugadorPartido: jugadorPartidoId,
    throws: stats?.throws ?? 0,
    hits: stats?.hits ?? 0,
    outs: stats?.outs ?? 0,
    catches: stats?.catches ?? 0,
    tipoCaptura: 'manual',
    fuente,
    _id: stats?._id,
  };
};

const toBackendEstadistica = (stat: EstadisticaManualJugador | EstadisticaManualBackend): EstadisticaManualBackend | null => {
  const jugadorPartidoValue = (stat as EstadisticaManualJugador).jugadorPartido;
  if (!jugadorPartidoValue) return null;

  const tipoCaptura =
    stat.tipoCaptura === 'manual' || stat.tipoCaptura === 'automatico' ? stat.tipoCaptura : undefined;

  if (typeof jugadorPartidoValue === 'string') {
    return {
      _id: stat._id,
      jugadorPartido: {
        _id: jugadorPartidoValue,
      },
      throws: stat.throws,
      hits: stat.hits,
      outs: stat.outs,
      catches: stat.catches,
      tipoCaptura,
    };
  }

  const jugadorId = jugadorPartidoValue._id;
  if (!jugadorId) return null;

  return {
    _id: stat._id,
    jugadorPartido: {
      _id: jugadorId,
      equipo: jugadorPartidoValue.equipo,
    },
    throws: stat.throws,
    hits: stat.hits,
    outs: stat.outs,
    catches: stat.catches,
    tipoCaptura,
  };
};

const preSeleccionarPosiciones = (
  datos: EstadisticaManualBackend[],
  partido: PartidoReferencia | null,
  seleccionesLocal: string[],
  seleccionesVisitante: string[],
) => {
  let posicionLocal = 0;
  let posicionVisitante = 0;

  const porEquipo: Record<string, EstadisticaManualBackend[]> = {};
  datos.forEach((stat) => {
    const equipoId = extractId(stat.jugadorPartido.equipo);
    if (!equipoId) return;
    if (!porEquipo[equipoId]) {
      porEquipo[equipoId] = [];
    }
    porEquipo[equipoId].push(stat);
  });

  const equipoLocalId = extractEquipoId(partido?.equipoLocal);
  const equipoVisitanteId = extractEquipoId(partido?.equipoVisitante);

  Object.entries(porEquipo).forEach(([equipoId, stats]) => {
    const esLocal = equipoLocalId && equipoId === equipoLocalId;
    const esVisitante = equipoVisitanteId && equipoId === equipoVisitanteId;

    if (esLocal || esVisitante) {
      const selecciones = esLocal ? seleccionesLocal : seleccionesVisitante;
      let posicion = esLocal ? posicionLocal : posicionVisitante;

      stats.forEach((stat) => {
        if (posicion < selecciones.length) {
          selecciones[posicion] = stat.jugadorPartido._id;
          posicion += 1;
        }
      });

      if (esLocal) {
        posicionLocal = posicion;
      } else {
        posicionVisitante = posicion;
      }
    }
  });
};

export const useEstadisticasModal = (partidoId: string, _token: string): UseEstadisticasModalReturn => {
  const { addToast } = useToast();
  const [jugadores, setJugadores] = useState<JugadorBackend[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [seleccionesLocal, setSeleccionesLocal] = useState<string[]>(Array(10).fill(''));
  const [seleccionesVisitante, setSeleccionesVisitante] = useState<string[]>(Array(10).fill(''));
  const [mostrarAsignacion, setMostrarAsignacion] = useState<boolean>(false);
  const [tipoAutocompletado, setTipoAutocompletado] = useState<TipoAutocompletado>(null);
  const [jugadoresSeleccionadosLocal, setJugadoresSeleccionadosLocal] = useState<Set<string>>(new Set());
  const [jugadoresSeleccionadosVisitante, setJugadoresSeleccionadosVisitante] = useState<Set<string>>(new Set());
  const [asignandoJugadores, setAsignandoJugadores] = useState<boolean>(false);

  const cargarJugadoresYEstadisticas = useCallback(async (
    partido: PartidoReferencia | null,
    datosIniciales: EstadisticaManualBackend[] = [],
    hayDatosAutomaticos: boolean = false,
  ): Promise<void> => {
    try {
      const jugadoresData = await getJugadoresPartido(partidoId);
      const jugadoresNormalizados = Array.isArray(jugadoresData)
        ? (jugadoresData as JugadoresAsignadosResponse)
        : [];
      setJugadores(jugadoresNormalizados);

      if (jugadoresNormalizados.length === 0) {
        setMostrarAsignacion(true);
        return;
      }

      let hayDatosManualesPrevios = false;
      let estadisticasManualesPrevias: EstadisticasJugadorPartidoManualResponse = [];
      try {
        const manuales = await getEstadisticasJugadorPartidoManual(partidoId);
        const manualesNormalizados = Array.isArray(manuales)
          ? manuales
            .map(toBackendEstadistica)
            .filter((stat): stat is EstadisticaManualBackend => stat !== null)
          : [];
        estadisticasManualesPrevias = manualesNormalizados;
      } catch (manualError) {
        console.warn('⚠️ Error obteniendo estadísticas manuales previas:', manualError);
      }

      const estadisticasManualesFiltradas = estadisticasManualesPrevias.filter((stat) =>
        jugadoresNormalizados.some((j) => j._id === stat.jugadorPartido._id),
      );

      if (estadisticasManualesFiltradas.length > 0) {
        hayDatosManualesPrevios = true;
        const estadisticasMap: EstadisticasMap = {};
        estadisticasManualesFiltradas.forEach((stat) => {
          estadisticasMap[stat.jugadorPartido._id] = {
            ...stat,
            fuente: 'autocompletado-manual-previo',
          };
        });
        setEstadisticas(estadisticasMap);

        const nuevasSeleccionesLocal = Array<string>(10).fill('');
        const nuevasSeleccionesVisitante = Array<string>(10).fill('');
        preSeleccionarPosiciones(
          estadisticasManualesFiltradas,
          partido,
          nuevasSeleccionesLocal,
          nuevasSeleccionesVisitante,
        );
        setSeleccionesLocal(nuevasSeleccionesLocal);
        setSeleccionesVisitante(nuevasSeleccionesVisitante);
        setTipoAutocompletado('manual-previo');
      }

      if (!hayDatosManualesPrevios && hayDatosAutomaticos && datosIniciales.length > 0) {
        const estadisticasMap: EstadisticasMap = {};
        const datosNormalizados = datosIniciales
          .map(toBackendEstadistica)
          .filter((stat): stat is EstadisticaManualBackend => stat !== null);
        datosNormalizados.forEach((stat) => {
          estadisticasMap[stat.jugadorPartido._id] = {
            ...stat,
            _id: undefined,
            fuente: 'autocompletado-automatico',
          };
        });
        setEstadisticas(estadisticasMap);

        const nuevasSeleccionesLocal = Array<string>(10).fill('');
        const nuevasSeleccionesVisitante = Array<string>(10).fill('');
        preSeleccionarPosiciones(
          datosNormalizados,
          partido,
          nuevasSeleccionesLocal,
          nuevasSeleccionesVisitante,
        );
        setSeleccionesLocal(nuevasSeleccionesLocal);
        setSeleccionesVisitante(nuevasSeleccionesVisitante);
        setTipoAutocompletado('automatico');
      } else {
        setTipoAutocompletado((prev) => (prev === null ? null : prev));
      }

      setMostrarAsignacion(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      addToast({ type: 'error', title: 'Error al cargar datos', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [partidoId]);

  const cambiarEstadistica = (
    jugadorPartidoId: string,
    campo: EstadisticaCampoEditable,
    valor: number,
  ): void => {
    const valorNormalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0;

    setEstadisticas((prev) => {
      const existing = prev[jugadorPartidoId] ?? { jugadorPartido: { _id: jugadorPartidoId } };

      return {
        ...prev,
        [jugadorPartidoId]: {
          ...existing,
          [campo]: valorNormalizado,
        },
      };
    });
  };

  const guardarEstadisticas = async (partido: PartidoReferencia): Promise<boolean> => {
    setGuardando(true);
    try {
      const tareas: Array<Promise<unknown>> = [];

      [...seleccionesLocal, ...seleccionesVisitante].forEach((jugadorPartidoId) => {
        if (!jugadorPartidoId) return;
        const stats = estadisticas[jugadorPartidoId];
        const payload = buildCapturaPayload(jugadorPartidoId, stats, tipoAutocompletado);

        const payloadForService = payload as EstadisticaJugadorPartidoPayload;

        if (payload._id) {
          if (payload.fuente === 'manual-con-autocompletado-manual-previo') {
            tareas.push(actualizarEstadisticaManualJugadorPartido(payload._id, payloadForService));
          } else {
            tareas.push(actualizarEstadisticaJugadorPartido(payload._id, payloadForService));
          }
        } else if (payload.fuente === 'manual-con-autocompletado-manual-previo') {
          tareas.push(guardarEstadisticaManualJugadorPartido(payloadForService));
        } else {
          tareas.push(guardarEstadisticaJugadorPartido(payloadForService));
        }
      });

      await Promise.all(tareas);

      const equipoLocalId = extractEquipoId(partido?.equipoLocal);
      const equipoVisitanteId = extractEquipoId(partido?.equipoVisitante);

      const actualizacionesEquipo: Array<Promise<unknown>> = [];

      if (equipoLocalId) {
        actualizacionesEquipo.push(recalcularEstadisticasEquipoPartido(partidoId, equipoLocalId));
      }

      if (equipoVisitanteId) {
        actualizacionesEquipo.push(recalcularEstadisticasEquipoPartido(partidoId, equipoVisitanteId));
      }

      await Promise.all(actualizacionesEquipo);
      addToast({ type: 'success', title: 'Guardado', message: 'Estadísticas guardadas correctamente' });
      return true;
    } catch (error) {
      console.error('Error guardando estadísticas:', error);
      addToast({ type: 'error', title: 'Error al guardar', message: (error as Error).message });
      return false;
    } finally {
      setGuardando(false);
    }
  };

  return {
    jugadores,
    estadisticas,
    loading,
    guardando,
    seleccionesLocal,
    seleccionesVisitante,
    mostrarAsignacion,
    tipoAutocompletado,
    jugadoresSeleccionadosLocal,
    jugadoresSeleccionadosVisitante,
    asignandoJugadores,
    setSeleccionesLocal,
    setSeleccionesVisitante,
    setMostrarAsignacion,
    setJugadoresSeleccionadosLocal,
    setJugadoresSeleccionadosVisitante,
    setAsignandoJugadores,
    cargarJugadoresYEstadisticas,
    cambiarEstadistica,
    guardarEstadisticas,
  };
};
