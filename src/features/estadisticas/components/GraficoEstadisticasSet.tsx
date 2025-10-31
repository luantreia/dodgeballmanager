import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getEstadisticasJugadorSet, type EstadisticaJugadorSetDetalle } from '../services/estadisticasService';

// Colores de fondo por equipo (constante fuera del componente)
const COLORES_EQUIPO = ['#dbeafe', '#fce7f3', '#fef3c7', '#dcfce7', '#f3e8ff'];

type OrdenCampo = 'equipo' | 'throws' | 'hits' | 'outs' | 'catches';
type OrdenDireccion = 'asc' | 'desc';

interface GraficoEstadisticasSetProps {
  setId?: string;
}

type EstadisticaJugadorSet = EstadisticaJugadorSetDetalle & {
  equipo?: {
    _id?: string;
    nombre?: string;
    escudo?: string;
  } | string;
  jugador?: {
    _id?: string;
    nombre?: string;
    apellido?: string;
  } | string;
};

type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ payload: DatosGrafico } | undefined>;
  label?: string;
};

type EquipoData = {
  nombre: string;
  totales: {
    throws: number;
    hits: number;
    outs: number;
    catches: number;
  };
  jugadores: EstadisticaJugadorSet[];
};

type EquiposData = Record<string, EquipoData>;

type DatosGrafico = {
  nombre: string;
  equipo: string;
  equipoId: string;
  equipoIndex: number;
  colorFondo: string;
  Lanzamientos: number;
  Golpes: number;
  Outs: number;
  Atrapadas: number;
  lanzamientosReal: number;
  golpesReal: number;
  outsReal: number;
  atrapadasReal: number;
};

const COLORES_EQUIPO_LENGTH = COLORES_EQUIPO.length;

const ajustarParaLog = (valor: number, usarLog: boolean): number => {
  if (!usarLog) return valor;
  return valor === 0 ? 0.1 : valor;
};

const obtenerNombreJugador = (
  jugador: EstadisticaJugadorSet['jugador'],
  options?: { inicial?: boolean },
): string => {
  if (!jugador) return 'Jugador';

  if (typeof jugador === 'string') {
    const partes = jugador.trim().split(' ');
    if (options?.inicial && partes.length > 1) {
      return `${partes[0].charAt(0)}. ${partes[partes.length - 1]}`;
    }
    return jugador || 'Jugador';
  }

  const { nombre, apellido } = jugador;
  if (nombre && apellido) {
    return options?.inicial ? `${nombre.charAt(0)}. ${apellido}` : `${nombre} ${apellido}`;
  }

  if (nombre) {
    const partes = nombre.trim().split(' ');
    if (options?.inicial && partes.length > 1) {
      return `${partes[0].charAt(0)}. ${partes[partes.length - 1]}`;
    }
    return nombre;
  }

  return 'Jugador';
};

const GraficoEstadisticasSet: FC<GraficoEstadisticasSetProps> = ({ setId }) => {
  const [estadisticas, setEstadisticas] = useState<EstadisticaJugadorSet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState<'tabla' | 'grafico'>('tabla');
  const [escalaLogaritmica, setEscalaLogaritmica] = useState<boolean>(false);
  const [ordenPor, setOrdenPor] = useState<OrdenCampo>('equipo');
  const [ordenDireccion, setOrdenDireccion] = useState<OrdenDireccion>('desc');

  useEffect(() => {
    const cargarEstadisticas = async (): Promise<void> => {
      if (!setId) return;

      try {
        setLoading(true);
        const data = await getEstadisticasJugadorSet(setId);
        setEstadisticas(Array.isArray(data) ? (data as EstadisticaJugadorSet[]) : []);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar estadísticas';
        console.error('Error cargando estadísticas:', err);
        setError(message);
        setEstadisticas([]);
      } finally {
        setLoading(false);
      }
    };

    void cargarEstadisticas();
  }, [setId]);

  // HOOKS: Preparar datos para el gráfico ANTES de cualquier return
  // Agrupar por equipos
  const equiposData = useMemo<EquiposData>(() => {
    const data: EquiposData = {};
    estadisticas.forEach(stat => {
      const equipoObj = stat?.equipo ?? {};
      const equipoId = typeof equipoObj === 'string'
        ? equipoObj
        : equipoObj?._id ?? 'sin-equipo';
      const equipoNombre = typeof equipoObj === 'string'
        ? equipoObj
        : equipoObj?.nombre ?? 'Equipo';

      if (!data[equipoId]) {
        data[equipoId] = {
          nombre: equipoNombre,
          totales: { throws: 0, hits: 0, outs: 0, catches: 0 },
          jugadores: [],
        };
      }

      data[equipoId].totales.throws += stat?.throws ?? 0;
      data[equipoId].totales.hits += stat?.hits ?? 0;
      data[equipoId].totales.outs += stat?.outs ?? 0;
      data[equipoId].totales.catches += stat?.catches ?? 0;
      data[equipoId].jugadores.push(stat);
    });
    return data;
  }, [estadisticas]);

  // Preparar datos para el gráfico con ordenamiento
  const datosGrafico = useMemo<DatosGrafico[]>(() => {
    const datos: DatosGrafico[] = [];
    const equiposUnicos: Record<string, { nombre: string; color: string; index: number }> = {};
    let colorIndex = 0;

    // Primero identificar equipos y asignar colores
    estadisticas.forEach(stat => {
      const equipoObj = stat?.equipo ?? {};
      const equipoId = typeof equipoObj === 'string'
        ? equipoObj
        : equipoObj?._id ?? 'sin-equipo';
      if (!equiposUnicos[equipoId]) {
        const equipoNombre = typeof equipoObj === 'string'
          ? equipoObj
          : equipoObj?.nombre ?? 'Equipo';
        equiposUnicos[equipoId] = {
          nombre: equipoNombre,
          color: COLORES_EQUIPO[colorIndex % COLORES_EQUIPO_LENGTH],
          index: colorIndex,
        };
        colorIndex += 1;
      }
    });

    // Luego crear datos con información de equipo
    estadisticas.forEach(stat => {
      const jugadorNombre = obtenerNombreJugador(stat?.jugador);
      const equipoObj = stat?.equipo ?? {};
      const equipoId = typeof equipoObj === 'string'
        ? equipoObj
        : equipoObj?._id ?? 'sin-equipo';
      const equipoNombre = equiposUnicos[equipoId]?.nombre ?? 'Equipo';
      const equipoInfo = equiposUnicos[equipoId];

      const throws = stat.throws ?? 0;
      const hits = stat.hits ?? 0;
      const outs = stat.outs ?? 0;
      const catches = stat.catches ?? 0;

      datos.push({
        nombre: jugadorNombre,
        equipo: equipoNombre,
        equipoId,
        equipoIndex: equipoInfo?.index ?? 0,
        colorFondo: equipoInfo?.color ?? COLORES_EQUIPO[0],
        Lanzamientos: ajustarParaLog(throws, escalaLogaritmica),
        Golpes: ajustarParaLog(hits, escalaLogaritmica),
        Outs: ajustarParaLog(outs, escalaLogaritmica),
        Atrapadas: ajustarParaLog(catches, escalaLogaritmica),
        lanzamientosReal: throws,
        golpesReal: hits,
        outsReal: outs,
        atrapadasReal: catches,
      });
    });

    // Aplicar ordenamiento
    if (ordenPor === 'equipo') {
      datos.sort((a, b) => {
        const equipoCompare = a.equipoIndex - b.equipoIndex;
        if (equipoCompare !== 0) return equipoCompare;
        return b.lanzamientosReal - a.lanzamientosReal;
      });
    } else {
      const campoMap: Record<Exclude<OrdenCampo, 'equipo'>, keyof DatosGrafico> = {
        throws: 'lanzamientosReal',
        hits: 'golpesReal',
        outs: 'outsReal',
        catches: 'atrapadasReal',
      };
      const campoOrden = campoMap[ordenPor as Exclude<OrdenCampo, 'equipo'>];
      datos.sort((a, b) => {
        const diff = (b[campoOrden] as number) - (a[campoOrden] as number);
        return ordenDireccion === 'desc' ? diff : -diff;
      });
    }

    return datos;
  }, [estadisticas, escalaLogaritmica, ordenPor, ordenDireccion]);
  
  // Returns tempranos DESPUÉS de los hooks
  if (loading) {
    return (
      <div className="text-center py-4 text-gray-600">
        <span className="text-sm">Cargando estadísticas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-600">
        <span className="text-sm">Error: {error}</span>
      </div>
    );
  }

  if (estadisticas.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <span className="text-sm">No hay estadísticas capturadas para este set</span>
      </div>
    );
  }
  
  // Custom tooltip con información del equipo
  const CustomTooltip = ({ active, payload, label }: TooltipPayload) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }
    
    // Obtener datos del jugador desde el payload
    // En gráfico de barras agrupadas, payload[0].payload contiene todos los datos del punto
    const jugadorData = payload[0]?.payload;
    
    if (!jugadorData) {
      return null;
    }
    
    
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg z-50">
        <p className="font-semibold text-gray-900">{label || jugadorData.nombre}</p>
        <p className="text-xs text-gray-600 mb-2">Equipo: {jugadorData.equipo}</p>
        <div className="space-y-1">
          <p style={{ color: '#3b82f6' }} className="text-sm">
            Lanzamientos: <span className="font-semibold">{jugadorData.lanzamientosReal ?? 0}</span>
          </p>
          <p style={{ color: '#10b981' }} className="text-sm">
            Golpes: <span className="font-semibold">{jugadorData.golpesReal ?? 0}</span>
          </p>
          <p style={{ color: '#ef4444' }} className="text-sm">
            Outs: <span className="font-semibold">{jugadorData.outsReal ?? 0}</span>
          </p>
          <p style={{ color: '#f59e0b' }} className="text-sm">
            Atrapadas: <span className="font-semibold">{jugadorData.atrapadasReal ?? 0}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 mt-3">
      {/* Toggle entre vista de tabla y gráfico */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActual('tabla')}
              className={`px-3 py-1 text-sm rounded ${
                vistaActual === 'tabla' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Tabla
            </button>
            <button
              onClick={() => setVistaActual('grafico')}
              className={`px-3 py-1 text-sm rounded ${
                vistaActual === 'grafico' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📈 Gráfico
            </button>
          </div>
          
          {/* Control de escala logarítmica (solo visible en vista gráfico) */}
          {vistaActual === 'grafico' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={escalaLogaritmica}
                  onChange={(e) => setEscalaLogaritmica(e.target.checked)}
                  className="mr-2"
                />
                Escala Logarítmica
              </label>
            </div>
          )}
        </div>
        
        {/* Controles de ordenamiento (solo visible en vista gráfico) */}
        {vistaActual === 'grafico' && (
          <div className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="text-sm font-medium text-gray-700">Ordenar por:</span>
            
            <select
              value={ordenPor}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setOrdenPor(e.target.value as OrdenCampo)}
              className="px-3 py-1 text-sm border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="equipo">📋 Por Equipos (separados)</option>
              <option value="throws">🎯 Lanzamientos</option>
              <option value="hits">⚡ Golpes</option>
              <option value="outs">❌ Outs</option>
              <option value="catches">🤲 Atrapadas</option>
            </select>
            
            {ordenPor !== 'equipo' && (
              <button
                onClick={() => setOrdenDireccion(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
                title={ordenDireccion === 'desc' ? 'Mayor a Menor' : 'Menor a Mayor'}
              >
                {ordenDireccion === 'desc' ? '⬇️ Mayor a Menor' : '⬆️ Menor a Mayor'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vista de Gráfico */}
      {vistaActual === 'grafico' && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">
            Estadísticas por Jugador {escalaLogaritmica && '(Escala Logarítmica)'}
          </h4>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              {/* Fondos de colores por equipo */}
              <defs>
                {datosGrafico.map((entry, index) => (
                  <pattern
                    key={`pattern-${index}`}
                    id={`pattern-${index}`}
                    patternUnits="userSpaceOnUse"
                    width="100%"
                    height="100%"
                  >
                    <rect width="100%" height="100%" fill={entry.colorFondo} />
                  </pattern>
                ))}
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" />
              
              {/* Eje X con fondo de color por equipo */}
              <XAxis 
                dataKey="nombre" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={(props) => {
                  const { x, y, payload, index } = props;
                  const data = datosGrafico[index];
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <rect
                        x={-20}
                        y={-10}
                        width={40}
                        height={90}
                        fill={data?.colorFondo || '#ffffff'}
                        opacity={0.5}
                      />
                      <text
                        x={0}
                        y={0}
                        dy={16}
                        textAnchor="end"
                        fill="#374151"
                        fontSize={11}
                        fontWeight={500}
                        transform="rotate(-45)"
                      >
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
              />
              
              {/* Eje Y con escala logarítmica opcional */}
              <YAxis 
                scale={escalaLogaritmica ? 'log' : 'linear'}
                domain={escalaLogaritmica ? [0.1, 'auto'] : [0, 'auto']}
                allowDataOverflow={false}
                tickFormatter={(value) => {
                  // En escala log, formatear para ocultar el 0.1 artificial
                  if (escalaLogaritmica && value < 1) {
                    return '0';
                  }
                  return Math.round(value).toString();
                }}
                label={{ 
                  value: 'Cantidad', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 12, fill: '#6b7280' }
                }}
              />
              
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                shared={true}
                allowEscapeViewBox={{ x: false, y: true }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
              />
              
              <Bar dataKey="Lanzamientos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Golpes" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outs" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Atrapadas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          
          {/* Leyenda de equipos */}
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {Object.values(
              datosGrafico.reduce<Record<string, { equipo: string; color: string }>>((acc, item) => {
                if (!acc[item.equipoId]) {
                  acc[item.equipoId] = { equipo: item.equipo, color: item.colorFondo };
                }
                return acc;
              }, {})
              ).map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded border border-gray-300" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700 font-medium">{item.equipo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista de Tabla */}
      {vistaActual === 'tabla' && (
        <>
          {Object.entries(equiposData).map(([equipoId, equipoInfo]) => (
            <div key={equipoId} className="border rounded-lg overflow-hidden bg-white">
              {/* Header del equipo con totales */}
              <div className="bg-blue-600 text-white px-4 py-2">
                <h4 className="font-semibold">{equipoInfo.nombre}</h4>
                <div className="grid grid-cols-4 gap-2 mt-1 text-xs">
                  <div>
                    <span className="opacity-75">Lanzamientos:</span>
                    <span className="ml-1 font-semibold">{equipoInfo.totales.throws}</span>
                  </div>
                  <div>
                    <span className="opacity-75">Golpes:</span>
                    <span className="ml-1 font-semibold">{equipoInfo.totales.hits}</span>
                  </div>
                  <div>
                    <span className="opacity-75">Outs:</span>
                    <span className="ml-1 font-semibold">{equipoInfo.totales.outs}</span>
                  </div>
                  <div>
                    <span className="opacity-75">Atrapadas:</span>
                    <span className="ml-1 font-semibold">{equipoInfo.totales.catches}</span>
                  </div>
                </div>
              </div>

              {/* Tabla de jugadores */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Jugador
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Lanzamientos
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Golpes
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Outs
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Atrapadas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {equipoInfo.jugadores.map((stat, indexJugador) => {
                      const jugadorNombre = obtenerNombreJugador(stat?.jugador, { inicial: true });
                      
                      return (
                        <tr key={stat._id ?? `${equipoId}-${indexJugador}`} className={indexJugador % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {jugadorNombre}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-center">
                            {stat.throws || 0}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-center">
                            {stat.hits || 0}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-center">
                            {stat.outs || 0}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-center">
                            {stat.catches || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default GraficoEstadisticasSet;

