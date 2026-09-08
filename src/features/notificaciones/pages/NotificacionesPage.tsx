import PanelPendientes from '../../../shared/features/notificaciones/components/PanelPendientes';

/**
 * Los pendientes en pantalla completa.
 *
 * Ya no está en el menú: los pendientes aparecen arriba del dashboard, que es donde se miran. La
 * ruta sigue viva porque es a donde lleva la campanita y porque puede estar guardada en un
 * favorito.
 */
export default function NotificacionesPage() {
  return (
    <PanelPendientes
      title="Notificaciones"
      description="Gestiona las solicitudes de edición de partidos y estadísticas"
    />
  );
}
