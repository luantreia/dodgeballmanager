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
