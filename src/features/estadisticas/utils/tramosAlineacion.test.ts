import { construirSets } from './setsAnaliticos';
import { construirTramos, resumirTramos } from './tramosAlineacion';
import { alineacion, fila } from './__fixtures__/filas';
import type { FilaAnalitica } from '../services/filasService';

const SEIS = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
/** Los mismos seis con j6 reemplazado por j7 — un cambio de un solo jugador. */
const CON_SUPLENTE = ['j1', 'j2', 'j3', 'j4', 'j5', 'j7'];

/** Un set con la alineación y el resultado indicados. */
const set = (
  ids: string[],
  numeroSet: number,
  resultadoSet: FilaAnalitica['resultadoSet'],
  partidoId = 'p1',
): FilaAnalitica[] => alineacion(ids, { partidoId, numeroSet, resultadoSet });

const tramosDe = (filas: FilaAnalitica[]) => construirTramos(construirSets(filas));
const unPartido = (filas: FilaAnalitica[]) => tramosDe(filas)[0];

describe('construirTramos', () => {
  it('agrupa los sets consecutivos con los mismos seis en un solo tramo', () => {
    const secuencia = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(SEIS, 2, 'ganado'),
      ...set(SEIS, 3, 'perdido'),
    ]);

    expect(secuencia.tramos).toHaveLength(1);
    const [tramo] = secuencia.tramos;
    expect(tramo.desdeSet).toBe(1);
    expect(tramo.hastaSet).toBe(3);
    expect(tramo.sets).toBe(3);
    expect(tramo.ganados).toBe(2);
    expect(tramo.perdidos).toBe(1);
    expect(tramo.porcentaje).toBeCloseTo(2 / 3);
    expect(tramo.resultados).toEqual(['ganado', 'ganado', 'perdido']);
    // El primer tramo no tiene nada a lo que atribuirse.
    expect(tramo.cambio).toBeNull();
    expect(tramo.huecoAntes).toBe(0);
  });

  it('un cambio de alineación abre un tramo nuevo y dice quién salió y quién entró', () => {
    // Es el caso que motivó todo esto: racha a favor, cambio, racha en contra.
    const secuencia = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(SEIS, 2, 'ganado'),
      ...set(SEIS, 3, 'ganado'),
      ...set(CON_SUPLENTE, 4, 'perdido'),
      ...set(CON_SUPLENTE, 5, 'perdido'),
    ]);

    expect(secuencia.tramos).toHaveLength(2);
    const [primero, segundo] = secuencia.tramos;

    expect(primero.sets).toBe(3);
    expect(primero.ganados).toBe(3);

    expect(segundo.desdeSet).toBe(4);
    expect(segundo.sets).toBe(2);
    expect(segundo.perdidos).toBe(2);
    expect(segundo.porcentaje).toBe(0);
    expect(segundo.cambio?.salieron.map((j) => j.jugador)).toEqual(['J6']);
    expect(segundo.cambio?.entraron.map((j) => j.jugador)).toEqual(['J7']);
  });

  it('un cambio doble lista los dos que salieron y los dos que entraron', () => {
    const secuencia = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(['j1', 'j2', 'j3', 'j4', 'j7', 'j8'], 2, 'ganado'),
    ]);

    expect(secuencia.tramos[1].cambio?.salieron.map((j) => j.jugador)).toEqual(['J5', 'J6']);
    expect(secuencia.tramos[1].cambio?.entraron.map((j) => j.jugador)).toEqual(['J7', 'J8']);
  });

  it('volver a la alineación anterior es un tramo nuevo, no una continuación del primero', () => {
    const secuencia = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(CON_SUPLENTE, 2, 'perdido'),
      ...set(SEIS, 3, 'ganado'),
    ]);

    expect(secuencia.tramos).toHaveLength(3);
    expect(secuencia.tramos[2].cambio?.salieron.map((j) => j.jugador)).toEqual(['J7']);
    expect(secuencia.tramos[2].cambio?.entraron.map((j) => j.jugador)).toEqual(['J6']);
  });

  describe('capturas incompletas', () => {
    it('descarta el set incompleto y lo cuenta aparte', () => {
      const secuencia = unPartido([
        ...set(SEIS, 1, 'ganado'),
        // Alguien cargó 4 de 6: para la grilla es un set válido, acá es ilegible.
        ...set(['j1', 'j2', 'j3', 'j4'], 2, 'perdido'),
        ...set(SEIS, 3, 'ganado'),
      ]);

      expect(secuencia.setsIgnorados).toBe(1);
      expect(secuencia.setsLeidos).toBe(2);
    });

    it('NO atribuye un cambio a través de un set incompleto', () => {
      // Es la razón de ser del guard: si falta la captura del set del medio, no se sabe en qué
      // momento cambió la alineación, ni si cambió una vez o tres.
      const secuencia = unPartido([
        ...set(SEIS, 1, 'ganado'),
        ...set(['j1', 'j2'], 2, 'perdido'),
        ...set(CON_SUPLENTE, 3, 'perdido'),
      ]);

      expect(secuencia.tramos).toHaveLength(2);
      expect(secuencia.tramos[1].cambio).toBeNull();
      expect(secuencia.tramos[1].huecoAntes).toBe(1);
    });

    it('corta la continuidad aunque la alineación sea la misma de los dos lados', () => {
      // No se puede afirmar que fue una racha de 3 sets: del set 2 no se sabe nada.
      const secuencia = unPartido([
        ...set(SEIS, 1, 'ganado'),
        ...set(['j1', 'j2', 'j3'], 2, 'ganado'),
        ...set(SEIS, 3, 'ganado'),
      ]);

      expect(secuencia.tramos).toHaveLength(2);
      expect(secuencia.tramos.map((t) => t.sets)).toEqual([1, 1]);
      expect(secuencia.tramos[1].huecoAntes).toBe(1);
    });

    it('un partido entero mal capturado no produce tramos, pero sí queda reportado', () => {
      const secuencia = unPartido([
        ...set(['j1', 'j2', 'j3', 'j4'], 1, 'ganado'),
        ...set(['j1', 'j2', 'j3', 'j4'], 2, 'perdido'),
      ]);

      expect(secuencia.tramos).toHaveLength(0);
      expect(secuencia.setsIgnorados).toBe(2);
    });

    it('acumula varios sets ilegibles seguidos en un solo hueco', () => {
      const secuencia = unPartido([
        ...set(SEIS, 1, 'ganado'),
        ...set(['j1'], 2, 'perdido'),
        ...set(['j1', 'j2'], 3, 'perdido'),
        ...set(SEIS, 4, 'ganado'),
      ]);

      expect(secuencia.tramos[1].huecoAntes).toBe(2);
    });

    it('con `jugadoresEsperados` se puede leer un formato de otra cantidad', () => {
      const secuencias = construirTramos(
        construirSets([...set(['j1', 'j2', 'j3'], 1, 'ganado'), ...set(['j1', 'j2', 'j3'], 2, 'ganado')]),
        { jugadoresEsperados: 3 },
      );
      expect(secuencias[0].tramos).toHaveLength(1);
      expect(secuencias[0].setsIgnorados).toBe(0);
    });
  });

  it('un salto en la numeración también es un hueco', () => {
    // El set 2 no está en el dataset: puede no haberse jugado, puede haberlo recortado un filtro,
    // o puede no haberse cargado nunca. En los tres casos no hay continuidad que afirmar.
    const secuencia = unPartido([...set(SEIS, 1, 'ganado'), ...set(SEIS, 3, 'ganado')]);

    expect(secuencia.tramos).toHaveLength(2);
    expect(secuencia.tramos[1].huecoAntes).toBe(1);
    expect(secuencia.tramos[1].cambio).toBeNull();
  });

  it('ordena los sets aunque lleguen desordenados', () => {
    // `construirSets` devuelve un mapa, sin orden garantizado.
    const secuencia = unPartido([
      ...set(SEIS, 3, 'perdido'),
      ...set(SEIS, 1, 'ganado'),
      ...set(SEIS, 2, 'ganado'),
    ]);

    expect(secuencia.tramos).toHaveLength(1);
    expect(secuencia.tramos[0].desdeSet).toBe(1);
    expect(secuencia.tramos[0].hastaSet).toBe(3);
    expect(secuencia.tramos[0].resultados).toEqual(['ganado', 'ganado', 'perdido']);
  });

  it('cada partido es su propia secuencia: la misma alineación en dos partidos no se une', () => {
    const secuencias = tramosDe([
      ...set(SEIS, 1, 'ganado', 'p1'),
      ...set(SEIS, 1, 'perdido', 'p2'),
    ]);

    expect(secuencias).toHaveLength(2);
    for (const secuencia of secuencias) {
      expect(secuencia.tramos).toHaveLength(1);
      // Nada que atribuir: el primer tramo de cada partido no viene de ningún cambio.
      expect(secuencia.tramos[0].cambio).toBeNull();
    }
  });

  it('los empates y los sets sin cerrar cuentan como jugados pero salen del porcentaje', () => {
    const tramo = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(SEIS, 2, 'empate'),
      ...set(SEIS, 3, 'sin definir'),
    ]).tramos[0];

    expect(tramo.sets).toBe(3);
    expect(tramo.decididos).toBe(1);
    expect(tramo.porcentaje).toBe(1);
  });

  it('un tramo sin ningún set decidido da porcentaje null, no cero', () => {
    const tramo = unPartido([...set(SEIS, 1, 'empate'), ...set(SEIS, 2, 'sin definir')]).tramos[0];
    expect(tramo.decididos).toBe(0);
    expect(tramo.porcentaje).toBeNull();
  });

  it('la alineación sale ordenada por nombre, para que se lea igual siempre', () => {
    const secuencia = unPartido(set(['j3', 'j1', 'j2', 'j4', 'j5', 'j6'], 1, 'ganado'));
    expect(secuencia.tramos[0].jugadores.map((j) => j.jugador)).toEqual([
      'J1',
      'J2',
      'J3',
      'J4',
      'J5',
      'J6',
    ]);
  });

  it('sin sets no devuelve secuencias', () => {
    expect(construirTramos([])).toEqual([]);
  });
});

describe('resumirTramos', () => {
  it('cuenta tramos, cambios atribuibles y sets que no se pudieron leer', () => {
    const secuencias = tramosDe([
      ...set(SEIS, 1, 'ganado', 'p1'),
      ...set(SEIS, 2, 'ganado', 'p1'),
      ...set(CON_SUPLENTE, 3, 'perdido', 'p1'),
      ...set(['j1', 'j2'], 4, 'perdido', 'p1'),
      ...set(SEIS, 1, 'ganado', 'p2'),
    ]);

    const resumen = resumirTramos(secuencias);

    expect(resumen.partidos).toBe(2);
    expect(resumen.tramos).toBe(3);
    // Sólo uno de los tres tramos nace de un cambio atribuible.
    expect(resumen.cambios).toBe(1);
    expect(resumen.setsLeidos).toBe(4);
    expect(resumen.setsIgnorados).toBe(1);
    // Sólo el tramo de dos sets de p1 es una "racha".
    expect(resumen.tramosConRacha).toBe(1);
  });

  it('sin secuencias devuelve todo en cero', () => {
    expect(resumirTramos([])).toEqual({
      partidos: 0,
      tramos: 0,
      cambios: 0,
      setsLeidos: 0,
      setsIgnorados: 0,
      tramosConRacha: 0,
    });
  });
});

describe('producción del tramo', () => {
  /** Un set donde cada jugador tiene sus propios contadores. */
  const setCon = (
    jugadores: Array<{
      id: string;
      throws?: number;
      hits?: number;
      outs?: number;
      catches?: number;
      survive?: boolean;
    }>,
    numeroSet: number,
    resultadoSet: FilaAnalitica['resultadoSet'] = 'ganado',
    partidoId = 'p1',
  ): FilaAnalitica[] =>
    jugadores.map((j) =>
      fila({
        partidoId,
        numeroSet,
        resultadoSet,
        jugadorId: j.id,
        jugador: j.id.toUpperCase(),
        throws: j.throws ?? 0,
        hits: j.hits ?? 0,
        outs: j.outs ?? 0,
        catches: j.catches ?? 0,
        survive: j.survive ?? false,
      }),
    );

  /** Seis jugadores con los contadores que se le pasen al primero; el resto en cero. */
  const seisCon = (primero: {
    throws?: number;
    hits?: number;
    outs?: number;
    catches?: number;
    survive?: boolean;
  }) => [
    { id: 'j1', ...primero },
    { id: 'j2' },
    { id: 'j3' },
    { id: 'j4' },
    { id: 'j5' },
    { id: 'j6' },
  ];

  it('el ritmo del equipo va por set, no en totales', () => {
    // Dos tramos de distinto largo sólo se pueden comparar por set: en bruto, el más largo
    // siempre tiene más de todo.
    const tramo = unPartido([
      ...setCon(seisCon({ throws: 10, hits: 4, catches: 2 }), 1),
      ...setCon(seisCon({ throws: 6, hits: 2, catches: 0 }), 2),
    ]).tramos[0];

    expect(tramo.sets).toBe(2);
    expect(tramo.ritmo.throwsPorSet).toBe(8);
    expect(tramo.ritmo.hitsPorSet).toBe(3);
    expect(tramo.ritmo.catchesPorSet).toBe(1);
    expect(tramo.ritmo.efectividad).toBeCloseTo(6 / 16);
  });

  it('sin tiros no hay efectividad que calcular', () => {
    const tramo = unPartido(setCon(seisCon({}), 1)).tramos[0];
    expect(tramo.ritmo.efectividad).toBeNull();
  });

  it('el aporte es por jugador y ordenado por hits', () => {
    const tramo = unPartido([
      ...setCon(
        [
          { id: 'j1', throws: 10, hits: 1 },
          { id: 'j2', throws: 4, hits: 4 },
          { id: 'j3' },
          { id: 'j4' },
          { id: 'j5' },
          { id: 'j6' },
        ],
        1,
      ),
    ]).tramos[0];

    expect(tramo.aportes).toHaveLength(6);
    expect(tramo.aportes[0].jugador).toBe('J2');
    expect(tramo.aportes[0].hits).toBe(4);
    // Mucho volumen y poca puntería: es justo lo que el resultado del set no cuenta.
    const j1 = tramo.aportes.find((a) => a.jugador === 'J1')!;
    expect(j1.throws).toBe(10);
    expect(j1.ritmo.efectividad).toBeCloseTo(0.1);
  });

  it('acumula el aporte de un jugador a lo largo de todo el tramo', () => {
    const tramo = unPartido([
      ...setCon(seisCon({ throws: 5, hits: 2, survive: true }), 1),
      ...setCon(seisCon({ throws: 5, hits: 4, survive: false }), 2),
    ]).tramos[0];

    const j1 = tramo.aportes.find((a) => a.jugador === 'J1')!;
    expect(j1.sets).toBe(2);
    expect(j1.throws).toBe(10);
    expect(j1.hits).toBe(6);
    expect(j1.ritmo.hitsPorSet).toBe(3);
    // Sobrevivió uno de los dos sets.
    expect(j1.supervivencia).toBe(0.5);
  });

  describe('el cambio trae los números de los dos lados', () => {
    /** Racha a favor generando mucho, cambio, racha en contra generando poco. */
    const conCambio = () =>
      unPartido([
        ...setCon(seisCon({ throws: 10, hits: 5 }), 1, 'ganado'),
        ...setCon(seisCon({ throws: 10, hits: 5 }), 2, 'ganado'),
        ...setCon(
          [
            { id: 'j1', throws: 10, hits: 5 },
            { id: 'j2' },
            { id: 'j3' },
            { id: 'j4' },
            { id: 'j5' },
            { id: 'j7', throws: 2, hits: 0 },
          ],
          3,
          'perdido',
        ),
      ]);

    it('los números de quien salió son del tramo que terminó', () => {
      // J6 jugó los sets 1 y 2 sin tirar: su aporte sale de ahí, no del tramo nuevo donde ya
      // no está.
      const cambio = conCambio().tramos[1].cambio!;
      const j6 = cambio.salieron.find((j) => j.jugador === 'J6')!;
      expect(j6.sets).toBe(2);
      expect(j6.throws).toBe(0);
    });

    it('los números de quien entró son del tramo que arranca', () => {
      const cambio = conCambio().tramos[1].cambio!;
      const j7 = cambio.entraron.find((j) => j.jugador === 'J7')!;
      expect(j7.sets).toBe(1);
      expect(j7.throws).toBe(2);
      expect(j7.hits).toBe(0);
      expect(j7.ritmo.efectividad).toBe(0);
    });

    it('el delta dice cuánto se movió la producción del equipo, por set', () => {
      // Antes: 10 throws y 5 hits por set. Después: 12 throws y 5 hits en un set.
      const cambio = conCambio().tramos[1].cambio!;
      expect(cambio.delta.throwsPorSet).toBe(2);
      expect(cambio.delta.hitsPorSet).toBe(0);
      // La efectividad cae aunque los hits se mantengan: se tiró más para lo mismo.
      expect(cambio.delta.efectividad).toBeCloseTo(5 / 12 - 5 / 10);
    });

    it('un tramo sin tiros deja el delta de efectividad en null, no en cero', () => {
      const secuencia = unPartido([
        ...setCon(seisCon({ throws: 10, hits: 5 }), 1, 'ganado'),
        ...setCon([{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }, { id: 'j4' }, { id: 'j5' }, { id: 'j7' }], 2, 'perdido'),
      ]);

      const cambio = secuencia.tramos[1].cambio!;
      expect(cambio.delta.efectividad).toBeNull();
      expect(cambio.delta.hitsPorSet).toBe(-5);
    });
  });
});
