import { authFetch } from '../../../shared/utils/authFetch';
import type {
  AsistenciaEntrenamientoEstado,
  EntrenamientoEstado,
  EntrenamientoTipo,
} from '../../../shared/types/modelos.generado';

/**
 * Los enums vienen del archivo generado a partir de los schemas de Mongoose, no escritos a
 * mano. Es exactamente la clase de tipo que se desincronizaba antes: agregar 'lesionado' a los
 * estados de asistencia y olvidarse de esta copia daría una pantalla que filtra y no encuentra
 * nada, sin ningún error.
 */
export type { AsistenciaEntrenamientoEstado, EntrenamientoEstado, EntrenamientoTipo };

export type ConteoAsistencia = {
  convocado: number;
  presente: number;
  tarde: number;
  ausente: number;
  justificado: number;
};

export type EntrenamientoResumen = {
  _id: string;
  equipo: string;
  fecha: string;
  duracionMinutos: number;
  lugar: string;
  tipo: EntrenamientoTipo;
  estado: EntrenamientoEstado;
  titulo: string;
  notas: string;
  asistencia: ConteoAsistencia;
};

export type FilaAsistencia = {
  _id: string;
  jugadorId: string;
  jugador: string;
  estado: AsistenciaEntrenamientoEstado;
  minutosTarde: number;
  notas: string;
};

export type EntrenamientoDetalle = Omit<EntrenamientoResumen, 'asistencia'> & {
  asistencias: FilaAsistencia[];
};

export type ResumenJugador = {
  jugadorId: string;
  jugador: string;
  presente: number;
  tarde: number;
  ausente: number;
  justificado: number;
  convocado: number;
  /** `null` cuando el jugador no tiene ningún entrenamiento computable todavía. */
  porcentaje: number | null;
};

const BASE = '/entrenamientos';

export const listarEntrenamientos = async (equipoId: string): Promise<EntrenamientoResumen[]> => {
  const resp = await authFetch<{ entrenamientos: EntrenamientoResumen[] }>(
    `${BASE}?equipo=${encodeURIComponent(equipoId)}`,
  );
  return resp.entrenamientos ?? [];
};

export const obtenerEntrenamiento = (id: string) =>
  authFetch<EntrenamientoDetalle>(`${BASE}/${id}`);

/** El backend puede crear el entrenamiento pero fallar al convocar: eso llega como `aviso`. */
export type EntrenamientoCreado = EntrenamientoResumen & { convocados: number; aviso: string | null };

export const crearEntrenamiento = (payload: {
  equipo: string;
  fecha: string;
  duracionMinutos?: number;
  lugar?: string;
  tipo?: EntrenamientoTipo;
  titulo?: string;
  notas?: string;
}) => authFetch<EntrenamientoCreado>(BASE, { method: 'POST', body: payload });

export const editarEntrenamiento = (
  id: string,
  cambios: Partial<{
    fecha: string;
    duracionMinutos: number;
    lugar: string;
    tipo: EntrenamientoTipo;
    titulo: string;
    notas: string;
    estado: EntrenamientoEstado;
  }>,
) => authFetch<EntrenamientoResumen>(`${BASE}/${id}`, { method: 'PUT', body: cambios });

export const eliminarEntrenamiento = (id: string) =>
  authFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });

/** Marca la asistencia en lote. Guardar asistencia es lo que pasa el entrenamiento a realizado. */
export const guardarAsistencias = (
  id: string,
  asistencias: Array<{
    jugadorId: string;
    estado: AsistenciaEntrenamientoEstado;
    minutosTarde?: number;
    notas?: string;
  }>,
) => authFetch<{ ok: boolean; actualizadas: number }>(`${BASE}/${id}/asistencias`, {
  method: 'PUT',
  body: { asistencias },
});

export const getResumenAsistencia = (equipoId: string) =>
  authFetch<{ totalEntrenamientos: number; jugadores: ResumenJugador[] }>(
    `${BASE}/resumen?equipo=${encodeURIComponent(equipoId)}`,
  );
