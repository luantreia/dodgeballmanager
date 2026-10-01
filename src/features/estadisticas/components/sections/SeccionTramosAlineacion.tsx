import { useMemo } from 'react';
import { formatDate } from '../../../../shared/utils/formatDate';
import { formatNumber } from '../../../../shared/utils/formatNumber';
import { formatearPorcentaje } from '../../utils/metricas';
import TablaScroll from '../../../../shared/components/TablaScroll/TablaScroll';
import {
  construirTramos,
  resumirTramos,
  type AporteJugador,
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
/** Con menos sets que esto, el ritmo del tramo es una o dos observaciones: se avisa. */
const SETS_PARA_RITMO = 3;

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

const conSigno = (valor: number): string => `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${formatNumber(Math.abs(valor))}`;

/**
 * La flecha de un delta. Sólo se dibuja donde "más" significa inequívocamente "mejor".
 *
 * No va en los tiros —volumen no es rendimiento: se puede tirar más y peor— ni en los outs,
 * cuya dirección depende de una definición que la plataforma todavía no fijó (¿veces que me
 * eliminaron, u outs que generé?). Poner una flecha ahí sería afirmar algo que no sabemos.
 */
const Flecha = ({ valor }: { valor: number }) => {
  if (Math.abs(valor) < 0.001) return null;
  const mejor = valor > 0;
  return (
    <span className={`ml-0.5 text-[10px] font-bold ${mejor ? 'text-emerald-600' : 'text-rose-600'}`}>
      {mejor ? '▲' : '▼'}
    </span>
  );
};

/** "J6 · 1,5 hits/set" — el aporte de un jugador en una línea. */
const resumirAporte = (aporte: AporteJugador): string =>
  `${aporte.jugador} · ${formatNumber(aporte.ritmo.hitsPorSet)} hits/set` +
  (aporte.ritmo.efectividad !== null
    ? ` · ${formatearPorcentaje(aporte.ritmo.efectividad)} efect.`
    : ' · sin tiros');

/**
 * Qué pasó con cada alineación, en orden, dentro de cada partido.
 *
 * Es **descriptivo y no afirma nada causal**, y eso es una decisión, no una limitación. El patrón
 * que esta vista hace visible —"veníamos ganando, hicimos un cambio, perdimos tres seguidos"— es
 * también exactamente lo que parece el puro azar: después de una racha buena lo más probable es que
 * venga algo peor, haya cambio o no. Y la causalidad suele correr al revés: se cambia PORQUE se
 * viene perdiendo.
 *
 * Para eso están los contadores, y es su razón de ser acá: el resultado de un set de tres minutos
 * es un bit de información con una varianza enorme, mientras que los tiros, los hits y las atajadas
 * son decenas de observaciones por set. Separan dos cosas que el resultado solo confunde — "se nos
 * dieron vuelta los sets pero seguimos generando lo mismo" (mala suerte) de "dejamos de generar"
 * (la producción se cayó de verdad). Ese es el indicio de si el cambio estaba bien orientado; el
 * veredicto no, porque para eso hace falta juntar todas las veces que ese cambio se repitió.
 *
 * La alineación completa se escribe sólo cuando NO se puede derivar del tramo anterior (el primer
 * tramo del partido, o el primero después de un hueco). En los demás, lo que se muestra es el
 * cambio, que es la información nueva.
 */
const SeccionTramosAlineacion = ({ sets, partidos }: Props) => {
  const secuencias = useMemo(() => construirTramos(sets), [sets]);
  const resumen = useMemo(() => resumirTramos(secuencias), [secuencias]);

  /** Las secuencias en el orden de los partidos filtrados (el backend los manda por fecha desc). */
  const ordenadas = useMemo(() => {
    const porId = new Map(secuencias.map((s) => [s.partidoId, s]));
    return partidos
      .map((partido) => ({ partido, secuencia: porId.get(partido._id) }))
      .filter(
        (item): item is { partido: PartidoTimeline; secuencia: NonNullable<typeof item.secuencia> } =>
          Boolean(item.secuencia),
      );
  }, [secuencias, partidos]);

  const totalSets = resumen.setsLeidos + resumen.setsIgnorados;
  const proporcionLeida = totalSets > 0 ? resumen.setsLeidos / totalSets : 1;
  const capturaFloja = totalSets > 0 && proporcionLeida < PROPORCION_MINIMA_LEIDA;

  const filaDeTramo = (tramo: TramoAlineacion) => {
    const { cambio } = tramo;
    const pocaMuestra = tramo.sets < SETS_PARA_RITMO;

    return (
      <li key={tramo.clave} className="px-3 py-2">
        {tramo.huecoAntes > 0 && (
          <p className="mb-1.5 text-[11px] text-amber-700">
            ⚠ falta la captura de {tramo.huecoAntes} {tramo.huecoAntes === 1 ? 'set' : 'sets'} — no se
            sabe qué cambió acá
          </p>
        )}

        {cambio && (
          <div className="mb-1.5 space-y-0.5 border-l-2 border-slate-200 pl-2">
            {cambio.salieron.length > 0 && (
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold text-rose-700">sale</span>{' '}
                {cambio.salieron.map(resumirAporte).join('  |  ')}
              </p>
            )}
            {cambio.entraron.length > 0 && (
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold text-emerald-700">entra</span>{' '}
                {cambio.entraron.map(resumirAporte).join('  |  ')}
              </p>
            )}
            {/* Lo que se movió el equipo, no lo que el cambio causó: los otros cinco también
                juegan distinto y el rival se acomoda. */}
            <p className="text-[11px] text-slate-500">
              equipo/set: hits {conSigno(cambio.delta.hitsPorSet)}
              <Flecha valor={cambio.delta.hitsPorSet} /> · atajadas{' '}
              {conSigno(cambio.delta.catchesPorSet)}
              <Flecha valor={cambio.delta.catchesPorSet} /> · tiros{' '}
              {conSigno(cambio.delta.throwsPorSet)}
              {cambio.delta.efectividad !== null && (
                <>
                  {' · efect. '}
                  {conSigno(cambio.delta.efectividad * 100)} pts
                  <Flecha valor={cambio.delta.efectividad} />
                </>
              )}
            </p>
          </div>
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
          <span className="text-[11px] tabular-nums text-slate-500">
            {formatNumber(tramo.ritmo.hitsPorSet)} hits/set
            {tramo.ritmo.efectividad !== null && ` · ${formatearPorcentaje(tramo.ritmo.efectividad)}`}
          </span>
          {pocaMuestra && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {tramo.sets === 1 ? '1 set' : `${tramo.sets} sets`}
            </span>
          )}
        </div>

        {/* Sólo cuando no se puede derivar del tramo anterior. */}
        {cambio === null && (
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {tramo.jugadores.map((j) => j.jugador).join(' · ')}
          </p>
        )}

        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-700">
            Por jugador
          </summary>
          <TablaScroll className="mt-1.5">
            <table className="w-full min-w-[460px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 bg-white px-1.5 py-1 text-left">Jugador</th>
                  <th className="px-1.5 py-1 text-right">Sets</th>
                  <th className="px-1.5 py-1 text-right">Tiros/set</th>
                  <th className="px-1.5 py-1 text-right">Hits/set</th>
                  <th className="px-1.5 py-1 text-right">Efect.</th>
                  <th className="px-1.5 py-1 text-right">Ataj./set</th>
                  <th className="px-1.5 py-1 text-right">Outs/set</th>
                  <th className="px-1.5 py-1 text-right">Sobrev.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {tramo.aportes.map((aporte) => (
                  <tr key={aporte.jugadorId}>
                    <td className="sticky left-0 bg-white px-1.5 py-1 font-medium text-slate-800">
                      {aporte.jugador}
                    </td>
                    <td className="px-1.5 py-1 text-right text-slate-500">{aporte.sets}</td>
                    <td className="px-1.5 py-1 text-right text-slate-600">
                      {formatNumber(aporte.ritmo.throwsPorSet)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-semibold text-slate-900">
                      {formatNumber(aporte.ritmo.hitsPorSet)}
                    </td>
                    <td className="px-1.5 py-1 text-right text-slate-600">
                      {formatearPorcentaje(aporte.ritmo.efectividad)}
                    </td>
                    <td className="px-1.5 py-1 text-right text-slate-600">
                      {formatNumber(aporte.ritmo.catchesPorSet)}
                    </td>
                    <td className="px-1.5 py-1 text-right text-slate-600">
                      {formatNumber(aporte.ritmo.outsPorSet)}
                    </td>
                    <td className="px-1.5 py-1 text-right text-slate-600">
                      {formatearPorcentaje(aporte.supervivencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </details>
      </li>
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">Tramos de alineación</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cuántos sets seguidos se jugaron con los mismos seis, qué generó cada uno mientras estuvo,
          y qué cambió al pasar al tramo siguiente. Dentro de cada partido, así que el rival es el
          mismo.
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
              {capturaFloja &&
                ' Con esta proporción, los tramos de abajo están partidos por lo que falta cargar más que por decisiones de cancha.'}
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
                  <ol className="divide-y divide-slate-100">{secuencia.tramos.map(filaDeTramo)}</ol>
                )}
              </article>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Esto describe, no explica. Que después de un cambio venga una racha en contra no
            significa que el cambio la haya causado: después de cualquier racha buena lo más probable
            es que venga algo peor —es regresión a la media— y además se suele cambiar porque ya se
            viene perdiendo, así que la causa y el efecto van al revés. El delta del equipo es lo que
            se movió, no lo que el cambio provocó: los otros cinco también juegan distinto. Las
            flechas van sólo donde "más" es inequívocamente mejor, así que no hay ninguna en los
            tiros —volumen no es rendimiento— ni en los outs, porque todavía no está definido si son
            las veces que te eliminaron o los outs que generaste. Para medir si un cambio conviene
            hay que juntar todas las veces que se repitió, no mirar un caso. Mientras tanto, usá esto
            para saber qué set mirar en el video.
          </p>
        </div>
      )}
    </section>
  );
};

export default SeccionTramosAlineacion;
