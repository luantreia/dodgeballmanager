import { useEffect, useMemo, useState } from 'react';
import { getTemporadasByCompetencia, getFasesByTemporada } from '../../partidos/services/partidoService';
import { getTablaFase, type TablaFase } from '../services/tablaService';

type Props = {
  competenciaId: string;
  competenciaNombre: string;
  /** Para resaltar la fila del equipo propio: es lo único que el DT busca al abrir esto. */
  equipoId: string;
};

type Opcion = { _id: string; nombre?: string };

/**
 * Tabla de posiciones de una competencia del equipo.
 *
 * El cálculo vive en el backend desde siempre (`StandingsService`), pero sólo se usaba
 * internamente para promover equipos de fase: el DT no tenía forma de ver dónde estaba parado.
 * Esta pantalla lee lo ya calculado; no recalcula nada.
 *
 * Arranca colapsada y sólo pide datos al abrirse: una competencia con varias temporadas y fases
 * son tres requests encadenados, y cargarlos para todas las participaciones del equipo apenas
 * entra a la pantalla sería gratuito sólo si los mirara todos, que no es el caso.
 */
const TablaPosiciones = ({ competenciaId, competenciaNombre, equipoId }: Props) => {
  const [abierta, setAbierta] = useState(false);
  const [temporadas, setTemporadas] = useState<Opcion[]>([]);
  const [fases, setFases] = useState<Opcion[]>([]);
  const [temporadaId, setTemporadaId] = useState('');
  const [faseId, setFaseId] = useState('');
  const [tabla, setTabla] = useState<TablaFase | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta || temporadas.length > 0) return;
    let cancelado = false;
    setCargando(true);
    getTemporadasByCompetencia(competenciaId)
      .then((data) => {
        if (cancelado) return;
        const lista = Array.isArray(data) ? data : [];
        setTemporadas(lista);
        // La más reciente primero: es la que el DT quiere ver el 95% de las veces.
        if (lista.length > 0) setTemporadaId(lista[lista.length - 1]._id);
      })
      .catch(() => !cancelado && setError('No pudimos cargar las temporadas.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [abierta, competenciaId, temporadas.length]);

  useEffect(() => {
    if (!temporadaId) {
      setFases([]);
      setFaseId('');
      return;
    }
    let cancelado = false;
    getFasesByTemporada(temporadaId)
      .then((data) => {
        if (cancelado) return;
        const lista = Array.isArray(data) ? data : [];
        setFases(lista);
        setFaseId(lista.length > 0 ? lista[lista.length - 1]._id : '');
      })
      .catch(() => !cancelado && setError('No pudimos cargar las fases.'));
    return () => {
      cancelado = true;
    };
  }, [temporadaId]);

  useEffect(() => {
    if (!faseId) {
      setTabla(null);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    getTablaFase(faseId)
      .then((data) => !cancelado && setTabla(data))
      .catch(() => !cancelado && setError('No pudimos cargar la tabla de esta fase.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [faseId]);

  /** Las fases con grupos o divisiones son varias tablas, no una sola con una columna extra. */
  const bloques = useMemo(() => {
    if (!tabla) return [];
    const mapa = new Map<string, TablaFase['posiciones']>();
    for (const fila of tabla.posiciones) {
      const clave = [fila.division, fila.grupo].filter(Boolean).join(' · ') || '';
      const lista = mapa.get(clave);
      if (lista) lista.push(fila);
      else mapa.set(clave, [fila]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [tabla]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">
          Tabla de posiciones
          <span className="ml-2 font-normal text-slate-500">{competenciaNombre}</span>
        </span>
        <span aria-hidden className="text-slate-400">
          {abierta ? '▲' : '▼'}
        </span>
      </button>

      {abierta && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Temporada
              <select
                value={temporadaId}
                onChange={(e) => setTemporadaId(e.target.value)}
                disabled={temporadas.length === 0}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {temporadas.length === 0 && <option value="">Sin temporadas</option>}
                {temporadas.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.nombre ?? 'Temporada'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Fase
              <select
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                disabled={fases.length === 0}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {fases.length === 0 && <option value="">Sin fases</option>}
                {fases.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.nombre ?? 'Fase'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : cargando ? (
            <p className="py-4 text-center text-sm text-slate-500">Cargando…</p>
          ) : !tabla || tabla.posiciones.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Esta fase todavía no tiene equipos cargados.
            </p>
          ) : (
            <>
              {!tabla.calculada && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  La organización todavía no cerró las posiciones de esta fase. El orden que ves
                  es por puntos y diferencia, sin aplicar los criterios de desempate configurados.
                </p>
              )}

              {bloques.map(([titulo, filas]) => (
                <div key={titulo || 'general'} className="space-y-1">
                  {titulo && (
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{titulo}</h4>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[26rem] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="py-1.5 pr-2 font-semibold">#</th>
                          <th className="py-1.5 pr-2 font-semibold">Equipo</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">PJ</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">G</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">E</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">P</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Dif</th>
                          <th className="py-1.5 text-right font-semibold">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {filas.map((fila, indice) => {
                          const esPropio = fila.equipo?._id === equipoId;
                          return (
                            <tr
                              key={fila._id}
                              className={`border-b border-slate-100 last:border-0 ${
                                esPropio ? 'bg-brand-50 font-semibold text-brand-900' : ''
                              }`}
                            >
                              <td className="py-1.5 pr-2 text-slate-500">{fila.posicion ?? indice + 1}</td>
                              <td className="py-1.5 pr-2">
                                <span className="flex items-center gap-1.5">
                                  {fila.equipo?.nombre ?? 'Equipo'}
                                  {fila.clasificado && (
                                    <span
                                      title="Clasificado"
                                      className="rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-700"
                                    >
                                      C
                                    </span>
                                  )}
                                  {fila.eliminado && (
                                    <span
                                      title="Eliminado"
                                      className="rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700"
                                    >
                                      E
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-1.5 pr-2 text-right text-slate-600">{fila.partidosJugados}</td>
                              <td className="py-1.5 pr-2 text-right text-slate-600">{fila.partidosGanados}</td>
                              <td className="py-1.5 pr-2 text-right text-slate-600">{fila.partidosEmpatados}</td>
                              <td className="py-1.5 pr-2 text-right text-slate-600">{fila.partidosPerdidos}</td>
                              <td className="py-1.5 pr-2 text-right text-slate-600">
                                {fila.diferenciaPuntos > 0 ? `+${fila.diferenciaPuntos}` : fila.diferenciaPuntos}
                              </td>
                              <td className="py-1.5 text-right font-bold text-slate-900">{fila.puntos}</td>
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
      )}
    </section>
  );
};

export default TablaPosiciones;
