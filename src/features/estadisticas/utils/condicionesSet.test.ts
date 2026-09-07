import { construirSets } from './setsAnaliticos';
import { calcularCondicion, FACTORES } from './condicionesSet';
import { fila } from './__fixtures__/filas';
import type { FilaAnalitica } from '../services/filasService';

const factor = (clave: string) => FACTORES.find((f) => f.clave === clave)!;

const condicion = (filas: FilaAnalitica[], clave: string) =>
  calcularCondicion(construirSets(filas), factor(clave));

const tramoDe = (filas: FilaAnalitica[], clave: string): string =>
  condicion(filas, clave).find((t) => t.sets > 0)!.tramo;

/** Un set con los tiros repartidos como diga `tiros`, y el resultado indicado. */
const set = (tiros: number[], over: Partial<FilaAnalitica> = {}): FilaAnalitica[] =>
  tiros.map((throws, i) =>
    fila({ jugadorId: `j${i + 1}`, jugador: `J${i + 1}`, throws, hits: 0, catches: 0, survive: false, ...over }),
  );

describe('calcularCondicion', () => {
  it('ningún set se pierde ni se cuenta dos veces', () => {
    const filas = [
      ...set([10, 2, 1], { partidoId: 'p1', numeroSet: 1 }),
      ...set([5, 5, 5], { partidoId: 'p1', numeroSet: 2 }),
      ...set([0, 0, 0], { partidoId: 'p1', numeroSet: 3 }),
      ...set([3, 3], { partidoId: 'p2', numeroSet: 1 }),
    ];
    const totalSets = construirSets(filas).length;

    for (const f of FACTORES) {
      const tramos = calcularCondicion(construirSets(filas), f);
      const suma = tramos.reduce((acc, t) => acc + t.sets, 0);
      expect([f.clave, suma]).toEqual([f.clave, totalSets]);
    }
  });

  it('los empates cuentan como set pero salen del porcentaje', () => {
    const filas = [
      ...set([5], { partidoId: 'p1', numeroSet: 1, catches: 0, resultadoSet: 'ganado' }),
      ...set([5], { partidoId: 'p1', numeroSet: 2, catches: 0, resultadoSet: 'empate' }),
    ];

    const tramo = condicion(filas, 'catches').find((t) => t.tramo === '0')!;
    expect(tramo.sets).toBe(2);
    expect(tramo.decididos).toBe(1);
    expect(tramo.porcentaje).toBe(1);
  });

  it('un tramo sin sets decididos da porcentaje null, no cero', () => {
    const tramo = condicion(set([5], { resultadoSet: 'sin definir' }), 'catches')[0];
    expect(tramo.decididos).toBe(0);
    expect(tramo.porcentaje).toBeNull();
  });

  it('devuelve los tramos en el orden del factor, no por resultado', () => {
    const filas = [
      ...set([5], { partidoId: 'p1', numeroSet: 1, catches: 0, resultadoSet: 'ganado' }),
      ...set([5], { partidoId: 'p1', numeroSet: 2, catches: 3, resultadoSet: 'perdido' }),
    ];
    expect(condicion(filas, 'catches').map((t) => t.tramo)).toEqual(['0', '3+']);
  });
});

describe('factor: concentración de tiros', () => {
  it('un tirador con el 60% cae en "50% o más"', () => {
    // 12 de 20 = 60%.
    expect(tramoDe(set([12, 4, 4]), 'concentracion')).toBe('50% o más');
  });

  it('el borde exacto de 50% cae en "50% o más", como dice la etiqueta', () => {
    // 10 de 20 = 50% justo.
    expect(tramoDe(set([10, 5, 5]), 'concentracion')).toBe('50% o más');
  });

  it('reparto parejo entre 6 cae en el tramo más bajo', () => {
    // 16,7% cada uno.
    expect(tramoDe(set([5, 5, 5, 5, 5, 5]), 'concentracion')).toBe('Menos de 30%');
  });

  it('un set sin tiros no inventa una concentración', () => {
    expect(tramoDe(set([0, 0, 0]), 'concentracion')).toBe('Sin tiros');
  });
});

describe('factor: tiradores efectivos', () => {
  it('cuenta los que llegan al 15% de los tiros del equipo', () => {
    // 10/24, 8/24, 5/24 pasan el 15%; 1/24 no.
    expect(tramoDe(set([10, 8, 5, 1]), 'tiradores')).toBe('3');
  });

  it('los tiros en dos manos caen en "1 – 2"', () => {
    expect(tramoDe(set([10, 10, 0, 0]), 'tiradores')).toBe('1 – 2');
  });

  it('seis repartiendo parejo caen en "5+"', () => {
    expect(tramoDe(set([5, 5, 5, 5, 5, 5]), 'tiradores')).toBe('5+');
  });
});

describe('factor: volumen (cuartiles del segmento)', () => {
  it('corta por cuartiles de lo que se está mirando', () => {
    const filas = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) =>
      set([n], { partidoId: 'p1', numeroSet: n }),
    );

    const tramos = calcularCondicion(construirSets(filas), factor('volumen'));
    expect(tramos.length).toBeGreaterThan(1);
    expect(tramos.reduce((acc, t) => acc + t.sets, 0)).toBe(8);
  });

  it('con volúmenes todos iguales colapsa en vez de dibujar tramos vacíos', () => {
    const filas = [1, 2, 3].flatMap((n) => set([5], { partidoId: 'p1', numeroSet: n }));
    const tramos = calcularCondicion(construirSets(filas), factor('volumen'));
    expect(tramos).toHaveLength(1);
    expect(tramos[0].sets).toBe(3);
  });
});

describe('factor: efectividad del set', () => {
  it('agrupa por hits sobre throws del equipo', () => {
    const filas = [fila({ jugadorId: 'j1', throws: 10, hits: 7 })];
    expect(tramoDe(filas, 'efectividad')).toBe('60% o más');
  });

  it('sin tiros no hay efectividad que calcular', () => {
    const filas = [fila({ jugadorId: 'j1', throws: 0, hits: 0 })];
    expect(tramoDe(filas, 'efectividad')).toBe('Sin tiros');
  });
});
