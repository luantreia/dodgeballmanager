export { default as SolicitudEditModalSimple } from './SolicitudEditModalSimple';

// SolicitudModal y SolicitudNotification vivían acá duplicados byte a byte (salvo las rutas de
// import) contra los de `shared/components/`. Sólo se renderizaban los de allá; estas copias
// entraban al bundle sin usarse y eran el lugar perfecto para que un arreglo se aplicara a una
// sola de las dos. Quedó una sola versión, reexportada desde el barrel del feature.
export { SolicitudModal, default as SolicitudModalDefault } from '../../../components/SolicitudModal/SolicitudModal';
export {
  SolicitudNotification,
  default as SolicitudNotificationDefault,
} from '../../../components/SolicitudNotification/SolicitudNotification';
