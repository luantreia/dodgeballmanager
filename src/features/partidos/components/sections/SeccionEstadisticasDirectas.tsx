import { useState, useEffect, type FC } from 'react';
import type { PartidoDetallado } from '../../services/partidoService';
import type { EstadisticaManualBackend } from '../../hooks/useEstadisticasModal';
import {
  getResumenEstadisticasJugadorPartido,
  getEstadisticasJugadorPartido,
  getEstadisticasJugadorSetPorPartido,
} from '../../../estadisticas/services/estadisticasService';

type EstadisticaAutomatica = EstadisticaManualBackend & {
  jugadorPartido?: EstadisticaManualBackend['jugadorPartido'] | string;
  [key: string]: unknown;
};

type SeccionEstadisticasDirectasProps = {
  partido: PartidoDetallado | null;
  partidoId: string;
  token: string;
  canCaptureStats?: boolean;
  onRefresh?: () => void | Promise<void>;
  setModalEstadisticasGeneralesAbierto: (config: {
    datosIniciales: EstadisticaAutomatica[];
    hayDatosAutomaticos: boolean;
  }) => void;
};

export const SeccionEstadisticasDirectas: FC<SeccionEstadisticasDirectasProps> = ({
  partido,
  partidoId,
  token,
  canCaptureStats = false,
  onRefresh,
  setModalEstadisticasGeneralesAbierto
}) => {
  const [estadisticasAutomaticas, setEstadisticasAutomaticas] = useState<EstadisticaAutomatica[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);

  // Cargar estadísticas automáticas agregadas para usar como valores por defecto
  useEffect(() => {
    const cargarEstadisticasAutomaticas = async (): Promise<void> => {
      try {
        setCargando(true);
        console.log('🔍 Buscando estadísticas automáticas para partido:', partidoId);

        // Intentar cargar estadísticas automáticas agregadas primero (servicio)
        const resumen = await getResumenEstadisticasJugadorPartido(partidoId);
        const jugadores = Array.isArray(resumen?.jugadores) ? (resumen.jugadores as EstadisticaAutomatica[]) : [];
        if (jugadores.length > 0) {
          console.log('📊 Estadísticas automáticas agregadas encontradas:', jugadores.length);
          setEstadisticasAutomaticas(jugadores);
          return;
        }

        console.log('⚠️ No hay estadísticas agregadas, buscando individuales...');

        // Si no hay agregadas, intentar cargar individuales (servicio)
        const individuales = await getEstadisticasJugadorPartido(partidoId);
        if ((individuales ?? []).length > 0) {
          console.log('📊 Estadísticas automáticas individuales encontradas:', individuales.length);
          setEstadisticasAutomaticas(individuales as EstadisticaAutomatica[]);
          return;
        }

        console.log('⚠️ No se encontraron estadísticas, intentando crearlas desde sets...');
        await crearEstadisticasDesdeSets();
      } catch (error) {
        console.error('Error cargando estadísticas automáticas:', error);
        setEstadisticasAutomaticas([]);
      } finally {
        setCargando(false);
      }
    };

    const crearEstadisticasDesdeSets = async (): Promise<void> => {
      try {
        console.log('🔧 Intentando crear estadísticas desde datos de sets...');

        // Buscar estadísticas por set para este partido (servicio)
        const dataSets = await getEstadisticasJugadorSetPorPartido(partidoId);
        console.log('📈 Estadísticas por set encontradas:', (dataSets ?? []).length);

        if ((dataSets ?? []).length > 0) {
          // Agrupar por jugador y crear estadísticas agregadas
          const statsPorJugador: Record<string, EstadisticaAutomatica> = {};

          (dataSets as EstadisticaAutomatica[]).forEach(stat => {
            const jugadorPartidoValue = stat?.jugadorPartido;
            const jugadorId = typeof jugadorPartidoValue === 'string'
              ? jugadorPartidoValue
              : jugadorPartidoValue?._id;
            if (!jugadorId) return;

            if (!statsPorJugador[jugadorId]) {
              statsPorJugador[jugadorId] = {
                _id: stat._id,
                jugadorPartido: stat.jugadorPartido,
                throws: 0,
                hits: 0,
                outs: 0,
                catches: 0,
                tipoCaptura: 'automatico'
              };
            }

            statsPorJugador[jugadorId].throws = (statsPorJugador[jugadorId].throws ?? 0) + (stat.throws ?? 0);
            statsPorJugador[jugadorId].hits = (statsPorJugador[jugadorId].hits ?? 0) + (stat.hits ?? 0);
            statsPorJugador[jugadorId].outs = (statsPorJugador[jugadorId].outs ?? 0) + (stat.outs ?? 0);
            statsPorJugador[jugadorId].catches = (statsPorJugador[jugadorId].catches ?? 0) + (stat.catches ?? 0);
          });

          const estadisticasAgregadas = Object.values(statsPorJugador);
          console.log('✅ Estadísticas agregadas creadas desde sets:', estadisticasAgregadas.length);
          setEstadisticasAutomaticas(estadisticasAgregadas);
        } else {
          console.log('⚠️ No hay estadísticas por set para este partido');
          setEstadisticasAutomaticas([]);
        }
      } catch (error) {
        console.error('Error creando estadísticas desde sets:', error);
        setEstadisticasAutomaticas([]);
      }
    };

    if (partidoId && token) {
      cargarEstadisticasAutomaticas();
    }
  }, [partidoId, token]);

  const handleAbrirModal = (): void => {
    // Pasar las estadísticas automáticas como datos iniciales
    setModalEstadisticasGeneralesAbierto({
      datosIniciales: estadisticasAutomaticas,
      hayDatosAutomaticos: estadisticasAutomaticas.length > 0
    });
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-green-800">⚡ Estadísticas Directas</h4>
          <p className="text-sm text-green-700">Captura estadísticas directamente para todo el partido sin sets individuales</p>
          {estadisticasAutomaticas.length > 0 && (
            <p className="text-xs text-green-600 mt-1">
              💡 Se autocompletarán con {estadisticasAutomaticas.length} estadísticas automáticas disponibles
            </p>
          )}
          {estadisticasAutomaticas.length === 0 && !cargando && (
            <p className="text-xs text-orange-600 mt-1">
              🔍 Si hay estadísticas por set guardadas, se cargarán automáticamente
            </p>
          )}
        </div>
        <button
          onClick={handleAbrirModal}
          disabled={cargando || !canCaptureStats}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {cargando ? 'Cargando...' : canCaptureStats ? 'Capturar Estadísticas Generales' : 'Sin permiso de captura'}
        </button>
      </div>

      <div className="text-center py-8">
        <div className="text-green-600 mb-2">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-green-700 text-sm">
          {estadisticasAutomaticas.length > 0
            ? `Haz clic para capturar datos. Se autocompletarán ${estadisticasAutomaticas.length} estadísticas existentes.`
            : 'Haz clic para capturar estadísticas. Si hay datos por set guardados, se cargarán automáticamente.'
          }
        </p>
        {!canCaptureStats && (
          <p className="mt-2 text-xs text-rose-700">
            No tienes permisos del equipo para capturar estadísticas.
          </p>
        )}
      </div>
    </div>
  );
};