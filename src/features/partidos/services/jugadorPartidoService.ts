import { authFetch } from '../../../utils/authFetch';

export type JugadorSimple = {
  _id?: string;
  nombre?: string;
  apellido?: string;
  alias?: string;
  name?: string;
  fullName?: string;
};

export type EquipoReferencia = string | { _id: string };

export interface JugadorPartidoResumen {
  _id: string;
  jugador: JugadorSimple | string;
  equipo: EquipoReferencia;
}

export type JugadorPartidoCreatePayload = {
  partido: string;
  jugador: string;
  equipo: string;
  creadoPor?: string;
};

export const crearJugadorPartido = (payload: JugadorPartidoCreatePayload) =>
  authFetch<JugadorPartidoResumen>('/jugador-partido', {
    method: 'POST',
    body: payload,
  });

export const eliminarJugadorPartido = (jugadorPartidoId: string) =>
  authFetch<void>(`/jugador-partido/${jugadorPartidoId}`, { method: 'DELETE' });

export const obtenerJugadoresDePartido = (partidoId: string) =>
  authFetch<JugadorPartidoResumen[]>(`/jugador-partido?partido=${partidoId}`);

export const actualizarEstadisticasEquipoPartido = (
  partidoId: string,
  equipoId: string,
  creadoPor: string = 'usuario',
) =>
  authFetch<void>(`/estadisticas/equipo-partido/actualizar`, {
    method: 'POST',
    body: {
      partidoId,
      equipoId,
      creadoPor,
    },
  });
