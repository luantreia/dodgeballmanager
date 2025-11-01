import React, { useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import JugadorEstadisticasCard from '../common/JugadorEstadisticasCard';
import { extractEquipoId, type PartidoDetallado } from '../../services/partidoService';
import {
  getJugadoresPartido,
  getEstadisticasJugadorPartidoManual,
  guardarEstadisticaManualJugadorPartido,
  actualizarEstadisticaManualJugadorPartido,
  type JugadorPartidoResumen,
  type EstadisticaManualJugador,
} from '../../../estadisticas/services/estadisticasService';

// (Asignación de jugadores se gestiona en ModalAlineacionPartido)

interface ModalEstadisticasGeneralesCapturaProps {
  partido: PartidoDetallado | null;
  partidoId: string;
  token: string;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  datosIniciales?: EstadisticaManualJugador[]; // ignorado en este flujo simplificado
  hayDatosAutomaticos?: boolean; // ignorado en este flujo simplificado
  onAbrirAlineacion?: () => void; // ignorado en este flujo simplificado
}

const ModalEstadisticasGeneralesCaptura: React.FC<ModalEstadisticasGeneralesCapturaProps> = ({
  partido,
  partidoId,
  token,
  onClose,
  onRefresh,
  datosIniciales, // eslint-disable-line @typescript-eslint/no-unused-vars
  hayDatosAutomaticos, // eslint-disable-line @typescript-eslint/no-unused-vars
  onAbrirAlineacion, // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const [jugadores, setJugadores] = useState<JugadorPartidoResumen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [statsByJp, setStatsByJp] = useState<Record<string, { _id?: string; throws: number; hits: number; outs: number; catches: number }>>({});

  const equipoLocalId = useMemo(() => extractEquipoId(partido?.equipoLocal), [partido]);
  const equipoVisitanteId = useMemo(() => extractEquipoId(partido?.equipoVisitante), [partido]);

  useEffect(() => {
    let cancelado = false;
    const cargar = async (): Promise<void> => {
      try {
        setLoading(true);
        const [jp, manuales] = await Promise.all([
          getJugadoresPartido(partidoId),
          getEstadisticasJugadorPartidoManual(partidoId),
        ]);
        if (cancelado) return;
        setJugadores(Array.isArray(jp) ? jp : []);

        const mapa: Record<string, { _id?: string; throws: number; hits: number; outs: number; catches: number }> = {};
        const listaManuales = Array.isArray(manuales) ? manuales : [];

        listaManuales.forEach((m) => {
          const jpId = typeof m.jugadorPartido === 'string' ? m.jugadorPartido : m.jugadorPartido?._id;
          if (!jpId) return;
          mapa[jpId] = {
            _id: m._id,
            throws: m.throws ?? 0,
            hits: m.hits ?? 0,
            outs: m.outs ?? 0,
            catches: m.catches ?? 0,
          };
        });

        (Array.isArray(jp) ? jp : []).forEach((j) => {
          if (!mapa[j._id]) {
            mapa[j._id] = { throws: 0, hits: 0, outs: 0, catches: 0 };
          }
        });

        setStatsByJp(mapa);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [partidoId]);

  const jugadoresLocal = useMemo(
    () => jugadores.filter((j) => (typeof j.equipo === 'string' ? j.equipo === equipoLocalId : j.equipo?._id === equipoLocalId)),
    [jugadores, equipoLocalId],
  );
  const jugadoresVisitante = useMemo(
    () => jugadores.filter((j) => (typeof j.equipo === 'string' ? j.equipo === equipoVisitanteId : j.equipo?._id === equipoVisitanteId)),
    [jugadores, equipoVisitanteId],
  );

  const cambiarEstadistica = (jugadorPartidoId: string, campo: 'throws' | 'hits' | 'outs' | 'catches', delta: number) => {
    setStatsByJp((prev) => {
      const actual = prev[jugadorPartidoId] ?? { throws: 0, hits: 0, outs: 0, catches: 0 };
      const nextVal = Math.max(0, (actual[campo] ?? 0) + delta);
      return { ...prev, [jugadorPartidoId]: { ...actual, [campo]: nextVal } };
    });
  };

  const guardar = async (): Promise<void> => {
    setGuardando(true);
    try {
      const tareas: Array<Promise<unknown>> = [];
      jugadores.forEach((j) => {
        const jpId = j._id;
        const stats = statsByJp[jpId];
        if (!stats) return;
        const payload = {
          jugadorPartido: jpId,
          throws: stats.throws ?? 0,
          hits: stats.hits ?? 0,
          outs: stats.outs ?? 0,
          catches: stats.catches ?? 0,
          tipoCaptura: 'manual',
        } as const;
        if (stats._id) {
          tareas.push(actualizarEstadisticaManualJugadorPartido(stats._id, payload));
        } else {
          tareas.push(guardarEstadisticaManualJugadorPartido(payload));
        }
      });
      await Promise.all(tareas);
      await Promise.resolve(onRefresh?.());
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalBase title="Captura de estadísticas directas" onClose={onClose} size="xl" isOpen>
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Cargando jugadores y estadísticas...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-blue-800">
                {partido?.equipoLocal && typeof partido.equipoLocal !== 'string'
                  ? partido.equipoLocal.nombre || 'Local'
                  : 'Local'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[70vh] overflow-y-auto pr-1">
                {jugadoresLocal.map((j, idx) => {
                  const nombre = (() => {
                    const jj = j.jugador as any;
                    if (!jj) return '';
                    if (typeof jj === 'string') return jj;
                    return jj.nombre || jj.apellido || jj.name || jj.fullName || '';
                  })();
                  const stats = statsByJp[j._id] ?? { throws: 0, hits: 0, outs: 0, catches: 0 };
                  return (
                    <JugadorEstadisticasCard
                      key={`local-${j._id}`}
                      index={idx}
                      jugadorId={j._id}
                      opcionesJugadores={[{ value: j._id, label: nombre || 'Jugador' }]}
                      onCambiarJugador={() => { /* no-op, la alineación se gestiona en otro modal */ }}
                      onCambiarEstadistica={(campo: 'throws' | 'hits' | 'outs' | 'catches', delta: number) => cambiarEstadistica(j._id, campo, delta)}
                      estadisticasJugador={stats}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-red-800">
                {partido?.equipoVisitante && typeof partido.equipoVisitante !== 'string'
                  ? partido.equipoVisitante.nombre || 'Visitante'
                  : 'Visitante'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[70vh] overflow-y-auto pr-1">
                {jugadoresVisitante.map((j, idx) => {
                  const nombre = (() => {
                    const jj = j.jugador as any;
                    if (!jj) return '';
                    if (typeof jj === 'string') return jj;
                    return jj.nombre || jj.apellido || jj.name || jj.fullName || '';
                  })();
                  const stats = statsByJp[j._id] ?? { throws: 0, hits: 0, outs: 0, catches: 0 };
                  return (
                    <JugadorEstadisticasCard
                      key={`visitante-${j._id}`}
                      index={idx}
                      jugadorId={j._id}
                      opcionesJugadores={[{ value: j._id, label: nombre || 'Jugador' }]}
                      onCambiarJugador={() => { /* no-op */ }}
                      onCambiarEstadistica={(campo, delta) => cambiarEstadistica(j._id, campo, delta)}
                      estadisticasJugador={stats}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar estadísticas del partido'}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  );
};

export default ModalEstadisticasGeneralesCaptura;
