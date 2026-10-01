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

describe("factor 'momento del partido'", () => {
  /** Un partido de `cantidad` sets, todos con la misma alineación y resultado. */
  const partidoDe = (partidoId: string, cantidad: number): FilaAnalitica[] =>
    Array.from({ length: cantidad }, (_, i) =>
      set([1, 1], { partidoId, numeroSet: i + 1 }),
    ).flat();

  /** A qué cuarto cae cada set de un partido, en orden de set. */
  const cuartoPorSet = (filas: FilaAnalitica[], partidoId: string): string[] => {
    const { asignar } = factor('momento').preparar(construirSets(filas));
    return construirSets(filas)
      .filter((s) => s.partidoId === partidoId)
      .sort((a, b) => a.numeroSet - b.numeroSet)
      .map(asignar);
  };

  it('parte un partido de 16 sets en cuartos de 4', () => {
    expect(cuartoPorSet(partidoDe('p1', 16), 'p1')).toEqual([
      'Primer cuarto', 'Primer cuarto', 'Primer cuarto', 'Primer cuarto',
      'Segundo cuarto', 'Segundo cuarto', 'Segundo cuarto', 'Segundo cuarto',
      'Tercer cuarto', 'Tercer cuarto', 'Tercer cuarto', 'Tercer cuarto',
      'Último cuarto', 'Último cuarto', 'Último cuarto', 'Último cuarto',
    ]);
  });

  it('el primer set siempre abre y el último siempre cierra, sea largo o corto el partido', () => {
    for (const cantidad of [2, 3, 4, 9, 16, 24]) {
      const cuartos = cuartoPorSet(partidoDe(`p${cantidad}`, cantidad), `p${cantidad}`);
      expect(cuartos[0]).toBe('Primer cuarto');
      expect(cuartos[cuartos.length - 1]).toBe('Último cuarto');
    }
  });

  it('normaliza por partido: el set 8 es el final de uno de 9 y la mitad de uno de 16', () => {
    // Es el punto del factor. Agrupar por número absoluto de set mezclaría el principio de un
    // partido de Cloth con el cierre de uno de Foam.
    const filas = [...partidoDe('corto', 9), ...partidoDe('largo', 16)];
    const { asignar } = factor('momento').preparar(construirSets(filas));
    const setOcho = (partidoId: string) =>
      asignar(construirSets(filas).find((s) => s.partidoId === partidoId && s.numeroSet === 8)!);

    expect(setOcho('corto')).toBe('Último cuarto');
    expect(setOcho('largo')).toBe('Segundo cuarto');
  });

  it('un partido de un solo set no tiene momentos: cae entero en el primero', () => {
    expect(cuartoPorSet(partidoDe('p1', 1), 'p1')).toEqual(['Primer cuarto']);
  });

  it('los cuartos vacíos de un partido corto no se muestran', () => {
    // Con 2 sets sólo hay apertura y cierre; los dos cuartos del medio no existen.
    const tramos = condicion(partidoDe('p1', 2), 'momento');
    expect(tramos.map((t) => t.tramo)).toEqual(['Primer cuarto', 'Último cuarto']);
  });
});
