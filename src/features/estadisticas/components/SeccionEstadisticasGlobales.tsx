import { useEffect, useCallback, useState, type FC, type ReactNode } from 'react';
import type {
  EstadisticaManualEquipo,
  EstadisticaManualJugador,
  EstadisticaJugadorSetDetalle,
} from '../services/estadisticasService';
import { renderEstadisticasGenerales } from './EstadisticasGenerales';
import { renderEstadisticasEquipos } from './EstadisticasEquipos';
import { renderEstadisticasJugadores } from './EstadisticasJugadores';

// Servicios globales (sin partido) usando endpoints existentes con filtros opcionales
import { authFetch } from '../../../utils/authFetch';

type VistaEstadisticas = 'general' | 'equipos' | 'jugadores';

type ModoEstadisticas = 'automatico' | 'manual';

type FiltrosGlobales = {
  equipoId: string;
};

// Endpoints globales
async function getEstadisticasJugadorSetGlobal(equipoId: string) {
  const url = `/estadisticas/jugador-set?equipo=${encodeURIComponent(equipoId)}`;
  return authFetch<EstadisticaJugadorSetDetalle[]>(url);
}

async function getEstadisticasManualJugadorPartidoGlobal(equipoId: string) {
  const url = `/estadisticas/jugador-partido-manual?equipo=${encodeURIComponent(equipoId)}`;
  return authFetch<EstadisticaManualJugador[]>(url);
}

// Tipos locales
type JugadorEstadistica = EstadisticaManualJugador & {
  fuente?: string;
};

interface EstadisticasData {
  jugadores: JugadorEstadistica[];
  equipos: EstadisticaManualEquipo[];
}

interface SeccionEstadisticasGlobalesProps {
  equipoId: string;
}

export const SeccionEstadisticasGlobales: FC<SeccionEstadisticasGlobalesProps> = ({ equipoId }) => {
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<ModoEstadisticas>('automatico');
  const [vista, setVista] = useState<VistaEstadisticas>('equipos');
  const [data, setData] = useState<EstadisticasData>({ jugadores: [], equipos: [] });
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!equipoId) {
      setMensaje('Seleccioná un equipo para ver estadísticas globales.');
      setData({ jugadores: [], equipos: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (modo === 'automatico') {
        const stats = await getEstadisticasJugadorSetGlobal(equipoId);
        // Agregar por jugador (id de jugador si está disponible; fallback jugadorPartido)
        const jugadoresMap = new Map<string, JugadorEstadistica>();
        const equiposMap = new Map<string, EstadisticaManualEquipo & { jugadores?: number; _unique?: Set<string> }>();

        (stats || []).forEach((s) => {
          const jugadorObj: any = s.jugador || (typeof s.jugadorPartido === 'object' ? (s.jugadorPartido as any)?.jugador : undefined);
          const jugadorId = typeof jugadorObj === 'string' ? jugadorObj : jugadorObj?._id;
          const jpObj: any = s.jugadorPartido;
          const jpId = typeof jpObj === 'string' ? jpObj : jpObj?._id;
          const key = jugadorId || jpId;
          if (!key) return;

          const base: JugadorEstadistica = jugadoresMap.get(key) || {
            _id: key,
            jugadorPartido: s.jugadorPartido as any,
            throws: 0,
            hits: 0,
            outs: 0,
            catches: 0,
            tipoCaptura: 'automatica',
          };
          base.throws = (base.throws ?? 0) + (s.throws ?? 0);
          base.hits = (base.hits ?? 0) + (s.hits ?? 0);
          base.outs = (base.outs ?? 0) + (s.outs ?? 0);
          base.catches = (base.catches ?? 0) + (s.catches ?? 0);
          jugadoresMap.set(key, base);

          // equipos (filtrado al equipoId)
          const equipoInfo: any = s.equipo || (typeof s.jugadorPartido === 'object' ? (s.jugadorPartido as any)?.equipo : undefined);
          const equipoActualId = typeof equipoInfo === 'string' ? equipoInfo : equipoInfo?._id;
          if (equipoActualId && String(equipoActualId) === String(equipoId)) {
            const existing: any = equiposMap.get(equipoId) || {
              _id: equipoId,
              nombre: typeof equipoInfo === 'object' ? equipoInfo?.nombre : undefined,
              escudo: typeof equipoInfo === 'object' ? equipoInfo?.escudo : undefined,
              throws: 0,
              hits: 0,
              outs: 0,
              catches: 0,
              jugadores: 0,
              _unique: new Set<string>(),
            };
            existing.throws = (existing.throws ?? 0) + (s.throws ?? 0);
            existing.hits = (existing.hits ?? 0) + (s.hits ?? 0);
            existing.outs = (existing.outs ?? 0) + (s.outs ?? 0);
            existing.catches = (existing.catches ?? 0) + (s.catches ?? 0);
            const unique = existing._unique as Set<string>;
            if (jpId && !unique.has(jpId)) {
              unique.add(jpId);
              existing.jugadores = (existing.jugadores ?? 0) + 1;
            }
            equiposMap.set(equipoId, existing);
          }
        });

        const equipos = Array.from(equiposMap.values()).map((e: any) => ({
          ...e,
          efectividad: e.throws && e.throws > 0 ? Number((((e.hits ?? 0) / e.throws) * 100).toFixed(1)) : 0,
        }));
        setData({ jugadores: Array.from(jugadoresMap.values()), equipos });
      } else {
        const manual = await getEstadisticasManualJugadorPartidoGlobal(equipoId);
        const jugadores = (manual || []).map((j) => ({
          ...j,
          throws: j.throws ?? 0,
          hits: j.hits ?? 0,
          outs: j.outs ?? 0,
          catches: j.catches ?? 0,
        }));
        // equipos desde manual
        const equiposMap = new Map<string, EstadisticaManualEquipo & { jugadores?: number; _unique?: Set<string> }>();
        jugadores.forEach((j) => {
          const jp: any = j.jugadorPartido;
          const equipo = typeof jp === 'object' ? jp?.equipo : undefined;
          const equipoActualId = typeof equipo === 'string' ? equipo : equipo?._id;
          if (equipoActualId && String(equipoActualId) === String(equipoId)) {
            const e: any = equiposMap.get(equipoId) || {
              _id: equipoId,
              nombre: typeof equipo === 'object' ? equipo?.nombre : undefined,
              escudo: typeof equipo === 'object' ? equipo?.escudo : undefined,
              throws: 0,
              hits: 0,
              outs: 0,
              catches: 0,
              jugadores: 0,
              _unique: new Set<string>(),
            };
            e.throws += j.throws ?? 0;
            e.hits += j.hits ?? 0;
            e.outs += j.outs ?? 0;
            e.catches += j.catches ?? 0;
            const jpId = typeof jp === 'string' ? jp : jp?._id;
            const unique = e._unique as Set<string>;
            if (jpId && !unique.has(jpId)) {
              unique.add(jpId);
              e.jugadores += 1;
            }
            equiposMap.set(equipoId, e);
          }
        });
        const equipos = Array.from(equiposMap.values()).map((e) => ({
          ...e,
          efectividad: e.throws && e.throws > 0 ? Number((((e.hits ?? 0) / e.throws) * 100).toFixed(1)) : 0,
        }));
        setData({ jugadores, equipos });
      }
      setMensaje(null);
      if ((modo === 'automatico' && data.jugadores.length === 0 && data.equipos.length === 0) || (modo === 'manual' && data.jugadores.length === 0 && data.equipos.length === 0)) {
        setMensaje('No hay estadísticas capturadas aún para este equipo.');
      }
    } finally {
      setLoading(false);
    }
  }, [modo, equipoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (loading) return <div>Cargando estadísticas globales...</div>;

  const panelControles = (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Modo:</span>
        <select
          value={modo}
          onChange={(e) => setModo(e.target.value as ModoEstadisticas)}
          className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="automatico">📊 Automático (por set)</option>
          <option value="manual">✏️ Manual (totales)</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setVista('general')}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm ${vista === 'general' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          General
        </button>
        <button
          onClick={() => setVista('equipos')}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm ${vista === 'equipos' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          Equipos
        </button>
        <button
          onClick={() => setVista('jugadores')}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm ${vista === 'jugadores' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          Jugadores
        </button>
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
      <div className="mb-2 sm:mb-4">
        <h4 className="text-lg font-semibold text-emerald-800">🌐 Estadísticas Globales</h4>
        <p className="text-sm text-emerald-700">Acumulado de todos los partidos del equipo</p>
      </div>
      {panelControles}
      {mensaje ? (
        <p className="mb-3 text-sm text-emerald-800/80">{mensaje}</p>
      ) : null}

      {((): ReactNode => {
        switch (vista) {
          case 'general':
            return renderEstadisticasGenerales({ jugadores: data.jugadores, equipos: data.equipos, setsInfo: [] } as any, undefined, modo, modo);
          case 'equipos':
            return renderEstadisticasEquipos({ jugadores: data.jugadores, equipos: data.equipos }, undefined);
          case 'jugadores':
          default:
            return renderEstadisticasJugadores({ jugadores: data.jugadores }, undefined);
        }
      })()}
    </div>
  );
};

export default SeccionEstadisticasGlobales;
