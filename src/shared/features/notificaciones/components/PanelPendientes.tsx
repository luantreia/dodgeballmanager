import { NotificacionesPanel } from './NotificacionesPanel';
import type { SolicitudEdicionTipo } from '../../solicitudes/types/solicitudesEdicion';

/**
 * Los tipos de solicitud que un DT puede aprobar.
 *
 * Vivían escritos dentro de la página de Notificaciones. Al llevar los pendientes también al
 * dashboard —que es donde de verdad se miran— la lista tenía que existir en un solo lado: dos
 * copias divergen y una de las dos pantallas empieza a esconder solicitudes sin que nadie note
 * por qué.
 */
const TIPOS_APROBABLES: SolicitudEdicionTipo[] = [
  'resultadoPartido',
  'editarPartidoCompetencia',
  'estadisticasJugadorSet',
  'estadisticas-set-propuesta',
  'estadisticas-partido-propuesta',
  'estadisticasJugadorPartido',
  'estadisticasEquipoPartido',
  'estadisticasEquipoSet',
  'jugador-equipo-crear',
  'jugador-equipo-editar',
  'jugador-equipo-eliminar',
  'participacion-temporada-crear',
];

type Props = {
  title?: string;
  description?: string;
};

/**
 * En el dashboard va sin título ni bajada: el encabezado de la sección que lo contiene ya dice
 * cuántas solicitudes esperan, y repetirlo sería decir dos veces lo mismo.
 */
const PanelPendientes = ({ title = '', description = '' }: Props) => (
  <NotificacionesPanel
    title={title}
    description={description}
    allowedTipos={TIPOS_APROBABLES}
    entityType="none"
    scope="aprobables"
    canApprove
    showCategoriaFilter
    showEntidadFilter={false}
  />
);

export default PanelPendientes;
