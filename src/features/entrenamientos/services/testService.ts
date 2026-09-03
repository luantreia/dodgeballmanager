import { authFetch } from '../../../shared/utils/authFetch';
import type { TipoTestMejorEs } from '../../../shared/types/modelos.generado';

export type { TipoTestMejorEs };

export type TipoTest = {
  _id: string;
  equipo: string;
  nombre: string;
  unidad: string;
  /** Hacia dónde es mejorar. Decide si la flecha va verde o roja. */
  mejorEs: TipoTestMejorEs;
  decimales: number;
  descripcion: string;
  activo: boolean;
};

export type ResultadoTest = {
  _id: string;
  jugadorId: string;
  jugador: string;
  tipoTestId: string;
  /** `YYYY-MM-DD`. El backend lo guarda como día, sin hora. */
  fecha: string;
  valor: number;
  notas: string;
  entrenamiento: string | null;
};

export type EvolucionJugador = {
  jugadorId: string;
  jugador: string;
  tipoTestId: string;
  tipoTest: string;
  unidad: string;
  decimales: number;
  mediciones: Array<{ fecha: string; valor: number }>;
  primera: number;
  ultima: number;
  delta: number;
  /**
   * `true` mejoró, `false` empeoró, `null` sin juicio (una sola medición, sin cambio, o un test
   * neutro como el peso). Lo decide el servidor: si cada cliente lo recalculara, bastaría con
   * que uno se olvidara de `mejorEs` para pintar de verde un empeoramiento en un test de tiempo.
   */
  mejoro: boolean | null;
};

const BASE = '/tests';

export const listarTiposTest = async (equipoId: string, incluirArchivados = false): Promise<TipoTest[]> => {
  const params = new URLSearchParams({ equipo: equipoId });
  if (incluirArchivados) params.set('archivados', 'true');
  const resp = await authFetch<{ tipos: TipoTest[] }>(`${BASE}/tipos?${params.toString()}`);
  return resp.tipos ?? [];
};

export const crearTipoTest = (payload: {
  equipo: string;
  nombre: string;
  unidad?: string;
  mejorEs?: TipoTestMejorEs;
  decimales?: number;
  descripcion?: string;
}) => authFetch<TipoTest>(`${BASE}/tipos`, { method: 'POST', body: payload });

export const editarTipoTest = (id: string, cambios: Partial<Omit<TipoTest, '_id' | 'equipo'>>) =>
  authFetch<TipoTest>(`${BASE}/tipos/${id}`, { method: 'PUT', body: cambios });

/** Si el test tiene mediciones, el backend lo archiva en vez de borrarlo y lo informa. */
export const eliminarTipoTest = (id: string) =>
  authFetch<{ archivado?: boolean; mediciones?: number; mensaje?: string } | void>(
    `${BASE}/tipos/${id}`,
    { method: 'DELETE' },
  );

export const listarResultados = async (
  equipoId: string,
  filtros?: { tipoTest?: string; jugador?: string },
): Promise<ResultadoTest[]> => {
  const params = new URLSearchParams({ equipo: equipoId });
  if (filtros?.tipoTest) params.set('tipoTest', filtros.tipoTest);
  if (filtros?.jugador) params.set('jugador', filtros.jugador);
  const resp = await authFetch<{ resultados: ResultadoTest[] }>(`${BASE}/resultados?${params.toString()}`);
  return resp.resultados ?? [];
};

/**
 * Carga una jornada de mediciones completa: un test, una fecha, todo el plantel.
 *
 * Es cómo se toma un test en la realidad —"hoy medimos salto a todos"— y por eso el guardado es
 * en lote y no fila por fila. Un `valor` vacío borra la medición de ese jugador en vez de
 * guardar un cero, que en un test es un valor legítimo y muy distinto de "no se lo midió".
 */
export const guardarResultados = (payload: {
  equipo: string;
  tipoTest: string;
  fecha: string;
  entrenamiento?: string | null;
  resultados: Array<{ jugadorId: string; valor: number | ''; notas?: string }>;
}) => authFetch<{ ok: boolean; guardadas: number; borradas: number }>(`${BASE}/resultados`, {
  method: 'PUT',
  body: payload,
});

export const getEvolucion = async (equipoId: string): Promise<EvolucionJugador[]> => {
  const resp = await authFetch<{ evolucion: EvolucionJugador[] }>(
    `${BASE}/evolucion?equipo=${encodeURIComponent(equipoId)}`,
  );
  return resp.evolucion ?? [];
};

/**
 * Sugerencias para arrancar, no una lista fija del sistema.
 *
 * Un catálogo vacío es una pared: nadie sabe qué se supone que tiene que medir. Estos son
 * puntos de partida razonables para dodgeball que el DT puede agregar de a uno, editar o
 * ignorar. La unidad y la dirección vienen ya resueltas porque acertar `mejorEs` es
 * justamente lo que se escribe mal.
 */
export const TESTS_SUGERIDOS: Array<{
  nombre: string;
  unidad: string;
  mejorEs: TipoTestMejorEs;
  decimales: number;
  descripcion: string;
}> = [
  { nombre: 'Sprint 10 m', unidad: 's', mejorEs: 'menor', decimales: 2, descripcion: 'Salida detenida, mejor de dos intentos.' },
  { nombre: 'Salto vertical', unidad: 'cm', mejorEs: 'mayor', decimales: 0, descripcion: 'Con contramovimiento, sin carrera.' },
  { nombre: 'Velocidad de lanzamiento', unidad: 'km/h', mejorEs: 'mayor', decimales: 0, descripcion: 'Mejor de tres lanzamientos.' },
  { nombre: 'Precisión de lanzamiento', unidad: 'aciertos /10', mejorEs: 'mayor', decimales: 0, descripcion: 'Diez lanzamientos a blanco fijo.' },
  { nombre: 'Course-Navette', unidad: 'nivel', mejorEs: 'mayor', decimales: 1, descripcion: 'Test de resistencia progresivo (beep test).' },
  { nombre: 'Peso', unidad: 'kg', mejorEs: 'neutro', decimales: 1, descripcion: 'Registro de seguimiento, sin juicio de valor.' },
];
