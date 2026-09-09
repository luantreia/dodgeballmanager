/**
 * Puente al kit. La implementación vive en `overtime-kit` y este archivo existe sólo para que
 * las pantallas que ya importaban desde acá no tengan que cambiar el import.
 *
 * Esta app fue el origen de buena parte de lo que el kit implementa —el apilado con Escape
 * sólo en la capa de arriba y el scroll liberado recién al cerrar la última, que cubre
 * `Modal.test.tsx`— así que el comportamiento no cambia; sólo deja de estar duplicado.
 */
export { Modal as default } from 'overtime-kit';
export type { ModalProps, ModalSize } from 'overtime-kit';
