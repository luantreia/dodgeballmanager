import { construirSets } from './setsAnaliticos';
import { construirTramos, resumirTramos } from './tramosAlineacion';
import { alineacion } from './__fixtures__/filas';
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
    expect(segundo.cambio).toEqual({
      salieron: [{ jugadorId: 'j6', jugador: 'J6' }],
      entraron: [{ jugadorId: 'j7', jugador: 'J7' }],
    });
  });

  it('un cambio doble lista los dos que salieron y los dos que entraron', () => {
    const secuencia = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(['j1', 'j2', 'j3', 'j4', 'j7', 'j8'], 2, 'ganado'),
    ]);

    expect(secuencia.tramos[1].cambio).toEqual({
      salieron: [
        { jugadorId: 'j5', jugador: 'J5' },
        { jugadorId: 'j6', jugador: 'J6' },
      ],
      entraron: [
        { jugadorId: 'j7', jugador: 'J7' },
        { jugadorId: 'j8', jugador: 'J8' },
      ],
    });
  });

  it('volver a la alineación anterior es un tramo nuevo, no una continuación del primero', () => {
    const secuencia = unPartido([
      ...set(SEIS, 1, 'ganado'),
      ...set(CON_SUPLENTE, 2, 'perdido'),
      ...set(SEIS, 3, 'ganado'),
    ]);

    expect(secuencia.tramos).toHaveLength(3);
    expect(secuencia.tramos[2].cambio).toEqual({
      salieron: [{ jugadorId: 'j7', jugador: 'J7' }],
      entraron: [{ jugadorId: 'j6', jugador: 'J6' }],
    });
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
