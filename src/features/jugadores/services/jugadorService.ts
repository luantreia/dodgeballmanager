import { authFetch } from '../../../shared/utils/authFetch';

export type CrearJugadorPayload = {
  nombre: string;
  alias?: string;
  fechaNacimiento?: string;
  genero?: 'masculino' | 'femenino' | 'otro';
  nacionalidad?: string;
};

export type JugadorCreado = {
  _id: string;
  nombre: string;
  alias?: string;
  perfilReclamado: boolean;
};

/**
 * Crea un perfil de jugador para otra persona ("ghost player"): queda sin cuenta
 * asociada y reclamable, y el DT queda como administrador. Sin `ghostPlayer` el
 * backend intentaría vincular el perfil al propio usuario, que ya tiene el suyo.
 */
export const crearJugador = async (payload: CrearJugadorPayload): Promise<JugadorCreado> =>
  authFetch<JugadorCreado>('/jugadores', {
    method: 'POST',
    body: { ...payload, ghostPlayer: true },
  });

/**
 * Genera un token de invitación para que el jugador se registre y reclame su
 * perfil. Solo funciona sobre jugadores que administrás.
 */
export const generarInvitacion = async (
  jugadorId: string
): Promise<{ token: string; expiresAt: string }> =>
  authFetch<{ token: string; expiresAt: string }>(`/jugadores/${jugadorId}/invitaciones`, {
    method: 'POST',
  });

/**
 * El canje de la invitación vive en Overtime-Manager (`/claim/:token`), que es la app del
 * jugador. Antes apuntaba al portal público: el jugador creaba su cuenta ahí y quedaba parado
 * en la app de los hinchas, sin acceso a nada de lo suyo.
 *
 * Configurá REACT_APP_MANAGER_URL con el dominio de Manager en cada entorno. Public sigue
 * redirigiendo su ruta vieja, así que las invitaciones ya enviadas no se rompen.
 */
export const armarLinkInvitacion = (token: string): string => {
  const base = process.env.REACT_APP_MANAGER_URL || 'http://localhost:3002';
  return `${base.replace(/\/$/, '')}/claim/${token}`;
};
