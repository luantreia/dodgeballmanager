import { authFetch } from '../utils/authFetch';

type SolicitudEdicionEstado = 'pendiente' | 'aceptado' | 'rechazado';

type SolicitudEdicion = {
  id: string;
  tipo: string;
  entidad?: string | null;
  datosPropuestos: Record<string, unknown>;
  estado: SolicitudEdicionEstado;
  creadoPor: string;
  fechaCreacion?: string;
};

type CrearSolicitudPayload = {
  tipo: string;
  entidad?: string;
  datosPropuestos: Record<string, unknown>;
};

export const crearSolicitudEdicion = (payload: CrearSolicitudPayload) =>
  authFetch<SolicitudEdicion>('/solicitudes-edicion', {
    method: 'POST',
    body: payload,
  });
