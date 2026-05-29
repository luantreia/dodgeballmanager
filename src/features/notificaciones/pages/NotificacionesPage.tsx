import React from 'react';
import { NotificacionesPanel } from '../../../shared/features/notificaciones/components/NotificacionesPanel';

export default function NotificacionesPage() {
  return (
    <NotificacionesPanel
      title="Notificaciones"
      description="Gestiona las solicitudes de edición de partidos y estadísticas"
      allowedTipos={[
        'resultadoPartido',
        'editarPartidoCompetencia',
        'estadisticasJugadorSet',
        'estadisticasJugadorPartido',
        'estadisticasEquipoPartido',
        'estadisticasEquipoSet',
        'jugador-equipo-crear',
        'jugador-equipo-editar',
        'jugador-equipo-eliminar',
      ]}
      entityType="none"
      scope="aprobables"
      canApprove={true}
      showCategoriaFilter={true}
      showEntidadFilter={false}
    />
  );
}
