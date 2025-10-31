import { authFetch } from '../../../utils/authFetch';
import type { SolicitudEdicion } from '../../../types';


type CrearSolicitudPayload = {
  tipo: string;
  entidad: string;
  datosPropuestos: Record<string, unknown>;
};

export const crearSolicitudEdicion = (payload: CrearSolicitudPayload) =>
  authFetch<SolicitudEdicion>('/solicitudes-edicion', {
    method: 'POST',
    body: payload,
  });
