import { csvDeFilas, csvDeMetricasPorJugador, csvDeComparacionSegmentos } from './exportaciones';
import { fila } from './__fixtures__/filas';
import { filtrosVacios, type EstadoFiltros } from '../hooks/useFiltrosPartidos';
import type { PartidoTimeline } from '../services/timelineService';

const BOM = '﻿';

const lineas = (csv: string): string[] => csv.slice(BOM.length).trimEnd().split('\r\n');
const celdas = (linea: string): string[] => linea.split(';');

/** Índice de una columna por su encabezado, para no depender del orden en cada aserción. */
const columna = (csv: string, encabezado: string): number => {
  const indice = celdas(lineas(csv)[0]).indexOf(encabezado);
  expect(indice).toBeGreaterThanOrEqual(0);
  return indice;
};

const valorEn = (csv: string, nroFila: number, encabezado: string): string =>
  celdas(lineas(csv)[nroFila])[columna(csv, encabezado)];

describe('csvDeFilas', () => {
  it('escribe una línea por fila analítica, más el encabezado', () => {
    const csv = csvDeFilas([fila({ jugador: 'Nahum' }), fila({ jugador: 'Vicky' })]);
    expect(lineas(csv)).toHaveLength(3);
  });

  it('pasa la fecha a YYYY-MM-DD, sin la hora', () => {
    const csv = csvDeFilas([fila({ fecha: '2026-03-10T20:00:00.000Z' })]);
    expect(valorEn(csv, 1, 'Fecha')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('una fecha inválida deja la celda vacía en vez de escribir "Invalid Date"', () => {
    const csv = csvDeFilas([fila({ fecha: 'cualquier cosa' })]);
    expect(valorEn(csv, 1, 'Fecha')).toBe('');
  });

  it('traduce esLocal a una condición legible', () => {
    const local = csvDeFilas([fila({ esLocal: true })]);
    const visita = csvDeFilas([fila({ esLocal: false })]);
    expect(valorEn(local, 1, 'Condición')).toBe('local');
    expect(valorEn(visita, 1, 'Condición')).toBe('visitante');
  });

  it('escribe la fuente de cada fila: mezclar oficial y planilla sin decir cuál es cuál no sirve', () => {
    const oficial = csvDeFilas([fila({ fuente: 'oficial' })]);
    const planilla = csvDeFilas([fila({ fuente: 'planilla' })]);
    const sinDatos = csvDeFilas([fila({ fuente: null })]);
    expect(valorEn(oficial, 1, 'Fuente')).toBe('oficial');
    expect(valorEn(planilla, 1, 'Fuente')).toBe('planilla');
    expect(valorEn(sinDatos, 1, 'Fuente')).toBe('sin datos');
  });

  it('incluye las filas de partidos sin estadísticas, para que el conteo coincida con la pantalla', () => {
    // Un partido ganado sin planilla sigue siendo un partido ganado: su fila existe con el
    // jugador en null. Filtrarla acá haría que el CSV tenga menos partidos que la pantalla.
    const csv = csvDeFilas([fila({ jugadorId: null, jugador: null, numeroSet: null, throws: 0 })]);
    expect(lineas(csv)).toHaveLength(2);
    expect(valorEn(csv, 1, 'Jugador')).toBe('');
    expect(valorEn(csv, 1, 'Set')).toBe('');
    expect(valorEn(csv, 1, 'Resultado del partido')).toBe('ganado');
  });

  it('escribe "sobrevive" como sí/no', () => {
    const si = csvDeFilas([fila({ survive: true })]);
    const no = csvDeFilas([fila({ survive: false })]);
    expect(valorEn(si, 1, 'Sobrevive')).toBe('sí');
    expect(valorEn(no, 1, 'Sobrevive')).toBe('no');
  });

  it('entrecomilla el nombre de un rival que contiene el separador', () => {
    const csv = csvDeFilas([fila({ rival: 'Marvin; CABA' })]);
    expect(csv).toContain('"Marvin; CABA"');
  });

  it('sin filas deja sólo el encabezado — es un recorte vacío, no un error', () => {
    expect(lineas(csvDeFilas([]))).toHaveLength(1);
  });

  it('incluye el id estable del jugador, para unirlo entre exports', () => {
    const csv = csvDeFilas([fila({ jugadorId: 'j1' })]);
    expect(valorEn(csv, 1, 'ID del jugador')).toBe('j1');
  });
});

describe('csvDeMetricasPorJugador', () => {
  it('agrega por jugador: una línea por jugador, no una por set', () => {
    const csv = csvDeMetricasPorJugador([
      fila({ jugadorId: 'j1', jugador: 'Nahum', numeroSet: 1, throws: 10, hits: 4 }),
      fila({ jugadorId: 'j1', jugador: 'Nahum', numeroSet: 2, throws: 6, hits: 2 }),
    ]);

    expect(lineas(csv)).toHaveLength(2);
    expect(valorEn(csv, 1, 'Throws')).toBe('16');
    expect(valorEn(csv, 1, 'Hits')).toBe('6');
    expect(valorEn(csv, 1, 'Sets')).toBe('2');
  });

  it('escribe la efectividad como número con coma decimal, no como porcentaje de texto', () => {
    // Así se puede promediar y graficar en la planilla. El formato de % lo pone quien la abre.
    const csv = csvDeMetricasPorJugador([fila({ throws: 10, hits: 4 })]);
    expect(valorEn(csv, 1, 'Efectividad (hits/throws)')).toBe('0,400');
  });

  it('deja vacía la efectividad de un jugador sin throws, en vez de escribir 0', () => {
    // Cero throws no es cero efectividad: es que no hay con qué calcularla.
    const csv = csvDeMetricasPorJugador([fila({ throws: 0, hits: 0 })]);
    expect(valorEn(csv, 1, 'Efectividad (hits/throws)')).toBe('');
  });

  it('ignora las filas sin jugador', () => {
    const csv = csvDeMetricasPorJugador([fila({ jugadorId: null, jugador: null })]);
    expect(lineas(csv)).toHaveLength(1);
  });
});

describe('csvDeComparacionSegmentos', () => {
  const partido = (id: string, modalidad: string): PartidoTimeline =>
    ({
      _id: id,
      fecha: '2026-03-10T20:00:00.000Z',
      estado: 'finalizado',
      modalidad,
      categoria: 'Masculino',
      ubicacion: null,
      jornada: null,
      etapa: null,
      nombrePartido: null,
      esLocal: true,
      marcadorEquipo: 3,
      marcadorRival: 1,
      rival: { _id: 'r1', nombre: 'Marvin', escudo: null },
      competencia: null,
      temporada: null,
      fase: null,
      datos: {
        oficial: { existe: true, porSets: true, directa: false, verificada: false },
        planilla: null,
        fuenteEfectiva: 'oficial',
      },
    } as unknown as PartidoTimeline);

  const estadoCon = (modalidad: string): EstadoFiltros => {
    const filtros = filtrosVacios();
    filtros.modalidad.add(modalidad);
    return { filtros, desde: '', hasta: '' };
  };

  const partidos = [partido('p-foam', 'Foam'), partido('p-cloth', 'Cloth')];
  const filas = [
    fila({ partidoId: 'p-foam', throws: 10, hits: 5 }),
    fila({ partidoId: 'p-cloth', throws: 10, hits: 2 }),
  ];

  it('pone una columna por segmento, con su nombre como encabezado', () => {
    const csv = csvDeComparacionSegmentos(
      [
        { id: '1', nombre: 'Foam 2026', estado: estadoCon('Foam') },
        { id: '2', nombre: 'Cloth 2026', estado: estadoCon('Cloth') },
      ],
      partidos,
      filas,
    );

    expect(celdas(lineas(csv)[0])).toEqual(['Métrica', 'Foam 2026', 'Cloth 2026']);
  });

  it('cada columna sólo agrega los partidos de su propio segmento', () => {
    const csv = csvDeComparacionSegmentos(
      [
        { id: '1', nombre: 'Foam', estado: estadoCon('Foam') },
        { id: '2', nombre: 'Cloth', estado: estadoCon('Cloth') },
      ],
      partidos,
      filas,
    );

    const filaHits = lineas(csv).find((l) => l.startsWith('Hits;'));
    expect(filaHits).toBe('Hits;5;2');
  });

  it('los conteos enteros salen sin decimales y las proporciones con coma', () => {
    const csv = csvDeComparacionSegmentos(
      [{ id: '1', nombre: 'Foam', estado: estadoCon('Foam') }],
      partidos,
      filas,
    );

    expect(lineas(csv).find((l) => l.startsWith('Partidos;'))).toBe('Partidos;1');
    expect(lineas(csv).find((l) => l.startsWith('Efectividad'))).toContain(';0,500');
  });

  it('un nombre de segmento con el separador adentro no corre las columnas', () => {
    // Los nombres salen de `describirFiltros`, que junta etiquetas con " · " — pero el usuario
    // puede renombrar, y un nombre con ";" partiría la fila del encabezado en dos columnas.
    const csv = csvDeComparacionSegmentos(
      [{ id: '1', nombre: 'Foam; Masculino', estado: estadoCon('Foam') }],
      partidos,
      filas,
    );

    // Queda entrecomillado, que es lo que mantiene las dos columnas al abrirlo. (El helper
    // `celdas` de este archivo parte por `;` a lo bruto y no entiende comillas, así que acá se
    // compara la línea entera en vez de contar celdas.)
    expect(lineas(csv)[0]).toBe('Métrica;"Foam; Masculino"');
  });

  it('sin segmentos deja sólo la columna de métricas', () => {
    const csv = csvDeComparacionSegmentos([], partidos, filas);
    expect(celdas(lineas(csv)[0])).toEqual(['Métrica']);
  });
});
