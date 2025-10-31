import { useState, useEffect } from 'react';
import { extractEquipoId, type EquipoRef } from '../services/partidoService';

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

type EstadisticasJugadorPartidoResponse = EstadisticaManualBackend[];

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

const isObjectWithId = (value: unknown): value is { _id?: string } =>
  typeof value === 'object' && value !== null && '_id' in value;

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

export const useEstadisticasModal = (partidoId: string, token: string): UseEstadisticasModalReturn => {
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

  const cargarJugadoresYEstadisticas = async (
    partido: PartidoReferencia | null,
    datosIniciales: EstadisticaManualBackend[] = [],
    hayDatosAutomaticos: boolean = false,
  ): Promise<void> => {
    try {
      const responseJugadores = await fetch(
        `https://overtime-ddyl.onrender.com/api/jugador-partido?partido=${partidoId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!responseJugadores.ok) {
        throw new Error('Error al cargar jugadores');
      }

      const jugadoresData: JugadoresAsignadosResponse = await responseJugadores.json();
      setJugadores(jugadoresData);

      if (jugadoresData.length === 0) {
        setMostrarAsignacion(true);
        return;
      }

      const responseEstadisticasManuales = await fetch(
        `https://overtime-ddyl.onrender.com/api/estadisticas/jugador-partido-manual?partido=${partidoId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      let hayDatosManualesPrevios = false;
      if (responseEstadisticasManuales.ok) {
        const estadisticasManualesData: EstadisticasJugadorPartidoManualResponse = await responseEstadisticasManuales.json();
        const estadisticasManualesFiltradas = estadisticasManualesData.filter((stat) =>
          jugadoresData.some((j) => j._id === stat.jugadorPartido._id),
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
          preSeleccionarPosiciones(estadisticasManualesFiltradas, partido, nuevasSeleccionesLocal, nuevasSeleccionesVisitante);
          setSeleccionesLocal(nuevasSeleccionesLocal);
          setSeleccionesVisitante(nuevasSeleccionesVisitante);
          setTipoAutocompletado('manual-previo');
        }
      }

      if (!hayDatosManualesPrevios && hayDatosAutomaticos && datosIniciales.length > 0) {
        const estadisticasMap: EstadisticasMap = {};
        datosIniciales.forEach((stat) => {
          estadisticasMap[stat.jugadorPartido._id] = {
            ...stat,
            _id: undefined,
            fuente: 'autocompletado-automatico',
          };
        });
        setEstadisticas(estadisticasMap);

        const nuevasSeleccionesLocal = Array<string>(10).fill('');
        const nuevasSeleccionesVisitante = Array<string>(10).fill('');
        preSeleccionarPosiciones(datosIniciales, partido, nuevasSeleccionesLocal, nuevasSeleccionesVisitante);
        setSeleccionesLocal(nuevasSeleccionesLocal);
        setSeleccionesVisitante(nuevasSeleccionesVisitante);
        setTipoAutocompletado('automatico');
      } else {
        setTipoAutocompletado((prev) => (prev === null ? null : prev));
      }

      setMostrarAsignacion(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert(`Error al cargar los datos: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const preSeleccionarPosiciones = (
    datos: EstadisticaManualBackend[],
    partido: PartidoReferencia | null,
    seleccionesLocal: string[],
    seleccionesVisitante: string[],
  ): void => {
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
      const tareas: Array<Promise<Response>> = [];

      [...seleccionesLocal, ...seleccionesVisitante].forEach((jugadorPartidoId) => {
        if (!jugadorPartidoId) return;
        const stats = estadisticas[jugadorPartidoId];
        const payload = buildCapturaPayload(jugadorPartidoId, stats, tipoAutocompletado);

        if (payload._id) {
          const endpoint = payload.fuente === 'manual-con-autocompletado-manual-previo'
            ? `https://overtime-ddyl.onrender.com/api/estadisticas/jugador-partido-manual/${payload._id}`
            : `https://overtime-ddyl.onrender.com/api/estadisticas/jugador-partido/${payload._id}`;

          tareas.push(
            fetch(endpoint, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            }),
          );
        } else {
          const endpoint = payload.fuente === 'manual-con-autocompletado-manual-previo'
            ? 'https://overtime-ddyl.onrender.com/api/estadisticas/jugador-partido-manual'
            : 'https://overtime-ddyl.onrender.com/api/estadisticas/jugador-partido';

          tareas.push(
            fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            }),
          );
        }
      });

      await Promise.all(tareas);

      const equipoLocalId = extractEquipoId(partido?.equipoLocal);
      const equipoVisitanteId = extractEquipoId(partido?.equipoVisitante);

      const actualizacionesEquipo: Array<Promise<Response>> = [];

      if (equipoLocalId) {
        actualizacionesEquipo.push(
          fetch('https://overtime-ddyl.onrender.com/api/estadisticas/equipo-partido/actualizar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              partidoId,
              equipoId: equipoLocalId,
              creadoPor: 'usuario',
            }),
          }),
        );
      }

      if (equipoVisitanteId) {
        actualizacionesEquipo.push(
          fetch('https://overtime-ddyl.onrender.com/api/estadisticas/equipo-partido/actualizar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              partidoId,
              equipoId: equipoVisitanteId,
              creadoPor: 'usuario',
            }),
          }),
        );
      }

      await Promise.all(actualizacionesEquipo);

      alert('Estadísticas guardadas correctamente');
      return true;
    } catch (error) {
      console.error('Error guardando estadísticas:', error);
      alert(`Error al guardar las estadísticas: ${(error as Error).message}`);
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
