import { calcularMetricasEquipo, calcularMetricasJugadores } from './metricas';
import type { FilaAnalitica } from '../services/filasService';

const fila = (over: Partial<FilaAnalitica>): FilaAnalitica => ({
  partidoId: 'p1',
  fecha: '2026-03-10T20:00:00.000Z',
  estadoPartido: 'finalizado',
  modalidad: 'Foam',
  categoria: 'Masculino',
  competenciaId: 'c1',
  competencia: 'Liga',
  organizacionId: 'o1',
  organizacion: 'DB Buenos Aires',
  temporadaId: null,
  temporada: 'Sin temporada',
  faseId: null,
  fase: 'Sin fase',
  rivalId: 'r1',
  rival: 'Marvin',
  esLocal: true,
  marcadorEquipo: 3,
  marcadorRival: 1,
  resultadoPartido: 'ganado',
  fuente: 'oficial',
  numeroSet: 1,
  resultadoSet: 'ganado',
  jugadorId: 'j1',
  jugador: 'Nahum',
  throws: 10,
  hits: 4,
  outs: 1,
  catches: 2,
  survive: true,
  ...over,
});

describe('calcularMetricasEquipo', () => {
  it('cuenta partidos únicos, no filas', () => {
    // Un partido con dos jugadores en dos sets son 4 filas, pero un solo partido ganado.
    const filas = [
      fila({ jugadorId: 'j1', numeroSet: 1 }),
      fila({ jugadorId: 'j2', numeroSet: 1 }),
      fila({ jugadorId: 'j1', numeroSet: 2, resultadoSet: 'perdido' }),
      fila({ jugadorId: 'j2', numeroSet: 2, resultadoSet: 'perdido' }),
    ];

    const m = calcularMetricasEquipo(filas);
    expect(m.partidos).toBe(1);
    expect(m.jugados).toBe(1);
    expect(m.ganados).toBe(1);
    expect(m.porcentajeVictorias).toBe(1);
    // Y los sets también se cuentan una vez por partido, no una por jugador que los jugó.
    expect(m.setsGanados).toBe(1);
    expect(m.setsPerdidos).toBe(1);
  });

  it('los partidos sin cerrar no entran en el porcentaje de victorias', () => {
    const filas = [
      fila({ partidoId: 'p1', resultadoPartido: 'ganado' }),
      fila({ partidoId: 'p2', resultadoPartido: 'perdido' }),
      // Programado: todavía no se jugó. Contarlo como derrota hundiría el % de una temporada
      // en curso.
      fila({ partidoId: 'p3', estadoPartido: 'programado', resultadoPartido: 'sin definir' }),
    ];

    const m = calcularMetricasEquipo(filas);
    expect(m.partidos).toBe(3);
    expect(m.jugados).toBe(2);
    expect(m.porcentajeVictorias).toBe(0.5);
  });

  it('cuenta el partido aunque no tenga estadísticas cargadas', () => {
    const filas = [
      fila({ partidoId: 'p1' }),
      // Fila de partido sin ninguna fuente: existe para el conteo, no aporta jugador.
      fila({
        partidoId: 'p2',
        fuente: null,
        jugadorId: null,
        jugador: null,
        numeroSet: null,
        resultadoSet: 'sin definir',
        throws: 0,
        hits: 0,
        outs: 0,
        catches: 0,
      }),
    ];

    const m = calcularMetricasEquipo(filas);
    expect(m.jugados).toBe(2);
    expect(m.ganados).toBe(2);
    // Pero se distingue cuántos tienen datos de verdad.
    expect(m.partidosConDatos).toBe(1);
  });

  it('la efectividad es hits sobre throws y admite pasar de 100%', () => {
    // Un tiro puede quemar a más de un rival, así que hits no está acotado por throws.
    const m = calcularMetricasEquipo([fila({ throws: 10, hits: 12 })]);
    expect(m.efectividad).toBeCloseTo(1.2);

    expect(calcularMetricasEquipo([fila({ throws: 0, hits: 0 })]).efectividad).toBeNull();
  });
});

describe('calcularMetricasJugadores', () => {
  it('agrupa por jugador y calcula efectividad y supervivencia', () => {
    const filas = [
      fila({ jugadorId: 'j1', jugador: 'Nahum', numeroSet: 1, throws: 10, hits: 4, survive: true }),
      fila({ jugadorId: 'j1', jugador: 'Nahum', numeroSet: 2, throws: 10, hits: 6, survive: false }),
      fila({ jugadorId: 'j2', jugador: 'Otro', numeroSet: 1, throws: 5, hits: 1, survive: true }),
    ];

    const [nahum] = calcularMetricasJugadores(filas);
    expect(nahum.jugador).toBe('Nahum');
    expect(nahum.sets).toBe(2);
    expect(nahum.partidos).toBe(1);
    expect(nahum.efectividad).toBeCloseTo(0.5);
    expect(nahum.supervivencia).toBeCloseTo(0.5);
  });

  it('ignora las filas de partidos sin estadísticas', () => {
    const filas = [
      fila({ jugadorId: 'j1', jugador: 'Nahum' }),
      fila({ partidoId: 'p2', fuente: null, jugadorId: null, jugador: null }),
    ];
    expect(calcularMetricasJugadores(filas)).toHaveLength(1);
  });

  it('la captura directa no tiene sets pero sí cuenta el partido', () => {
    // En modo directa numeroSet es null: los totales son del partido entero.
    const m = calcularMetricasJugadores([fila({ numeroSet: null, throws: 20, hits: 9 })]);
    expect(m[0].sets).toBe(0);
    expect(m[0].partidos).toBe(1);
    expect(m[0].efectividad).toBeCloseTo(0.45);
    expect(m[0].supervivencia).toBeNull();
  });
});
