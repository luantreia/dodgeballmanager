import { useState, useCallback, useEffect, type FC, type ReactNode } from 'react';
import { renderEstadisticasGenerales } from './EstadisticasGenerales';
import { renderEstadisticasEquipos } from './EstadisticasEquipos';
import { renderEstadisticasJugadores } from './EstadisticasJugadores';
import {
  getResumenEstadisticasAutomaticas,
  getResumenEstadisticasManual,
  type EstadisticaJugadorSetResumen,
  type EstadisticaManualEquipo,
  type EstadisticaManualJugador,
  type EstadisticaSetResumen,
  type ResumenEstadisticasAutomaticas,
  type ResumenEstadisticasManual,
} from '../services/estadisticasService';
import { actualizarModoVisualizacionPartido } from '../../partidos/services/partidoService';

type VistaEstadisticas = 'general' | 'equipos' | 'jugadores';
type ModoEstadisticas = 'automatico' | 'manual';
type ModoVisualizacion = 'automatico' | 'manual';

type TipoVista = 'directas' | 'generales' | 'setASet';

type JugadorEstadistica = EstadisticaManualJugador & {
  fuente?: string;
  setInfo?: Pick<EstadisticaSetResumen, 'numeroSet' | 'estadoSet' | 'ganadorSet'>;
};

interface EstadisticasData {
  jugadores: JugadorEstadistica[];
  equipos: EstadisticaManualEquipo[];
  setsInfo?: EstadisticaSetResumen[];
  mensaje?: string;
  tipo?: string;
}

export interface PartidoEstadisticas {
  _id: string;
  modoEstadisticas?: ModoEstadisticas;
  modoVisualizacion?: ModoVisualizacion;
  [key: string]: unknown;
}

interface EstadisticasGeneralesPartidoProps {
  partidoId: string;
  tipoVista?: TipoVista;
  onRefresh?: (fn: () => Promise<void>) => void;
  partido?: PartidoEstadisticas;
  onCambiarModoEstadisticas?: (partidoId: string, modo: ModoEstadisticas) => Promise<void>;
}

const TIPO_VISTA_MAP: Record<TipoVista, VistaEstadisticas> = {
  directas: 'general',
  generales: 'equipos',
  setASet: 'jugadores',
};

const EstadisticasGeneralesPartido: FC<EstadisticasGeneralesPartidoProps> = ({
  partidoId,
  tipoVista = 'directas',
  onRefresh,
  partido,
  onCambiarModoEstadisticas,
}) => {
  const [estadisticas, setEstadisticas] = useState<EstadisticasData>({ jugadores: [], equipos: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [vista, setVista] = useState<VistaEstadisticas>(TIPO_VISTA_MAP[tipoVista] ?? 'general');

  // Estados locales para UI inmediata (se sincronizan con props)
  const [modoEstadisticasUI, setModoEstadisticasUI] = useState<ModoEstadisticas>(
    partido?.modoEstadisticas ?? 'automatico',
  );
  const [modoVisualizacionUI, setModoVisualizacionUI] = useState<ModoVisualizacion>(
    partido?.modoVisualizacion ?? 'automatico',
  );

  useEffect(() => {
    setVista(TIPO_VISTA_MAP[tipoVista] ?? 'general');
  }, [tipoVista]);

  // Sincronizar estados locales con props cuando cambian
  useEffect(() => {
    const nuevoModo = partido?.modoEstadisticas ?? 'automatico';
    setModoEstadisticasUI(nuevoModo);
    // Cuando cambia el modo de estadísticas, también sincroniza el modo de visualización
    setModoVisualizacionUI(partido?.modoVisualizacion ?? nuevoModo);
  }, [partido?.modoEstadisticas, partido?.modoVisualizacion]);

  const cargarEstadisticas = useCallback(async (): Promise<void> => {
    try {
      console.log(`📊 Cargando estadísticas en modo ${modoEstadisticasUI}:`, {
        modoEstadisticasUI,
        modoVisualizacionUI
      });

      setLoading(true);
      let data: EstadisticasData = { jugadores: [], equipos: [] };

      if (modoEstadisticasUI === 'automatico') {
        // Cargar estadísticas automáticas POR SET
        const dataSets: ResumenEstadisticasAutomaticas = await getResumenEstadisticasAutomaticas(partidoId);
        const sets = dataSets.sets ?? [];

        // Si no hay sets o hay error, retornar datos vacíos
        if (sets.length === 0) {
          console.log('⚠️ No hay sets con estadísticas en modo automático');
          data = {
            jugadores: [],
            equipos: []
          };
        } else {
          // Convertir el formato de sets a formato de jugadores y luego AGREGAR por jugadorPartido
          const jugadoresFormateados: JugadorEstadistica[] = [];
          const equiposMap = new Map<string, EstadisticaManualEquipo & { jugadores?: number }>();

          sets.forEach((setResumen: EstadisticaSetResumen) => {
            (setResumen.estadisticas ?? []).forEach((stat: EstadisticaJugadorSetResumen) => {
              const jugadorFormateado: JugadorEstadistica = {
                _id: `${stat._id}_set_${setResumen.numeroSet}`,
                jugadorPartido: stat.jugadorPartido,
                throws: stat.throws ?? 0,
                hits: stat.hits ?? 0,
                outs: stat.outs ?? 0,
                catches: stat.catches ?? 0,
                tipoCaptura: 'automatica',
                fuente: `set_${setResumen.numeroSet}`,
                setInfo: {
                  numeroSet: setResumen.numeroSet,
                  estadoSet: setResumen.estadoSet,
                  ganadorSet: setResumen.ganadorSet,
                },
              };

              jugadoresFormateados.push(jugadorFormateado);

              const equipoInfo =
                typeof stat.jugadorPartido === 'object' && stat.jugadorPartido
                  ? stat.jugadorPartido.equipo
                  : undefined;

              if (!equipoInfo) return;

              const equipoId =
                typeof equipoInfo === 'string'
                  ? equipoInfo
                  : equipoInfo?._id ?? `equipo-${stat._id}`;

              const equipoActual: EstadisticaManualEquipo & { jugadores?: number } = equiposMap.get(equipoId) ?? {
                _id: equipoId,
                nombre: typeof equipoInfo === 'object' ? equipoInfo?.nombre : undefined,
                escudo: typeof equipoInfo === 'object' ? equipoInfo?.escudo : undefined,
                throws: 0,
                hits: 0,
                outs: 0,
                catches: 0,
                jugadores: 0,
              };

              equipoActual.throws = (equipoActual.throws ?? 0) + (stat.throws ?? 0);
              equipoActual.hits = (equipoActual.hits ?? 0) + (stat.hits ?? 0);
              equipoActual.outs = (equipoActual.outs ?? 0) + (stat.outs ?? 0);
              equipoActual.catches = (equipoActual.catches ?? 0) + (stat.catches ?? 0);
              equipoActual.jugadores = (equipoActual.jugadores ?? 0) + 1;

              equiposMap.set(equipoId, equipoActual);
            });
          });

          // AGREGAR por jugadorPartido
          const agregadosMap = new Map<string, JugadorEstadistica>();
          jugadoresFormateados.forEach((j) => {
            const jp = j.jugadorPartido as any;
            const jpId = typeof jp === 'string' ? jp : jp?._id;
            if (!jpId) return;

            const existente = agregadosMap.get(jpId);
            if (!existente) {
              // Usar el primer registro como base
              agregadosMap.set(jpId, {
                _id: jpId,
                jugadorPartido: j.jugadorPartido,
                throws: j.throws ?? 0,
                hits: j.hits ?? 0,
                outs: j.outs ?? 0,
                catches: j.catches ?? 0,
                tipoCaptura: 'automatica',
              });
            } else {
              existente.throws = (existente.throws ?? 0) + (j.throws ?? 0);
              existente.hits = (existente.hits ?? 0) + (j.hits ?? 0);
              existente.outs = (existente.outs ?? 0) + (j.outs ?? 0);
              existente.catches = (existente.catches ?? 0) + (j.catches ?? 0);
            }
          });
          const jugadoresAgregados: JugadorEstadistica[] = Array.from(agregadosMap.values());

          // Calcular estadísticas por equipo agregando las estadísticas de sets
          const equiposCalculados: EstadisticaManualEquipo[] = Array.from(equiposMap.values()).map(
            (equipo) => ({
              ...equipo,
              efectividad:
                equipo.throws && equipo.throws > 0
                  ? Number((((equipo.hits ?? 0) / equipo.throws) * 100).toFixed(1))
                  : 0,
            }),
          );

          console.log('📈 Datos de sets procesados:', {
            sets: sets.length,
            estadisticasTotales: jugadoresFormateados.length,
            jugadoresUnicos: jugadoresAgregados.length,
            equiposCalculados: equiposCalculados.length,
            equiposData: equiposCalculados.map(e => ({ nombre: e.nombre, throws: e.throws, hits: e.hits }))
          });

          data = {
            jugadores: jugadoresAgregados,
            equipos: equiposCalculados, // Ahora sí calculamos las estadísticas de equipos
            setsInfo: sets // Información adicional de sets
          };
        }
      } else {
        // Cargar estadísticas manuales agregadas
        const dataManual: ResumenEstadisticasManual = await getResumenEstadisticasManual(partidoId);
        console.log('📊 Datos crudos del endpoint manual:', dataManual);
        console.log('🎯 Estructura de dataManual:', {
          tieneJugadores: !!dataManual.jugadores,
          cantidadJugadores: dataManual.jugadores?.length || 0,
          tieneEquipos: !!dataManual.equipos,
          cantidadEquipos: dataManual.equipos?.length || 0
        });

        // Inspeccionar la estructura de los primeros jugadores
        if (dataManual.jugadores && dataManual.jugadores.length > 0) {
          console.log('🔍 Estructura del primer jugador:', dataManual.jugadores[0]);
          console.log('🔍 Propiedades disponibles:', Object.keys(dataManual.jugadores[0]));
        }

        // Inspeccionar la estructura de equipos
        if (dataManual.equipos && dataManual.equipos.length > 0) {
          console.log('🏆 Estructura del primer equipo:', dataManual.equipos[0]);
          console.log('🏆 Propiedades de equipos:', Object.keys(dataManual.equipos[0]));
        }

        // En modo manual, siempre mostrar las estadísticas de jugadores disponibles
        // El modoVisualizacionUI no afecta la disponibilidad de datos en modo manual
        const jugadoresFiltrados: JugadorEstadistica[] = (dataManual.jugadores ?? []).map((jugador) => ({
          ...jugador,
          throws: jugador.throws ?? 0,
          hits: jugador.hits ?? 0,
          outs: jugador.outs ?? 0,
          catches: jugador.catches ?? 0,
        }));
        console.log('🎯 Jugadores en modo manual:', jugadoresFiltrados.length, 'modoVisualizacion:', modoVisualizacionUI);
        console.log('🔍 En modo manual, siempre mostramos estadísticas de jugadores disponibles');

        console.log('📊 Datos finales modo manual:', {
          jugadoresOriginales: dataManual.jugadores?.length || 0,
          jugadoresFiltrados: jugadoresFiltrados.length,
          equipos: dataManual.equipos?.length || 0
        });

        data = {
          jugadores: jugadoresFiltrados,
          equipos: dataManual.equipos ?? [],
          ...(jugadoresFiltrados.length === 0 ? {
            mensaje: 'No hay estadísticas manuales capturadas. Usa la sección "Estadísticas Directas" para ingresar datos.',
            tipo: 'sin-datos-manuales'
          } : {})
        };
      }

      setEstadisticas(data);
      console.log('✅ Estadísticas cargadas exitosamente:', {
        jugadores: data.jugadores?.length || 0,
        equipos: data.equipos?.length || 0
      });

    } catch (error) {
      console.error('❌ Error cargando estadísticas:', error);
      // Asegurar que siempre tengamos un objeto válido
      const errorData = { jugadores: [], equipos: [] };
      setEstadisticas(errorData);
      console.log('⚠️ Estadísticas establecidas con datos de error:', errorData);
    } finally {
      setLoading(false);
    }
  }, [partidoId, modoEstadisticasUI, modoVisualizacionUI]);

  const handleCambiarModo = async (nuevoModo: ModoEstadisticas): Promise<void> => {
    if (!partido || !onCambiarModoEstadisticas) return;

    const modoAnterior = partido.modoEstadisticas;

    try {
      console.log('🔄 Cambiando modo de estadísticas:', modoAnterior, '→', nuevoModo);
      console.log('📊 Estados actuales antes del cambio:', {
        modoEstadisticasUI,
        modoVisualizacionUI
      });

      // Actualizar estado local inmediatamente para mejor UX
      setModoEstadisticasUI(nuevoModo);
      // Cuando cambias el modo de estadísticas, también cambia el modo de visualización para consistencia
      setModoVisualizacionUI(nuevoModo);

      // Cambiar el modo de estadísticas en el backend
      await onCambiarModoEstadisticas(partido._id, nuevoModo);

      // Intentar actualizar modo de visualización para que coincida (sin bloquear si falla)
      try {
        console.log('🔄 Intentando cambiar modoVisualizacion a:', nuevoModo);
        await actualizarModoVisualizacionPartido(partido._id, nuevoModo);

        // Actualizar estado local de visualización también
        setModoVisualizacionUI(nuevoModo);
        console.log('✅ ModoVisualizacion actualizado correctamente a:', nuevoModo);
      } catch (error) {
        console.warn('⚠️ Error actualizando modoVisualizacion:', error);
        // Si no se pudo actualizar en backend, igual actualizamos localmente
        setModoVisualizacionUI(nuevoModo);
      }

      console.log('📊 Estados después del cambio:', {
        modoEstadisticasUI: nuevoModo,
        modoVisualizacionUI: nuevoModo
      });

      // Recargar estadísticas después del cambio
      await cargarEstadisticas();

      console.log('✅ Modo cambiado exitosamente');

    } catch (error) {
      // Revertir cambio local si falló
      setModoEstadisticasUI(modoAnterior ?? 'automatico');
      console.error('❌ Error cambiando modo de estadísticas:', error);
    }
  };

  // Efecto para cargar estadísticas inicialmente y cuando cambian los modos
  useEffect(() => {
    if (!partidoId) return;
    void cargarEstadisticas();
  }, [partidoId, cargarEstadisticas]);

  // Exponer función de refresco si se proporciona callback
  useEffect(() => {
    if (!onRefresh) return;
    onRefresh(cargarEstadisticas);
  }, [onRefresh, cargarEstadisticas]);

  if (loading) return <div>Cargando estadísticas...</div>;

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Estadísticas del Partido</h2>
          <div className="mt-4 space-y-3">
            {/* Información del modo actual */}
            <p className="text-sm text-gray-600">
              Modo Estadísticas: {modoEstadisticasUI} | Modo Visualización: {modoVisualizacionUI}
              {modoEstadisticasUI === 'manual'
                ? '📝 Mostrando estadísticas manuales totales (ingresadas directamente)'
                : '📊 Mostrando estadísticas automáticas por set individual'}
            </p>
          </div>
        </div>

        {/* Selectores de vista (derecha) */}
        <div className="flex flex-col gap-2 ml-4">
          {/* Selector de Modo de Estadísticas (centro) */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Modo de captura:</span>
            <select
              value={modoEstadisticasUI}
              onChange={(e) => handleCambiarModo(e.target.value as ModoEstadisticas)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="automatico">📊 Automático (por set)</option>
              <option value="manual">✏️ Manual (totales)</option>
            </select>
          </div>

          {/* Botones de vista de estadísticas */}
          <div className="flex space-x-2">
            <button
              onClick={() => setVista('general')}
              className={`px-4 py-2 rounded-md ${
                vista === 'general'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setVista('equipos')}
              className={`px-4 py-2 rounded-md ${
                vista === 'equipos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Equipos
            </button>
            <button
              onClick={() => setVista('jugadores')}
              className={`px-4 py-2 rounded-md ${
                vista === 'jugadores'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Jugadores
            </button>
          </div>
        </div>
      </div>

      {((): ReactNode => {
        switch (vista) {
          case 'general':
            return renderEstadisticasGenerales(estadisticas, partido, modoEstadisticasUI, modoVisualizacionUI);
          case 'equipos':
            return renderEstadisticasEquipos(estadisticas, partido);
          case 'jugadores':
          default:
            console.log('🏃‍♂️ Renderizando vista de jugadores:', {
              vista,
              jugadoresCount: estadisticas.jugadores?.length || 0,
              modoEstadisticasUI,
              modoVisualizacionUI,
            });
            return renderEstadisticasJugadores(estadisticas, partido);
        }
      })()}
    </div>
  );
};

export default EstadisticasGeneralesPartido;