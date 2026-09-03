import { authFetch } from '../../../shared/utils/authFetch';

/**
 * Un bucket de rating. El sistema no guarda un número por jugador: guarda uno por combinación
 * de competencia, temporada, modalidad y categoría, más el global (todos los ids en null).
 * Un mismo jugador puede ser 1650 en foam masculino y 1480 en cloth mixto, y mezclarlos sería
 * inventar un número que no significa nada.
 */
export type BucketRating = {
  competenciaId: string | null;
  temporadaId: string | null;
  modalidad: string | null;
  categoria: string | null;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  /** Cuánto cambió en el último partido. Es lo que convierte un número en una tendencia. */
  lastDelta: number;
};

export type JugadorConRating = {
  _id: string;
  nombre: string;
  foto: string | null;
  ratings: BucketRating[];
};

/** El rating de todo el plantel en una consulta, en vez de una por jugador. */
export const getRatingsEquipo = async (equipoId: string): Promise<JugadorConRating[]> => {
  const resp = await authFetch<{ ok: boolean; jugadores: JugadorConRating[] }>(
    `/ranked/equipos/${equipoId}/ratings`,
  );
  return resp.jugadores ?? [];
};

/**
 * El rating global de un jugador: el bucket sin competencia ni temporada ni modalidad.
 *
 * Es el único comparable entre jugadores que no compartieron competencia, y por eso es el que
 * se muestra en la lista. Si no existe, el jugador todavía no jugó ningún partido ranked —
 * distinto de tener 1500, que es el valor inicial de alguien que sí jugó y quedó parejo.
 */
export const ratingGlobal = (jugador: JugadorConRating): BucketRating | null =>
  jugador.ratings.find(
    (r) => !r.competenciaId && !r.temporadaId && !r.modalidad && !r.categoria,
  ) ?? null;
