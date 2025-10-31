import { authFetch } from '../../../utils/authFetch';
import type { Equipo } from '../../../types';

export type UpdateEquipoPayload = {
  nombre?: string;
  logoUrl?: string;
  descripcion?: string;
};

type BackendEquipo = {
  _id: string;
  nombre: string;
  escudo?: string;
  descripcion?: string;
  administradores?: string[];
};

const mapEquipo = (equipo: BackendEquipo): Equipo => ({
  id: equipo._id,
  nombre: equipo.nombre,
  logoUrl: equipo.escudo,
  descripcion: equipo.descripcion,
  staff: equipo.administradores?.map((admin) => {
    if (typeof admin === 'string') {
      return admin;
    }
    const adminObj = admin as unknown as { _id?: string; email?: string; nombre?: string };
    return adminObj.nombre ?? adminObj.email ?? adminObj._id ?? 'Administrador';
  }),
});

export const getEquiposDelUsuario = async (): Promise<Equipo[]> => {
  const equipos = await authFetch<BackendEquipo[]>('/equipos');
  return equipos.map(mapEquipo);
};

export const getEquipo = async (equipoId: string): Promise<Equipo> => {
  const equipo = await authFetch<BackendEquipo>(`/equipos/${equipoId}`);
  return mapEquipo(equipo);
};

export const buscarEquipos = async (query: string): Promise<Array<{ id: string; nombre: string; logoUrl?: string }>> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);

  const equipos = await authFetch<Array<{ _id: string; nombre: string; escudo?: string }>>(
    `/equipos?${params.toString()}`
  );

  return equipos.map((item) => ({ id: item._id, nombre: item.nombre, logoUrl: item.escudo }));
};

export interface EquipoOpcion {
  id: string;
  nombre: string;
  escudo?: string;
  tipo?: string;
  pais?: string;
}

export const obtenerOpcionesEquipos = async (query: string, excluirId?: string): Promise<EquipoOpcion[]> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (excluirId) params.set('excluir', excluirId);

  const data = await authFetch<Array<{ _id: string; nombre: string; escudo?: string; tipo?: string; pais?: string }>>(
    `/equipos?${params.toString()}`
  );

  return data.map((item) => ({
    id: item._id,
    nombre: item.nombre,
    escudo: item.escudo,
    tipo: item.tipo,
    pais: item.pais,
  }));
};

export const actualizarEquipo = async (
  equipoId: string,
  payload: UpdateEquipoPayload
): Promise<Equipo> => {
  const body: Record<string, unknown> = {
    nombre: payload.nombre,
    descripcion: payload.descripcion,
  };

  if (payload.logoUrl !== undefined) {
    body.escudo = payload.logoUrl;
  }

  const equipo = await authFetch<BackendEquipo>(`/equipos/${equipoId}`, {
    method: 'PUT',
    body,
  });

  return mapEquipo(equipo);
};
