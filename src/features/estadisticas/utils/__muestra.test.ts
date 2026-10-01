import { construirSets } from './setsAnaliticos';
import { construirTramos, type AporteJugador } from './tramosAlineacion';
import { fila } from './__fixtures__/filas';
import type { FilaAnalitica } from '../services/filasService';

const num = (v: number) => v.toFixed(1).replace('.', ',');
const signo = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}`;
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const aporte = (a: AporteJugador) => `${a.jugador} ${num(a.ritmo.hitsPorSet)}h/set ${pct(a.ritmo.efectividad)}`;

it('muestra', () => {
  const A = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
  const B = ['j1', 'j2', 'j3', 'j4', 'j5', 'j7'];

  /** Un set: cada jugador tira `tiros` y acierta `aciertos`. */
  const set = (
    ids: string[],
    n: number,
    resultadoSet: FilaAnalitica['resultadoSet'],
    tiros: number,
    aciertos: number,
  ): FilaAnalitica[] =>
    ids.map((id) =>
      fila({
        partidoId: 'p1',
        numeroSet: n,
        resultadoSet,
        jugadorId: id,
        jugador: id.toUpperCase(),
        throws: tiros,
        hits: aciertos,
        outs: 1,
        catches: 0,
        survive: false,
      }),
    );

  // Racha a favor generando bien → cambio → racha en contra generando MENOS (el cambio dolió).
  // Después, vuelta atrás → racha a favor generando igual que al principio.
  const filas = [
    ...set(A, 1, 'ganado', 3, 2),
    ...set(A, 2, 'ganado', 3, 2),
    ...set(A, 3, 'ganado', 3, 2),
    ...set(A, 4, 'perdido', 3, 2),
    ...set(B, 5, 'perdido', 3, 1),
    ...set(B, 6, 'perdido', 2, 0),
    ...set(B, 7, 'perdido', 3, 1),
    ...set(A, 8, 'ganado', 3, 2),
    ...set(A, 9, 'ganado', 4, 2),
  ];

  const lineas: string[] = [];
  for (const s of construirTramos(construirSets(filas))) {
    for (const t of s.tramos) {
      if (t.cambio) {
        lineas.push(`  sale  ${t.cambio.salieron.map(aporte).join(' | ')}`);
        lineas.push(`  entra ${t.cambio.entraron.map(aporte).join(' | ')}`);
        const d = t.cambio.delta;
        lineas.push(
          `  equipo/set: hits ${signo(d.hitsPorSet)} · tiros ${signo(d.throwsPorSet)}` +
            (d.efectividad !== null ? ` · efect. ${signo(d.efectividad * 100)} pts` : ''),
        );
      }
      const rango = t.desdeSet === t.hastaSet ? `Set ${t.desdeSet}` : `Sets ${t.desdeSet}-${t.hastaSet}`;
      const bloques = t.resultados.map((r) => (r === 'ganado' ? '#' : '.')).join('');
      lineas.push(
        `${rango.padEnd(11)} ${bloques.padEnd(5)} ${t.ganados}-${t.perdidos}  ` +
          `${num(t.ritmo.hitsPorSet)} hits/set · ${pct(t.ritmo.efectividad)} efect.`,
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log('\n' + lineas.join('\n'));
  expect(true).toBe(true);
});
