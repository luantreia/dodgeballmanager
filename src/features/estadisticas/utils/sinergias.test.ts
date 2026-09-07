import { construirSets } from './setsAnaliticos';
import { calcularSinergias, ordenarSinergias, type GrupoSinergia } from './sinergias';
import { alineacion } from './__fixtures__/filas';
import type { FilaAnalitica } from '../services/filasService';

const sinergiasDe = (filas: FilaAnalitica[]) => calcularSinergias(construirSets(filas));

const buscar = (
  sinergias: ReturnType<typeof calcularSinergias>,
  ids: string[],
): GrupoSinergia | undefined =>
  sinergias.get(ids.length)?.find((g) => g.clave === [...ids].sort().join('|'));

describe('calcularSinergias', () => {
  it('mide on/off: juntos ganan, separados pierden', () => {
    const filas = [
      // j1 y j2 juntos: dos sets, los dos ganados.
      ...alineacion(['j1', 'j2', 'j3'], { partidoId: 'p1', numeroSet: 1, resultadoSet: 'ganado' }),
      ...alineacion(['j1', 'j2', 'j3'], { partidoId: 'p1', numeroSet: 2, resultadoSet: 'ganado' }),
      // j1 sin j2: perdido. j2 sin j1: perdido.
      ...alineacion(['j1', 'j4'], { partidoId: 'p1', numeroSet: 3, resultadoSet: 'perdido' }),
      ...alineacion(['j2', 'j4'], { partidoId: 'p1', numeroSet: 4, resultadoSet: 'perdido' }),
    ];

    const dupla = buscar(sinergiasDe(filas), ['j1', 'j2'])!;
    expect(dupla.setsJuntos).toBe(2);
    expect(dupla.porcentajeJuntos).toBe(1);
    expect(dupla.setsSeparados).toBe(2);
    expect(dupla.porcentajeSeparados).toBe(0);
    expect(dupla.sinergia).toBe(1);
  });

  it('un grupo que nunca jugó separado tiene sinergia null, no cero', () => {
    // j1 y j2 siempre en cancha juntos: no hay contrafáctico posible.
    const filas = [
      ...alineacion(['j1', 'j2'], { numeroSet: 1, resultadoSet: 'ganado' }),
      ...alineacion(['j1', 'j2'], { numeroSet: 2, resultadoSet: 'perdido' }),
    ];

    const dupla = buscar(sinergiasDe(filas), ['j1', 'j2'])!;
    expect(dupla.setsSeparados).toBe(0);
    expect(dupla.porcentajeJuntos).toBe(0.5);
    expect(dupla.sinergia).toBeNull();
  });

  it('"separados" es al menos uno pero no todos, y no cuenta los sets donde no jugó ninguno', () => {
    const filas = [
      ...alineacion(['j1', 'j2'], { numeroSet: 1, resultadoSet: 'ganado' }),
      // Sólo j1: separado.
      ...alineacion(['j1', 'j5'], { numeroSet: 2, resultadoSet: 'perdido' }),
      // Ni j1 ni j2: este set no dice nada sobre la dupla.
      ...alineacion(['j5', 'j6'], { numeroSet: 3, resultadoSet: 'perdido' }),
    ];

    const dupla = buscar(sinergiasDe(filas), ['j1', 'j2'])!;
    expect(dupla.setsJuntos).toBe(1);
    expect(dupla.setsSeparados).toBe(1);
  });

  it('enumera las 57 combinaciones de una alineación de 6', () => {
    // C(6,2)+C(6,3)+C(6,4)+C(6,5)+C(6,6) = 15+20+15+6+1
    const sinergias = sinergiasDe(alineacion(['j1', 'j2', 'j3', 'j4', 'j5', 'j6']));

    expect(sinergias.get(2)).toHaveLength(15);
    expect(sinergias.get(3)).toHaveLength(20);
    expect(sinergias.get(4)).toHaveLength(15);
    expect(sinergias.get(5)).toHaveLength(6);
    expect(sinergias.get(6)).toHaveLength(1);
    // Y no inventa grupos de 7.
    expect(sinergias.get(7)).toBeUndefined();
  });

  it('una alineación incompleta aporta los grupos que sí están, no los que faltan', () => {
    // Capturaron 3 de 6: hay tríos y duplas reales, ningún sexteto.
    const sinergias = sinergiasDe(alineacion(['j1', 'j2', 'j3']));
    expect(sinergias.get(2)).toHaveLength(3);
    expect(sinergias.get(3)).toHaveLength(1);
    expect(sinergias.get(4)).toBeUndefined();
  });

  it('los empates cuentan como sets juntos pero no ensucian el porcentaje', () => {
    const filas = [
      ...alineacion(['j1', 'j2'], { numeroSet: 1, resultadoSet: 'ganado' }),
      ...alineacion(['j1', 'j2'], { numeroSet: 2, resultadoSet: 'empate' }),
    ];

    const dupla = buscar(sinergiasDe(filas), ['j1', 'j2'])!;
    expect(dupla.setsJuntos).toBe(2);
    expect(dupla.decididosJuntos).toBe(1);
    expect(dupla.porcentajeJuntos).toBe(1);
  });

  it('la clave del grupo no depende del orden de captura', () => {
    const a = sinergiasDe(alineacion(['j2', 'j1']));
    const b = sinergiasDe(alineacion(['j1', 'j2']));
    expect(a.get(2)![0].clave).toBe(b.get(2)![0].clave);
  });

  it('suma la producción de los integrantes del grupo', () => {
    const filas = [
      ...alineacion(['j1'], { throws: 10, hits: 5, catches: 1, survive: true }),
      ...alineacion(['j2'], { throws: 10, hits: 3, catches: 0, survive: false }),
    ];

    const dupla = buscar(sinergiasDe(filas), ['j1', 'j2'])!;
    expect(dupla.throws).toBe(20);
    expect(dupla.hits).toBe(8);
    expect(dupla.efectividad).toBeCloseTo(0.4);
    expect(dupla.hitsPorSet).toBe(8);
    // Una aparición de cada uno en un set, uno sobrevivió.
    expect(dupla.supervivencia).toBe(0.5);
  });
});

describe('ordenarSinergias', () => {
  const grupo = (over: Partial<GrupoSinergia>): GrupoSinergia =>
    ({
      clave: 'x',
      jugadorIds: ['j1', 'j2'],
      nombres: ['J1', 'J2'],
      tamano: 2,
      setsJuntos: 5,
      decididosJuntos: 5,
      ganadosJuntos: 3,
      porcentajeJuntos: 0.6,
      setsSeparados: 5,
      decididosSeparados: 5,
      ganadosSeparados: 2,
      porcentajeSeparados: 0.4,
      sinergia: 0.2,
      throws: 0,
      hits: 0,
      outs: 0,
      catches: 0,
      efectividad: null,
      hitsPorSet: null,
      supervivencia: null,
      ...over,
    }) as GrupoSinergia;

  it('el mínimo de sets nunca agranda la lista', () => {
    const grupos = [grupo({ clave: 'a', setsJuntos: 2 }), grupo({ clave: 'b', setsJuntos: 8 })];
    expect(ordenarSinergias(grupos, { minSets: 4, orden: 'sinergia' })).toHaveLength(1);
    expect(ordenarSinergias(grupos, { minSets: 1, orden: 'sinergia' })).toHaveLength(2);
  });

  it('los inseparables van al final, no tratados como cero', () => {
    const grupos = [
      grupo({ clave: 'inseparable', sinergia: null }),
      grupo({ clave: 'negativo', sinergia: -0.3 }),
      grupo({ clave: 'positivo', sinergia: 0.4 }),
    ];

    const orden = ordenarSinergias(grupos, { minSets: 1, orden: 'sinergia' }).map((g) => g.clave);
    expect(orden).toEqual(['positivo', 'negativo', 'inseparable']);
  });

  it('a igual valor manda la muestra más grande', () => {
    const grupos = [
      grupo({ clave: 'chico', sinergia: 0.2, setsJuntos: 4 }),
      grupo({ clave: 'grande', sinergia: 0.2, setsJuntos: 12 }),
    ];
    expect(ordenarSinergias(grupos, { minSets: 1, orden: 'sinergia' })[0].clave).toBe('grande');
  });
});
