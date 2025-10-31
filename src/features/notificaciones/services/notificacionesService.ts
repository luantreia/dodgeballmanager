import { authFetch } from '../../../utils/authFetch';
import type { Notificacion } from '../../../types';

export const getNotificaciones = () => authFetch<Notificacion[]>('/notificaciones');

export const marcarNotificacionLeida = (notificacionId: string) =>
  authFetch<Notificacion>(`/notificaciones/${notificacionId}/leer`, {
    method: 'PATCH',
    body: { leida: true },
  });
