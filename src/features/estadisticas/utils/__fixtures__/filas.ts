import type { FilaAnalitica } from '../../services/filasService';

/**
 * Constructores de filas analíticas para los tests de agregación.
 *
 * Viven en `__fixtures__` y no en un `.test.ts` para que los tres archivos de test las compartan
 * sin importarse entre sí: un test que importa a otro hace que agregar un caso en uno pueda
 * romper al otro por un motivo que no tiene nada que ver.
 */
export const fila = (over: Partial<FilaAnalitica> = {}): FilaAnalitica => ({
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

/** Una alineación completa en un set: una fila por jugador, todas con el mismo contexto. */
export const alineacion = (
  ids: string[],
  over: Partial<FilaAnalitica> = {},
): FilaAnalitica[] => ids.map((id) => fila({ jugadorId: id, jugador: id.toUpperCase(), ...over }));
