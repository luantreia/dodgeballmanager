import { authFetch } from '../../../utils/authFetch';
import type { Equipo } from '../../../types';

export type UpdateEquipoPayload = {
  nombre?: string;
  logoUrl?: string;
  descripcion?: string;
};

export type BackendEquipo = {
  _id: string;
  nombre: string;
  escudo?: string;
  descripcion?: string;
  administradores?: string[];
  creadoPor?: string;
};

export interface EquipoOpcion {
 id: string;
 nombre: string;
 escudo?: string;
 tipo?: string;
 pais?: string;
}
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
  const equipos = await authFetch<BackendEquipo>("/equipos/admin").catch(async () => {
    // fallback a todos si el endpoint no existe
    const all = await authFetch<BackendEquipo[]>("/equipos");
    return all as unknown as BackendEquipo;
  });
  const list = Array.isArray(equipos) ? equipos : [equipos];
  return list.map(mapEquipo);
};

export const getEquipo = async (equipoId: string): Promise<Equipo> => {
  const equipo = await authFetch<BackendEquipo>(`/equipos/${equipoId}`);
  return mapEquipo(equipo);
};

export interface JugadorOpcion {
  id: string;
  nombre: string;
  alias?: string;
  foto?: string;
  nacionalidad?: string;
}

export const obtenerOpcionesEquipos = async (query: string, excluirId?: string): Promise<EquipoOpcion[]> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (excluirId) params.set('excluir', excluirId);

  const data = await authFetch<Array<{ _id: string; nombre: string; escudo?: string; tipo?: string; pais?: string }>>(
    `/equipos?${params.toString()}`
  );
  return data.map((item) => ({ id: item._id, nombre: item.nombre, escudo: item.escudo, tipo: item.tipo, pais: item.pais }));
};

// Nota: flujo de jugador removido en esta app; opciones para jugador no se exponen aquí.

export const obtenerOpcionesJugadoresParaEquipo = async (
  equipoId: string,
  query?: string
): Promise<JugadorOpcion[]> => {
  const params = new URLSearchParams();
  params.set('equipo', equipoId);
  if (query) params.set('q', query);

  const data = await authFetch<Array<{ _id: string; nombre: string; alias?: string; foto?: string; nacionalidad?: string }>>(
    `/jugador-equipo/opciones?${params.toString()}`
  );

  return data.map((item) => ({
    id: item._id,
    nombre: item.nombre,
    alias: item.alias,
    foto: item.foto,
    nacionalidad: item.nacionalidad,
  }));
};

export const getEquipoAdministradoresIds = async (equipoId: string): Promise<string[]> => {
  const eq = await authFetch<BackendEquipo>(`/equipos/${equipoId}`);
  const ids = new Set<string>();
  if (eq.creadoPor) ids.add(String(eq.creadoPor));
  (eq.administradores || []).forEach((id) => ids.add(String(id)));
  return Array.from(ids);
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
