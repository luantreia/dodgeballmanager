import { authFetch } from '../../../utils/authFetch';
import type { Usuario } from '../../../types';

export const getUsuarioById = async (id: string): Promise<Usuario> => {
  const response = await authFetch<Usuario>(`/usuarios/${id}`);
  return response;
};
