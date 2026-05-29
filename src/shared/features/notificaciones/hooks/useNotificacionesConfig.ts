import type { SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';
import type { UseNotificacionesConfigResult } from '../types/notificacionesTypes';

const TIPO_CATEGORIAS: Record<string, string> = {
  // Resultados de partidos (dt)
  'resultadoPartido': 'Partidos',
  'editarPartidoCompetencia': 'Partidos',
  
  // Estadísticas
  'estadisticasJugadorSet': 'Estadísticas',
  'estadisticasJugadorPartido': 'Estadísticas',
  'estadisticasEquipoPartido': 'Estadísticas',
  'estadisticasEquipoSet': 'Estadísticas',
  
  // Equipos
  'jugador-equipo-crear': 'Equipos',
  'jugador-equipo-editar': 'Equipos',
  'jugador-equipo-eliminar': 'Equipos',
};

const TIPO_LABELS: Record<string, string> = {
  // Resultados de partidos (dt)
  'resultadoPartido': 'Resultado Partido',
  'editarPartidoCompetencia': 'Editar Partido',
  
  // Estadísticas
  'estadisticasJugadorSet': 'Estadísticas Set Jugador',
  'estadisticasJugadorPartido': 'Estadísticas Partido Jugador',
  'estadisticasEquipoPartido': 'Estadísticas Partido Equipo',
  'estadisticasEquipoSet': 'Estadísticas Set Equipo',
  
  // Equipos
  'jugador-equipo-crear': 'Agregar Jugador a Equipo',
  'jugador-equipo-editar': 'Editar Jugador de Equipo',
  'jugador-equipo-eliminar': 'Eliminar Jugador de Equipo',
};

/**
 * Hook de configuración para NotificacionesPanel en dodgeballmanager (dt)
 * Tipos: resultadoPartido, estadisticas-*, jugador-equipo-*
 */
export const useNotificacionesConfig = (): UseNotificacionesConfigResult => {
  const allowedTipos: readonly SolicitudEdicionTipo[] = [
    'resultadoPartido',
    'editarPartidoCompetencia',
    'estadisticasJugadorSet',
    'estadisticasJugadorPartido',
    'estadisticasEquipoPartido',
    'estadisticasEquipoSet',
    'jugador-equipo-crear',
    'jugador-equipo-editar',
    'jugador-equipo-eliminar',
  ];

  const categoriaDeTipo = (tipo: SolicitudEdicionTipo): string => {
    return TIPO_CATEGORIAS[tipo] || 'Otros';
  };

  const labelTipo = (tipo: SolicitudEdicionTipo): string => {
    return TIPO_LABELS[tipo] || tipo;
  };

  const categoriasDisponibles = ['Partidos', 'Estadísticas', 'Equipos', 'Otros'];

  return {
    allowedTipos,
    categoriaDeTipo,
    labelTipo,
    categoriasDisponibles,
    canApprove: true,
  };
};
