import { authFetch } from '../../../shared/utils/authFetch';
import type { Usuario } from '../../../shared/utils/types/types';

export const getUsuarioById = async (id: string): Promise<Usuario> => {
  const response = await authFetch<Usuario>(`/usuarios/${id}`);
  return response;
};
