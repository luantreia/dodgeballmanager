import { authFetch } from '../../../shared/utils/authFetch';
import type { Usuario } from '../../../shared/utils/types/types';

export const getUsuarioById = async (id: string): Promise<Usuario> => {
  const response = await authFetch<Usuario>(`/usuarios/${id}`);
  return response;
};

export const agregarAdminEquipo = async (equipoId: string, email: string) => {
  await authFetch(`/equipos/${equipoId}/administradores`, {
    method: 'POST',
    body: { email },
  });
};

export const quitarAdminEquipo = async (equipoId: string, adminId: string) => {
  await authFetch(`/equipos/${equipoId}/administradores/${adminId}`, {
    method: 'DELETE',
  });
};

export const getAdminsEquipo = async (equipoId: string): Promise<string[]> => {
  const response = await authFetch<string[]>(`/equipos/${equipoId}/administradores`);
  return response;
};
