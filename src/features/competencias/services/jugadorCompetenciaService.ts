import { authFetch } from '../../../shared/utils/authFetch';

type JugadorRef = { _id?: string; id?: string; nombre?: string; apellido?: string; foto?: string };

type BackendJugadorCompetencia = {
  _id?: string;
  estado?: 'aceptado' | 'suspendido';
  jugador?: JugadorRef | string;
};

export type HabilitacionJugador = {
  jugadorId: string;
  estado: 'aceptado' | 'suspendido';
};

/**
 * Quiénes están habilitados en una competencia.
 *
 * El endpoint devuelve a TODOS los jugadores de la competencia, de todos los equipos: no hay
 * filtro por equipo del lado del backend. El cruce con el plantel propio se hace en el cliente,
 * y es justamente lo que interesa mirar — no «quiénes juegan la liga» sino «quiénes de los míos
 * están en regla y quiénes no».
 */
export const getHabilitacionesCompetencia = async (
  competenciaId: string,
): Promise<Map<string, HabilitacionJugador>> => {
  const items = await authFetch<BackendJugadorCompetencia[]>(
    `/jugador-competencia?competencia=${competenciaId}`,
  );

  const mapa = new Map<string, HabilitacionJugador>();
  (items ?? []).forEach((item) => {
    const jugador = item.jugador;
    const id = typeof jugador === 'string' ? jugador : jugador?._id ?? jugador?.id;
    if (!id) return;
    mapa.set(String(id), { jugadorId: String(id), estado: item.estado ?? 'aceptado' });
  });

  return mapa;
};
