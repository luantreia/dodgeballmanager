import { authFetch } from '../../../utils/authFetch';
import type { Usuario } from '../../../types';

type UpdateUsuarioPayload = Partial<Pick<Usuario, 'nombre' | 'email'>>;

type UpdatePasswordPayload = {
  passwordActual: string;
  passwordNueva: string;
};

export const actualizarUsuario = (payload: UpdateUsuarioPayload) =>
  authFetch<Usuario>('/usuario', {
    method: 'PUT',
    body: payload,
  });

export const cambiarPassword = (payload: UpdatePasswordPayload) =>
  authFetch<void>('/usuario/password', {
    method: 'PATCH',
    body: payload,
  });
