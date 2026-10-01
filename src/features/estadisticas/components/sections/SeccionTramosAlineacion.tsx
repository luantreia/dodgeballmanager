import { useMemo } from 'react';
import { formatDate } from '../../../../shared/utils/formatDate';
import { formatearPorcentaje } from '../../utils/metricas';
import {
  construirTramos,
  resumirTramos,
  type TramoAlineacion,
} from '../../utils/tramosAlineacion';
import type { SetAnalitico } from '../../utils/setsAnaliticos';
import type { PartidoTimeline } from '../../services/timelineService';

type Props = {
  sets: SetAnalitico[];
  /** Los partidos filtrados: de acá salen el rival, la fecha y el orden de lectura. */
  partidos: PartidoTimeline[];
};

/** Debajo de esta proporción de sets legibles, la secuencia está demasiado agujereada. */
const PROPORCION_MINIMA_LEIDA = 0.7;

const CLASE_RESULTADO: Record<string, string> = {
  ganado: 'bg-emerald-500',
  perdido: 'bg-rose-400',
  empate: 'bg-amber-300',
  'sin definir': 'bg-slate-200',
};

/** La secuencia de resultados del tramo, como bloquitos — se lee de un vistazo. */
const Bloques = ({ resultados }: { resultados: string[] }) => (
  <span className="inline-flex gap-0.5" aria-hidden>
    {resultados.map((resultado, i) => (
      <span
        key={i}
        className={`h-3 w-2.5 rounded-sm ${CLASE_RESULTADO[resultado] ?? 'bg-slate-200'}`}
      />
    ))}
  </span>
);

const nombresDe = (tramo: TramoAlineacion): string =>
  tramo.jugadores.map((j) => j.jugador).join(' · ');

const textoDelCambio = (tramo: TramoAlineacion): string | null => {
  if (!tramo.cambio) return null;
  const { salieron, entraron } = tramo.cambio;
  const partes: string[] = [];
  if (salieron.length > 0) partes.push(`sale ${salieron.map((j) => j.jugador).join(', ')}`);
  if (entraron.length > 0) partes.push(`entra ${entraron.map((j) => j.jugador).join(', ')}`);
  return partes.length > 0 ? partes.join(' · ') : null;
};

/**
 * Qué pasó con cada alineación, en orden, dentro de cada partido.
 *
 * Es **descriptivo y no afirma nada causal**, y eso es una decisión, no una limitación. El patrón
 * que esta vista hace visible —"veníamos ganando, hicimos un cambio, perdimos tres seguidos"— es
 * también exactamente lo que parece el puro azar: después de una racha buena lo más probable es que
 * venga algo peor, haya cambio o no. Y la causalidad suele correr al revés: se cambia PORQUE se
 * viene perdiendo. Así que la vista muestra la secuencia y deja el juicio al DT, que es el único
 * que sabe por qué hizo cada cambio.
 *
 * La alineación completa se escribe sólo cuando NO se puede derivar del tramo anterior (el primer
 * tramo del partido, o el primero después de un hueco). En los demás, lo que se muestra es el
 * cambio, que es la información nueva.
 *
 * Se apoya en que un partido de dodgeball tiene muchos sets cortos: en los datos históricos la
 * mediana es de 16 sets en Cloth y 9 en Foam. Por eso las rachas y los cambios se pueden ver
 * DENTRO de un mismo partido, que es la comparación fuerte — el rival, la cancha y el día son los
 * mismos.
 */
const SeccionTramosAlineacion = ({ sets, partidos }: Props) => {
  const secuencias = useMemo(() => construirTramos(sets), [sets]);
  const resumen = useMemo(() => resumirTramos(secuencias), [secuencias]);

  /** Las secuencias en el orden de los partidos filtrados (el backend los manda por fecha desc). */
  const ordenadas = useMemo(() => {
    const porId = new Map(secuencias.map((s) => [s.partidoId, s]));
    return partidos
      .map((partido) => ({ partido, secuencia: porId.get(partido._id) }))
      .filter((item): item is { partido: PartidoTimeline; secuencia: NonNullable<typeof item.secuencia> } =>
        Boolean(item.secuencia),
      );
  }, [secuencias, partidos]);

  const totalSets = resumen.setsLeidos + resumen.setsIgnorados;
  const proporcionLeida = totalSets > 0 ? resumen.setsLeidos / totalSets : 1;
  const capturaFloja = totalSets > 0 && proporcionLeida < PROPORCION_MINIMA_LEIDA;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">Tramos de alineación</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cuántos sets seguidos se jugaron con los mismos seis, cómo salieron, y qué cambió al pasar
          al tramo siguiente. Dentro de cada partido, así que el rival es el mismo.
        </p>
      </header>

      {totalSets === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Los partidos filtrados no tienen estadísticas cargadas set a set, que es la unidad que
          mide este panel.
        </p>
      ) : (
        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>
              <strong className="font-semibold text-slate-800">{resumen.tramos}</strong> tramos en{' '}
              {resumen.partidos} {resumen.partidos === 1 ? 'partido' : 'partidos'}
            </span>
            <span>
              <strong className="font-semibold text-slate-800">{resumen.cambios}</strong> cambios
              atribuibles
            </span>
            <span>
              <strong className="font-semibold text-slate-800">{resumen.tramosConRacha}</strong>{' '}
              tramos de 2 sets o más
            </span>
          </div>

          {resumen.setsIgnorados > 0 && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                capturaFloja
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <strong className="font-semibold">
                {resumen.setsIgnorados} de {totalSets} sets quedaron afuera
              </strong>{' '}
              por tener la alineación incompleta (menos de 6 jugadores cargados). Un set así se ve
              idéntico a una sustitución, así que no se lee: se descarta y corta la continuidad.
              {capturaFloja && ' Con esta proporción, los tramos de abajo están partidos por lo que falta cargar más que por decisiones de cancha.'}
            </div>
          )}

          <div className="space-y-4">
            {ordenadas.map(({ partido, secuencia }) => (
              <article key={partido._id} className="rounded-xl border border-slate-200">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    vs {partido.rival?.nombre ?? 'Rival'}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {formatDate(partido.fecha)} · {partido.marcadorEquipo}–{partido.marcadorRival} ·{' '}
                    {partido.esLocal ? 'local' : 'visitante'}
                  </span>
                </header>

                {secuencia.tramos.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">
                    Ningún set de este partido tiene la alineación completa.
                  </p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {secuencia.tramos.map((tramo) => {
                      const cambio = textoDelCambio(tramo);
                      return (
                        <li key={tramo.clave} className="px-3 py-2">
                          {tramo.huecoAntes > 0 && (
                            <p className="mb-1.5 text-[11px] text-amber-700">
                              ⚠ falta la captura de {tramo.huecoAntes}{' '}
                              {tramo.huecoAntes === 1 ? 'set' : 'sets'} — no se sabe qué cambió acá
                            </p>
                          )}
                          {cambio && (
                            <p className="mb-1.5 text-[11px] font-medium text-slate-600">↓ {cambio}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-xs font-semibold tabular-nums text-slate-800">
                              {tramo.desdeSet === tramo.hastaSet
                                ? `Set ${tramo.desdeSet}`
                                : `Sets ${tramo.desdeSet}–${tramo.hastaSet}`}
                            </span>
                            <Bloques resultados={tramo.resultados} />
                            <span className="text-xs tabular-nums text-slate-600">
                              {tramo.ganados}–{tramo.perdidos}
                              {tramo.porcentaje !== null && (
                                <span className="ml-1.5 font-semibold text-slate-900">
                                  {formatearPorcentaje(tramo.porcentaje)}
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Sólo cuando no se puede derivar del tramo anterior. */}
                          {tramo.cambio === null && (
                            <p className="mt-1 text-[11px] leading-snug text-slate-500">
                              {nombresDe(tramo)}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Esto describe, no explica. Que después de un cambio venga una racha en contra no
            significa que el cambio la haya causado: después de cualquier racha buena lo más
            probable es que venga algo peor —es regresión a la media— y además se suele cambiar
            porque ya se viene perdiendo, así que la causa y el efecto van al revés. Para medir si
            un cambio conviene hay que juntar todas las veces que se repitió, no mirar un caso.
            Mientras tanto, usá esto para saber qué set mirar en el video. El factor "Momento del
            partido", en Condiciones del set, te dice si el rendimiento ya cae solo con los sets.
          </p>
        </div>
      )}
    </section>
  );
};

export default SeccionTramosAlineacion;
