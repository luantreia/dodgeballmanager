import { authFetch } from '../../../shared/utils/authFetch';
import type { Equipo } from '../../../shared/utils/types/types';

export type UpdateEquipoPayload = {
  nombre?: string;
  logoUrl?: string;
  descripcion?: string;
};

export type TeamMemberRole =
  | 'jugador'
  | 'entrenador'
  | 'video_analista'
  | 'preparador_fisico'
  | 'community_manager'
  | 'sponsor_manager'
  | 'staff'
  | 'otro';

export type TeamPermission =
  | 'stats.capture'
  | 'stats.edit'
  | 'stats.view_private'
  | 'matches.manage'
  | 'lineup.manage'
  | 'members.manage'
  | 'team.settings.manage'
  | 'team.*';

export interface TeamMember {
  _id: string;
  equipo: string;
  usuarioId: string;
  rol: TeamMemberRole;
  permisos: TeamPermission[];
  estado: 'invitado' | 'activo' | 'suspendido' | 'inactivo';
  notas?: string;
  creadoPor: string;
  actualizadoPor?: string;
  createdAt: string;
  updatedAt: string;
}

export const TEAM_MEMBER_ROLE_OPTIONS: Array<{ value: TeamMemberRole; label: string }> = [
  { value: 'jugador', label: 'Jugador' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'video_analista', label: 'Video analista' },
  { value: 'preparador_fisico', label: 'Preparador fisico' },
  { value: 'community_manager', label: 'Community manager' },
  { value: 'sponsor_manager', label: 'Sponsor manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'otro', label: 'Otro' },
];

export const TEAM_PERMISSION_OPTIONS: Array<{ value: TeamPermission; label: string }> = [
  { value: 'stats.capture', label: 'Capturar estadisticas' },
  { value: 'stats.edit', label: 'Editar estadisticas' },
  { value: 'stats.view_private', label: 'Ver estadisticas privadas' },
  { value: 'matches.manage', label: 'Gestionar partidos' },
  { value: 'lineup.manage', label: 'Gestionar alineaciones' },
  { value: 'members.manage', label: 'Gestionar miembros' },
  { value: 'team.settings.manage', label: 'Gestionar configuracion de equipo' },
  { value: 'team.*', label: 'Permisos totales de equipo' },
];

export const TEAM_ROLE_PERMISSION_PRESETS: Record<TeamMemberRole, TeamPermission[]> = {
  jugador: ['stats.view_private'],
  entrenador: ['stats.capture', 'stats.edit', 'stats.view_private', 'lineup.manage'],
  video_analista: ['stats.capture', 'stats.edit', 'stats.view_private'],
  preparador_fisico: ['stats.view_private'],
  community_manager: [],
  sponsor_manager: [],
  staff: ['stats.capture'],
  otro: [],
};

export const getRolePresetPermissions = (rol: TeamMemberRole): TeamPermission[] => {
  return [...(TEAM_ROLE_PERMISSION_PRESETS[rol] || [])];
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
  const equipos = await authFetch<BackendEquipo[]>("/equipos/admin");
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

type UsuarioLookupResponse = {
  id: string;
  email: string;
  nombre: string;
};

export const buscarUsuarioPorEmail = async (email: string): Promise<UsuarioLookupResponse> => {
  const usuario = await authFetch<UsuarioLookupResponse>(`/usuarios?email=${encodeURIComponent(email)}`);
  return usuario;
};

export const listarMiembrosEquipo = async (equipoId: string): Promise<TeamMember[]> => {
  const resp = await authFetch<{ miembros: TeamMember[] }>(`/equipos/${equipoId}/miembros`);
  return resp.miembros || [];
};

export const crearMiembroEquipo = async (
  equipoId: string,
  payload: {
    usuarioId: string;
    rol: TeamMemberRole;
    permisos?: TeamPermission[];
    estado?: TeamMember['estado'];
    notas?: string;
  }
): Promise<TeamMember> => {
  return authFetch<TeamMember>(`/equipos/${equipoId}/miembros`, {
    method: 'POST',
    body: payload,
  });
};

export const actualizarMiembroEquipo = async (
  equipoId: string,
  usuarioId: string,
  payload: {
    rol?: TeamMemberRole;
    permisos?: TeamPermission[];
    estado?: TeamMember['estado'];
    notas?: string;
  }
): Promise<TeamMember> => {
  return authFetch<TeamMember>(`/equipos/${equipoId}/miembros/${usuarioId}`, {
    method: 'PUT',
    body: payload,
  });
};

export const eliminarMiembroEquipo = async (equipoId: string, usuarioId: string): Promise<void> => {
  await authFetch<{ message: string }>(`/equipos/${equipoId}/miembros/${usuarioId}`, {
    method: 'DELETE',
  });
};

export const getMisPermisosEquipo = async (equipoId: string): Promise<{
  equipoId: string;
  canCaptureStats: boolean;
  canEditStats: boolean;
}> => {
  return authFetch(`/equipos/${equipoId}/mis-permisos`);
};
