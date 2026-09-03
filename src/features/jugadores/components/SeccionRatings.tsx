import { useEffect, useMemo, useState } from 'react';
import {
  getRatingsEquipo,
  ratingGlobal,
  type BucketRating,
  type JugadorConRating,
} from '../services/ratingService';

type Props = { equipoId: string };

/** Etiqueta legible de un bucket que no es el global. */
const nombreBucket = (b: BucketRating): string =>
  [b.modalidad, b.categoria].filter(Boolean).join(' · ') || 'Competencia';

const Delta = ({ valor }: { valor: number }) => {
  if (!valor) return <span className="text-slate-300">—</span>;
  const sube = valor > 0;
  return (
    <span className={sube ? 'text-emerald-600' : 'text-rose-600'}>
      {sube ? '▲' : '▼'} {Math.abs(Math.round(valor))}
    </span>
  );
};

/**
 * Rating tipo ELO del plantel.
 *
 * El cálculo existe en el backend desde siempre (`ratingService`, modelo `PlayerRating`) y el
 * panel del DT no lo mostraba en ningún lado: era de lo más caro construido y de lo menos
 * aprovechado. Es además el único dato de la app que responde "cómo está mi jugador contra el
 * resto", y no sólo "cuánto hizo".
 *
 * Se muestra el rating GLOBAL en la lista y los buckets por modalidad y categoría al desplegar.
 * Promediarlos sería inventar un número: alguien puede ser 1650 en foam masculino y 1480 en
 * cloth mixto, y el promedio no describe a ninguno de los dos.
 */
const SeccionRatings = ({ equipoId }: Props) => {
  const [jugadores, setJugadores] = useState<JugadorConRating[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    getRatingsEquipo(equipoId)
      .then((data) => !cancelado && setJugadores(data))
      .catch(() => !cancelado && setError('No pudimos cargar los ratings del plantel.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [equipoId]);

  const ordenados = useMemo(
    () =>
      [...jugadores].sort((a, b) => {
        const ra = ratingGlobal(a)?.rating ?? -1;
        const rb = ratingGlobal(b)?.rating ?? -1;
        return rb - ra || a.nombre.localeCompare(b.nombre, 'es');
      }),
    [jugadores],
  );

  const conRating = ordenados.filter((j) => ratingGlobal(j) !== null);

  if (cargando) return <p className="text-sm text-slate-500">Cargando ratings…</p>;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Rating del plantel</h2>
        <p className="text-xs text-slate-500">
          Calculado sobre los partidos ranked. Arranca en 1500 y sube o baja según contra quién
          se juega, no sólo si se gana.
        </p>
      </header>

      {conRating.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Ningún jugador del plantel tiene rating todavía. Se genera al jugar partidos ranked.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {conRating.map((jugador) => {
            const global = ratingGlobal(jugador)!;
            // Todo lo que no es el bucket global: los cortes por modalidad y categoría.
            const otros = jugador.ratings.filter((r) => r !== global);
            const abierto = expandido === jugador._id;

            return (
              <li key={jugador._id} className="py-2">
                <button
                  type="button"
                  onClick={() => setExpandido(abierto ? null : jugador._id)}
                  aria-expanded={abierto}
                  disabled={otros.length === 0}
                  className="flex w-full items-center gap-3 text-left disabled:cursor-default"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {jugador.nombre}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                    {global.matchesPlayed} PJ
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums">
                    <Delta valor={global.lastDelta} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-base font-bold tabular-nums text-slate-900">
                    {Math.round(global.rating)}
                  </span>
                  <span aria-hidden className="w-3 shrink-0 text-slate-300">
                    {otros.length > 0 ? (abierto ? '▲' : '▼') : ''}
                  </span>
                </button>

                {abierto && otros.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l-2 border-slate-100 pl-3">
                    {otros.map((bucket, i) => (
                      <li
                        key={`${bucket.competenciaId}-${bucket.modalidad}-${bucket.categoria}-${i}`}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {nombreBucket(bucket)}
                        </span>
                        <span className="shrink-0 text-slate-400 tabular-nums">
                          {bucket.wins}G-{bucket.draws}E-{bucket.losses}P
                        </span>
                        <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-slate-700">
                          {Math.round(bucket.rating)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {conRating.length < ordenados.length && (
        <p className="mt-3 text-xs text-slate-400">
          {ordenados.length - conRating.length} jugador
          {ordenados.length - conRating.length === 1 ? '' : 'es'} del plantel sin partidos ranked.
        </p>
      )}
    </section>
  );
};

export default SeccionRatings;
