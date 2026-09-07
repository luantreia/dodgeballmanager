import { construirSets, esDecidido, resumirSets } from './setsAnaliticos';
import { alineacion, fila } from './__fixtures__/filas';

describe('construirSets', () => {
  it('agrupa las filas por partido y número de set', () => {
    const filas = [
      ...alineacion(['j1', 'j2', 'j3'], { partidoId: 'p1', numeroSet: 1 }),
      ...alineacion(['j1', 'j2'], { partidoId: 'p1', numeroSet: 2, resultadoSet: 'perdido' }),
      ...alineacion(['j1'], { partidoId: 'p2', numeroSet: 1 }),
    ];

    const sets = construirSets(filas);
    expect(sets).toHaveLength(3);

    const primero = sets.find((s) => s.clave === 'p1#1')!;
    expect(primero.jugadores.map((j) => j.jugadorId)).toEqual(['j1', 'j2', 'j3']);
    expect(primero.resultado).toBe('ganado');
  });

  it('el mismo número de set en partidos distintos no se mezcla', () => {
    const filas = [
      ...alineacion(['j1', 'j2'], { partidoId: 'p1', numeroSet: 1 }),
      ...alineacion(['j3', 'j4'], { partidoId: 'p2', numeroSet: 1 }),
    ];
    expect(construirSets(filas)).toHaveLength(2);
  });

  it('descarta las filas sin set: captura directa y partidos sin datos', () => {
    const filas = [
      // Captura directa: totales del partido entero, sin desglose por set.
      fila({ numeroSet: null, throws: 40 }),
      // Partido sin ninguna fuente cargada.
      fila({ partidoId: 'p2', numeroSet: null, jugadorId: null, jugador: null, fuente: null }),
    ];
    expect(construirSets(filas)).toHaveLength(0);
  });

  it('suma los totales del equipo y cuenta los supervivientes', () => {
    const filas = [
      fila({ jugadorId: 'j1', throws: 10, hits: 4, outs: 1, catches: 2, survive: true }),
      fila({ jugadorId: 'j2', throws: 6, hits: 1, outs: 0, catches: 1, survive: false }),
    ];

    const [set] = construirSets(filas);
    expect(set.totales).toEqual({ throws: 16, hits: 5, outs: 1, catches: 3, survives: 1 });
  });

  it('fusiona un jugador duplicado en el mismo set en vez de contarlo dos veces', () => {
    const filas = [
      fila({ jugadorId: 'j1', throws: 10, hits: 4 }),
      fila({ jugadorId: 'j1', throws: 5, hits: 2 }),
      fila({ jugadorId: 'j2', throws: 1, hits: 0 }),
    ];

    const [set] = construirSets(filas);
    expect(set.jugadores).toHaveLength(2);
    expect(set.jugadores[0]).toMatchObject({ jugadorId: 'j1', throws: 15, hits: 6 });
    expect(set.totales.throws).toBe(16);
  });
});

describe('esDecidido / resumirSets', () => {
  it('los empates y los sets sin definir no entran al denominador', () => {
    const sets = construirSets([
      ...alineacion(['j1'], { numeroSet: 1, resultadoSet: 'ganado' }),
      ...alineacion(['j1'], { numeroSet: 2, resultadoSet: 'perdido' }),
      ...alineacion(['j1'], { numeroSet: 3, resultadoSet: 'empate' }),
      ...alineacion(['j1'], { numeroSet: 4, resultadoSet: 'sin definir' }),
    ]);

    expect(sets.filter(esDecidido)).toHaveLength(2);

    const resumen = resumirSets(sets);
    // Los cuatro se jugaron...
    expect(resumen.sets).toBe(4);
    // ...pero el porcentaje sale sobre los dos que cerraron.
    expect(resumen.decididos).toBe(2);
    expect(resumen.porcentaje).toBe(0.5);
  });

  it('sin sets decididos el porcentaje es null, no cero', () => {
    const sets = construirSets(alineacion(['j1'], { resultadoSet: 'sin definir' }));
    expect(resumirSets(sets).porcentaje).toBeNull();
  });
});
