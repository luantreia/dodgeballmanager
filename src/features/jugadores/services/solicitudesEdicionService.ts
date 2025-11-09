import { authFetch } from '../../../utils/authFetch';
import type { SolicitudEdicion } from '../../../types';


type CrearSolicitudPayload = {
  tipo: string;
  entidad: string | null;
  datosPropuestos: Record<string, unknown>;
};

type BackendSolicitudEdicion = {
  _id: string;
  tipo: string;
  entidad?: string | null;
  datosPropuestos: Record<string, unknown>;
  estado: string;
  creadoPor: string;
  createdAt?: string;
  fechaCreacion?: string;
};

const mapSolicitud = (s: BackendSolicitudEdicion): SolicitudEdicion => ({
  id: s._id,
  tipo: s.tipo,
  entidad: s.entidad ?? null,
  datosPropuestos: s.datosPropuestos || {},
  estado: s.estado as any,
  creadoPor: String(s.creadoPor),
  fechaCreacion: s.fechaCreacion || s.createdAt,
});

export const crearSolicitudEdicion = async (payload: CrearSolicitudPayload) => {
  const s = await authFetch<BackendSolicitudEdicion>('/solicitudes-edicion', {
    method: 'POST',
    body: payload,
  });
  return mapSolicitud(s);
};

export const obtenerSolicitudesEdicion = async (filtros?: { tipo?: string; estado?: string; creadoPor?: string }) => {
  const params = new URLSearchParams();
  if (filtros?.tipo) params.set('tipo', filtros.tipo);
  if (filtros?.estado) params.set('estado', filtros.estado);
  if (filtros?.creadoPor) params.set('creadoPor', filtros.creadoPor);

  const data = await authFetch<BackendSolicitudEdicion[]>(`/solicitudes-edicion?${params.toString()}`);
  return data.map(mapSolicitud);
};

export const actualizarSolicitudEdicion = async (id: string, payload: { estado: string; motivoRechazo?: string }) => {
  const s = await authFetch<BackendSolicitudEdicion>(`/solicitudes-edicion/${id}`, {
    method: 'PUT',
    body: payload,
  });
  return mapSolicitud(s);
};

export const cancelarSolicitudEdicion = (id: string) =>
  authFetch<{ message: string }>(`/solicitudes-edicion/${id}`, {
    method: 'DELETE',
  });
