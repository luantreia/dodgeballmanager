import { authFetch } from '../../../utils/authFetch';
import type { EstadisticaEquipoResumen, EstadisticaJugador } from '../../../types';

type EstadisticasEquipoResponse = {
  resumen: EstadisticaEquipoResumen;
  jugadores: EstadisticaJugador[];
};

type EstadisticaHistorica = {
  fecha: string;
  resultado: 'W' | 'D' | 'L';
  puntosAnotados: number;
  puntosRecibidos: number;
};

export const getEstadisticasEquipo = (equipoId: string) =>
  authFetch<EstadisticasEquipoResponse>(`/estadisticas?equipo=${equipoId}`);

export const getHistorialResultados = (equipoId: string) =>
  authFetch<EstadisticaHistorica[]>(`/estadisticas/historial?equipo=${equipoId}`);

export interface EstadisticaJugadorSetResumen {
  _id: string;
  jugadorPartido?: {
    _id?: string;
    equipo?: {
      _id?: string;
      nombre?: string;
      escudo?: string;
    } | string;
  } | string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
}

export interface EstadisticaSetResumen {
  _id: string;
  numeroSet: number;
  estadoSet?: string;
  ganadorSet?: string;
  estadisticas?: EstadisticaJugadorSetResumen[];
}

export interface ResumenEstadisticasAutomaticas {
  sets?: EstadisticaSetResumen[];
}

export interface EstadisticaJugadorSetDetalle {
  _id: string;
  jugador?: {
    _id?: string;
    nombre?: string;
    apellido?: string;
  } | string;
  equipo?: {
    _id?: string;
    nombre?: string;
    escudo?: string;
  } | string;
  jugadorPartido?: {
    _id?: string;
  } | string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  tipoCaptura?: string;
}

export interface EstadisticaManualJugador {
  _id?: string;
  jugadorPartido?: {
    _id?: string;
    jugador?: {
      nombre?: string;
    };
    equipo?: {
      _id?: string;
      nombre?: string;
      escudo?: string;
    } | string;
  } | string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  tipoCaptura?: string;
}

export interface EstadisticaManualEquipo {
  _id?: string;
  nombre?: string;
  escudo?: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  jugadores?: number;
  efectividad?: number;
}

export type JugadorPartidoResumen = {
  _id: string;
  jugador: EstadisticaManualJugador['jugadorPartido'];
  equipo: string | { _id?: string };
};

export type EstadisticaJugadorPartidoPayload = Record<string, unknown> & {
  jugadorPartido: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  tipoCaptura?: string;
  fuente?: string;
  _id?: string;
};

export interface ResumenEstadisticasManual {
  jugadores?: EstadisticaManualJugador[];
  equipos?: EstadisticaManualEquipo[];
  mensaje?: string;
  tipo?: string;
}

export const getResumenEstadisticasAutomaticas = (partidoId: string) =>
  authFetch<ResumenEstadisticasAutomaticas>(`/estadisticas/jugador-set/resumen-partido/${partidoId}`);

export const getResumenEstadisticasManual = (partidoId: string) =>
  authFetch<ResumenEstadisticasManual>(`/estadisticas/jugador-partido-manual/resumen-partido/${partidoId}`);

export const getEstadisticasJugadorSet = (setId: string) =>
  authFetch<EstadisticaJugadorSetDetalle[]>(`/estadisticas/jugador-set?set=${setId}`);

export const getJugadoresPartido = (partidoId: string) =>
  authFetch<JugadorPartidoResumen[]>(`/jugador-partido?partido=${partidoId}`);

export const getEstadisticasJugadorPartidoManual = (partidoId: string) =>
  authFetch<EstadisticaManualJugador[]>(`/estadisticas/jugador-partido-manual?partido=${partidoId}`);

export const getEstadisticasJugadorPartido = (partidoId: string) =>
  authFetch<EstadisticaManualJugador[]>(`/estadisticas/jugador-partido?partido=${partidoId}`);

export const getResumenEstadisticasJugadorPartido = (partidoId: string) =>
  authFetch<{ jugadores?: EstadisticaManualJugador[] }>(
    `/estadisticas/jugador-partido/resumen-partido/${partidoId}`,
  );

export const getEstadisticasJugadorSetPorPartido = (partidoId: string) =>
  authFetch<EstadisticaManualJugador[]>(`/estadisticas/jugador-set?partido=${partidoId}`);

export const guardarEstadisticaJugadorPartido = (payload: EstadisticaJugadorPartidoPayload) =>
  authFetch('/estadisticas/jugador-partido', {
    method: 'POST',
    body: payload,
  });

export const actualizarEstadisticaJugadorPartido = (
  id: string,
  payload: EstadisticaJugadorPartidoPayload,
) =>
  authFetch(`/estadisticas/jugador-partido/${id}`, {
    method: 'PUT',
    body: payload,
  });

export const guardarEstadisticaManualJugadorPartido = (payload: EstadisticaJugadorPartidoPayload) =>
  authFetch('/estadisticas/jugador-partido-manual', {
    method: 'POST',
    body: payload,
  });

export const actualizarEstadisticaManualJugadorPartido = (
  id: string,
  payload: EstadisticaJugadorPartidoPayload,
) =>
  authFetch(`/estadisticas/jugador-partido-manual/${id}`, {
    method: 'PUT',
    body: payload,
  });

export const recalcularEstadisticasEquipoPartido = (partidoId: string, equipoId: string) =>
  authFetch('/estadisticas/equipo-partido/actualizar', {
    method: 'POST',
    body: {
      partidoId,
      equipoId,
      creadoPor: 'usuario',
    },
  });
