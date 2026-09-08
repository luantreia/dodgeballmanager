import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import TablaScroll from '../../../shared/components/TablaScroll/TablaScroll';
import EstadoVacio from '../../../shared/components/EstadoVacio/EstadoVacio';
import PartidoCard from '../../../shared/components/PartidoCard/PartidoCard';
import { getTablaFase, type FilaTabla, type TablaFase } from '../services/tablaService';
import { getHabilitacionesCompetencia, type HabilitacionJugador } from '../services/jugadorCompetenciaService';
import {
  getPartidos,
  getTemporadasByCompetencia,
  getFasesByTemporada,
} from '../../partidos/services/partidoService';
import { getJugadoresEquipo } from '../../jugadores/services/jugadorEquipoService';
import type { Jugador, Partido } from '../../../shared/utils/types/types';

type Props = {
  competenciaId: string;
  competenciaNombre: string;
  equipoId: string;
  onVolver: () => void;
};

type Pestana = 'torneo' | 'plantel' | 'rendimiento';

const PESTANAS: Array<{ id: Pestana; label: string }> = [
  { id: 'torneo', label: 'Torneo' },
  { id: 'plantel', label: 'Plantel' },
  { id: 'rendimiento', label: 'Rendimiento' },
];

type Opcion = { _id: string; nombre?: string };

const nombreJugador = (j: Jugador): string => j.nombre?.trim() || 'Jugador';

/**
 * Una competencia, adentro.
 *
 * La pantalla de competencias era una lista de tarjetas y un buscador para inscribirse: pura
 * consulta. Todo lo que un DT necesita saber de un torneo en curso —en qué fase está, qué
 * posición ocupa, si clasificó, quién de su plantel está habilitado— ya vivía en el backend
 * (`ParticipacionFase` guarda puntos, posición, `clasificado` y `eliminado`) y no se mostraba en
 * ningún lado.
 *
 * Las tres pestañas son las tres preguntas distintas que se le hacen a un torneo:
 *
 * - **Torneo**: dónde estamos parados. Fase actual, tabla, y qué falta jugar.
 * - **Plantel**: quién está en regla. Cruza el plantel propio con los habilitados de la
 *   competencia, que es lo que evita el papelón de llevar a alguien que no puede jugar.
 * - **Rendimiento**: cómo nos fue acá. Es el mismo análisis de Estadísticas pero acotado a esta
 *   competencia, sin tener que ir a armar el filtro a mano.
 */
const DetalleCompetencia = ({ competenciaId, competenciaNombre, equipoId, onVolver }: Props) => {
  const { addToast } = useToast();
  const [pestana, setPestana] = useState<Pestana>('torneo');

  const [temporadas, setTemporadas] = useState<Opcion[]>([]);
  const [temporadaId, setTemporadaId] = useState('');
  const [fases, setFases] = useState<Opcion[]>([]);
  const [faseId, setFaseId] = useState('');
  const [tabla, setTabla] = useState<TablaFase | null>(null);

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [plantel, setPlantel] = useState<Jugador[]>([]);
  const [habilitaciones, setHabilitaciones] = useState<Map<string, HabilitacionJugador>>(new Map());

  const [cargando, setCargando] = useState(true);

  const avisar = useCallback(
    (mensaje: string) => addToast({ type: 'error', title: 'Error', message: mensaje }),
    [addToast],
  );

  // Temporadas de la competencia. La última es la que interesa por defecto: un DT entra a ver
  // el torneo que está jugando, no el del año pasado.
  useEffect(() => {
    let cancelado = false;
    getTemporadasByCompetencia(competenciaId)
      .then((data) => {
        if (cancelado) return;
        setTemporadas(data);
        setTemporadaId((actual) => actual || data[data.length - 1]?._id || '');
      })
      .catch(() => !cancelado && avisar('No pudimos cargar las temporadas.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [competenciaId, avisar]);

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
        setFases(data);
        setFaseId(data[data.length - 1]?._id || '');
      })
      .catch(() => !cancelado && avisar('No pudimos cargar las fases.'));
    return () => {
      cancelado = true;
    };
  }, [temporadaId, avisar]);

  useEffect(() => {
    if (!faseId) {
      setTabla(null);
      return;
    }
    let cancelado = false;
    getTablaFase(faseId)
      .then((data) => !cancelado && setTabla(data))
      .catch(() => !cancelado && setTabla(null));
    return () => {
      cancelado = true;
    };
  }, [faseId]);

  useEffect(() => {
    let cancelado = false;
    getPartidos({ equipoId, competenciaId })
      .then((data) => !cancelado && setPartidos(data))
      .catch(() => !cancelado && avisar('No pudimos cargar los partidos de esta competencia.'));
    return () => {
      cancelado = true;
    };
  }, [equipoId, competenciaId, avisar]);

  useEffect(() => {
    if (pestana !== 'plantel') return;
    let cancelado = false;
    Promise.all([getJugadoresEquipo({ equipoId }), getHabilitacionesCompetencia(competenciaId)])
      .then(([jugadores, mapa]) => {
        if (cancelado) return;
        setPlantel(jugadores);
        setHabilitaciones(mapa);
      })
      .catch(() => !cancelado && avisar('No pudimos cargar las habilitaciones.'));
    return () => {
      cancelado = true;
    };
  }, [pestana, equipoId, competenciaId, avisar]);

  /** La fila del equipo propio dentro de la tabla: es la única que se lee primero. */
  const miFila = useMemo<FilaTabla | null>(
    () => tabla?.posiciones.find((f) => f.equipo?._id === equipoId) ?? null,
    [tabla, equipoId],
  );

  const pendientes = useMemo(
    () => partidos.filter((p) => p.estado === 'programado' || p.estado === 'en_juego'),
    [partidos],
  );

  const jugados = useMemo(() => partidos.filter((p) => p.estado === 'finalizado'), [partidos]);

  const habilitados = useMemo(
    () => plantel.filter((j) => habilitaciones.get(String(j.id))?.estado === 'aceptado'),
    [plantel, habilitaciones],
  );
  const suspendidos = useMemo(
    () => plantel.filter((j) => habilitaciones.get(String(j.id))?.estado === 'suspendido'),
    [plantel, habilitaciones],
  );
  const sinInscribir = useMemo(
    () => plantel.filter((j) => !habilitaciones.has(String(j.id))),
    [plantel, habilitaciones],
  );

  const balance = useMemo(() => {
    let ganados = 0;
    let perdidos = 0;
    jugados.forEach((p) => {
      const esLocal = p.equipoLocal?._id === equipoId;
      const propio = esLocal ? p.marcadorLocal : p.marcadorVisitante;
      const rival = esLocal ? p.marcadorVisitante : p.marcadorLocal;
      if (typeof propio !== 'number' || typeof rival !== 'number') return;
      if (propio > rival) ganados += 1;
      else if (propio < rival) perdidos += 1;
    });
    return { ganados, perdidos, jugados: jugados.length };
  }, [jugados, equipoId]);

  if (cargando) return <p className="text-sm text-slate-500">Cargando competencia…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="min-h-[2.75rem] rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition [touch-action:manipulation] hover:border-slate-300"
        >
          ← Competencias
        </button>
        <h2 className="text-xl font-semibold text-slate-900">{competenciaNombre}</h2>
      </div>

      {/* El estado en una línea, antes de cualquier tabla: es lo que se viene a saber. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {miFila ? (
          <>
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {miFila.posicion !== null ? `${miFila.posicion}°` : '—'}
            </span>
            <div className="text-xs text-slate-500">
              <p className="font-semibold text-slate-700">
                {miFila.puntos} pts · {miFila.partidosGanados}G {miFila.partidosEmpatados}E{' '}
                {miFila.partidosPerdidos}P
              </p>
              <p>
                Diferencia {miFila.diferenciaPuntos > 0 ? '+' : ''}
                {miFila.diferenciaPuntos}
                {miFila.grupo ? ` · Grupo ${miFila.grupo}` : ''}
              </p>
            </div>
            {miFila.clasificado && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                Clasificado
              </span>
            )}
            {miFila.eliminado && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                Eliminado
              </span>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Todavía no hay posición cargada para tu equipo en esta fase.
          </p>
        )}
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100/70 p-1" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`min-h-[2.5rem] flex-1 rounded-md px-2 text-[11px] font-bold uppercase tracking-tight transition-colors [touch-action:manipulation] ${
              pestana === p.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {(temporadas.length > 1 || fases.length > 1) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {temporadas.length > 1 && (
            <label className="text-xs font-medium text-slate-600">
              Temporada
              <select
                value={temporadaId}
                onChange={(e) => setTemporadaId(e.target.value)}
                className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800"
              >
                {temporadas.map((t) => (
                  <option key={t._id} value={t._id}>{t.nombre ?? 'Temporada'}</option>
                ))}
              </select>
            </label>
          )}
          {fases.length > 1 && (
            <label className="text-xs font-medium text-slate-600">
              Fase
              <select
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800"
              >
                {fases.map((f) => (
                  <option key={f._id} value={f._id}>{f.nombre ?? 'Fase'}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {pestana === 'torneo' && (
        <div className="space-y-4">
          {tabla && tabla.posiciones.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Tabla de posiciones</h3>
                {/* La aclaración no es cosmética: una tabla provisoria presentada como oficial es
                    peor que no mostrar tabla. */}
                {!tabla.calculada && (
                  <span className="text-[11px] text-amber-700">
                    Provisoria — la organización todavía no aplicó los desempates
                  </span>
                )}
              </header>
              <TablaScroll>
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-2">#</th>
                      <th className="py-1.5 pr-2">Equipo</th>
                      <th className="py-1.5 pr-2 text-right">Pts</th>
                      <th className="py-1.5 pr-2 text-right">PJ</th>
                      <th className="py-1.5 pr-2 text-right">G</th>
                      <th className="py-1.5 pr-2 text-right">E</th>
                      <th className="py-1.5 pr-2 text-right">P</th>
                      <th className="py-1.5 text-right">Dif</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {tabla.posiciones.map((fila) => {
                      const esPropio = fila.equipo?._id === equipoId;
                      return (
                        <tr
                          key={fila._id}
                          className={`border-b border-slate-100 last:border-0 ${
                            esPropio ? 'bg-brand-50 font-semibold text-brand-900' : 'text-slate-700'
                          }`}
                        >
                          <td className="py-1.5 pr-2">{fila.posicion ?? '—'}</td>
                          <td className="py-1.5 pr-2">{fila.equipo?.nombre ?? 'Equipo'}</td>
                          <td className="py-1.5 pr-2 text-right">{fila.puntos}</td>
                          <td className="py-1.5 pr-2 text-right">{fila.partidosJugados}</td>
                          <td className="py-1.5 pr-2 text-right">{fila.partidosGanados}</td>
                          <td className="py-1.5 pr-2 text-right">{fila.partidosEmpatados}</td>
                          <td className="py-1.5 pr-2 text-right">{fila.partidosPerdidos}</td>
                          <td className="py-1.5 text-right">{fila.diferenciaPuntos}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TablaScroll>
            </section>
          ) : (
            <EstadoVacio
              titulo="Sin tabla para esta fase"
              descripcion="La organización todavía no cargó posiciones."
            />
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Qué falta jugar <span className="font-normal text-slate-500">{pendientes.length}</span>
            </h3>
            {pendientes.length > 0 ? (
              pendientes.map((p) => <PartidoCard key={p.id} partido={p} />)
            ) : (
              <p className="text-sm text-slate-500">No quedan partidos pendientes en esta competencia.</p>
            )}
          </section>
        </div>
      )}

      {pestana === 'plantel' && (
        <div className="space-y-4">
          {/* Lo primero es lo que puede salir mal: alguien que no está en regla. */}
          {sinInscribir.length > 0 || suspendidos.length > 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-semibold text-amber-900">Revisar antes del próximo partido</h3>
              {sinInscribir.length > 0 && (
                <p className="mt-1 text-sm text-amber-800">
                  <strong>{sinInscribir.length}</strong>{' '}
                  {sinInscribir.length === 1 ? 'jugador no está inscripto' : 'jugadores no están inscriptos'} en
                  esta competencia: {sinInscribir.map(nombreJugador).join(', ')}.
                </p>
              )}
              {suspendidos.length > 0 && (
                <p className="mt-1 text-sm text-amber-800">
                  <strong>{suspendidos.length}</strong> con sanción vigente:{' '}
                  {suspendidos.map(nombreJugador).join(', ')}.
                </p>
              )}
              <p className="mt-2 text-xs text-amber-700">
                La inscripción de jugadores la resuelve la organización. Desde acá se ve el estado;
                el alta se pide por solicitud.
              </p>
            </section>
          ) : plantel.length > 0 ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Tu plantel está en regla: los {habilitados.length} jugadores con contrato vigente están
              habilitados en esta competencia.
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Plantel <span className="font-normal text-slate-500">{plantel.length}</span>
            </h3>
            <ul className="divide-y divide-slate-100">
              {plantel.map((jugador) => {
                const estado = habilitaciones.get(String(jugador.id))?.estado;
                return (
                  <li key={jugador.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-sm text-slate-800">{nombreJugador(jugador)}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        estado === 'aceptado'
                          ? 'bg-emerald-100 text-emerald-700'
                          : estado === 'suspendido'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {estado === 'aceptado' ? 'Habilitado' : estado === 'suspendido' ? 'Sancionado' : 'Sin inscribir'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {plantel.length === 0 && (
              <p className="text-sm text-slate-500">Todavía no hay jugadores con contrato vigente.</p>
            )}
          </section>
        </div>
      )}

      {pestana === 'rendimiento' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] text-slate-500">Jugados</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{balance.jugados}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] text-slate-500">Ganados</p>
              <p className="text-xl font-bold tabular-nums text-emerald-700">{balance.ganados}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] text-slate-500">Perdidos</p>
              <p className="text-xl font-bold tabular-nums text-rose-700">{balance.perdidos}</p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Partidos jugados</h3>
            {jugados.length > 0 ? (
              jugados.map((p) => <PartidoCard key={p.id} partido={p} />)
            ) : (
              <EstadoVacio
                titulo="Todavía no jugaron en esta competencia"
                descripcion="Cuando se cierre el primer partido vas a ver acá el balance."
              />
            )}
          </section>

          <p className="text-xs text-slate-500">
            Para el análisis fino —efectividad, sinergias, condiciones del set— usá Estadísticas
            filtrando por esta competencia. Acá está el balance, no el detalle.
          </p>
        </div>
      )}
    </div>
  );
};

export default DetalleCompetencia;
