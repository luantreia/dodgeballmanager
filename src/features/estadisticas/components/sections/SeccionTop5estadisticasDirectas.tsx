import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { authFetch } from '../../../../utils/authFetch';
import { getEstadisticasJugadorPartidoManualPorEquipo } from '../../services/estadisticasService';
import { formatNumber } from '../../../../utils/formatNumber';

interface Props {
  equipoId: string;
  titulo?: string;
}

type Agg = {
  id: string;
  nombre: string;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  efectividad: number; // % hits/throws
  hoc: number; // (hits + catches) / outs
};

export const SeccionTop5estadisticasDirectas: FC<Props> = ({ equipoId, titulo = 'Ranking de jugadores' }) => {
  const [ordenTop, setOrdenTop] = useState<'efectividad' | 'hoc'>('efectividad');
  const [aggManual, setAggManual] = useState<Agg[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!equipoId) {
      setAggManual([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Intento con filtro por equipo; si no viene nada, traigo todo y filtro por jugadorPartido.equipo
      const porEquipo = await getEstadisticasJugadorPartidoManualPorEquipo(equipoId);
      const manualStats = porEquipo && porEquipo.length ? porEquipo : await authFetch<any[]>(`/estadisticas/jugador-partido-manual`);

      // Agregado por jugador
      const map = new Map<string, Agg>();
      (manualStats || []).forEach((j: any) => {
        const jp: any = j.jugadorPartido;
        const equipoInfo: any = typeof jp === 'object' ? jp?.equipo : undefined;
        const equipoIdStat = typeof equipoInfo === 'string' ? equipoInfo : equipoInfo?._id;
        if (String(equipoIdStat) !== String(equipoId)) return;
        const jugadorObj: any = typeof jp === 'object' ? jp?.jugador : undefined;
        const jugadorId = typeof jugadorObj === 'string' ? jugadorObj : jugadorObj?._id;
        const key = jugadorId || (typeof jp === 'string' ? jp : jp?._id);
        if (!key) return;
        const nombre = jugadorObj ? `${jugadorObj?.nombre ?? ''} ${jugadorObj?.apellido ?? ''}`.trim() : 'Sin nombre';
        const base: Agg = map.get(key) || { id: key, nombre, throws: 0, hits: 0, outs: 0, catches: 0, efectividad: 0, hoc: 0 };
        base.throws += j.throws ?? 0;
        base.hits += j.hits ?? 0;
        base.outs += j.outs ?? 0;
        base.catches += j.catches ?? 0;
        map.set(key, base);
      });

      const agregados: Agg[] = Array.from(map.values()).map((p) => ({
        ...p,
        efectividad: p.throws > 0 ? (p.hits / p.throws) * 100 : 0,
        hoc: p.outs > 0 ? (p.hits + p.catches) / p.outs : (p.hits + p.catches),
      }));
      setAggManual(agregados);
    } finally {
      setLoading(false);
    }
  }, [equipoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const top5 = useMemo(() => {
    const arr = [...aggManual];
    arr.sort((a, b) => {
      if (ordenTop === 'efectividad') return b.efectividad - a.efectividad;
      return b.hoc - a.hoc;
    });
    return arr.slice(0, 5);
  }, [aggManual, ordenTop]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Ordenar por</span>
          <select
            value={ordenTop}
            onChange={(e) => setOrdenTop(e.target.value as 'efectividad' | 'hoc')}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="efectividad">% Efectividad (hits/throws)</option>
            <option value="hoc">HOC ((hits + catches) / outs)</option>
          </select>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Cargando ranking...</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Jugador</th>
                  <th className="px-4 py-3 text-right">% Efectividad</th>
                  <th className="px-4 py-3 text-right">HOC</th>
                  <th className="px-4 py-3 text-right">Throws</th>
                  <th className="px-4 py-3 text-right">Hits</th>
                  <th className="px-4 py-3 text-right">Catches</th>
                  <th className="px-4 py-3 text-right">Outs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {top5.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.nombre}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(p.efectividad)}%</td>
                    <td className="px-4 py-3 text-right">{formatNumber(p.hoc)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(p.throws)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(p.hits)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(p.catches)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(p.outs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {top5.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">Aún no hay estadísticas registradas.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default SeccionTop5estadisticasDirectas;
