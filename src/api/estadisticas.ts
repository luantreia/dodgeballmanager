import { authFetch } from '../utils/authFetch';
import type { EstadisticaEquipoResumen, EstadisticaJugador } from '../types';

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
