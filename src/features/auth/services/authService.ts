import { authFetch } from '../../../shared/utils/authFetch';
import type { RolUsuario, Usuario } from '../../../shared/utils/types/types';

type LoginPayload = {
  email: string;
  password: string;
};

type BackendLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: RolUsuario | string;
    emailVerificado?: boolean;
  };
};

type BackendProfileResponse = {
  id?: string;
  nombre: string;
  email: string;
  rol: RolUsuario | string;
  emailVerificado?: boolean;
};

const mapUsuario = (usuario: BackendLoginResponse['user'] | BackendProfileResponse): Usuario => ({
  id: usuario.id ?? usuario.email,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: (usuario.rol as RolUsuario) ?? 'lector',
  emailVerificado: Boolean(usuario.emailVerificado),
});

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: Usuario;
};

export const login = async (payload: LoginPayload): Promise<LoginResult> => {
  const response = await authFetch<BackendLoginResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    useAuth: false,
  });

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: mapUsuario(response.user),
  };
};

export type RegisterPayload = {
  nombre: string;
  email: string;
  password: string;
};

export const register = async (payload: RegisterPayload): Promise<LoginResult> => {
  const response = await authFetch<BackendLoginResponse>('/auth/registro', {
    method: 'POST',
    body: payload,
    useAuth: false,
  });

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: mapUsuario(response.user),
  };
};

/**
 * Pide el link de recuperación. El backend responde siempre lo mismo exista o no
 * el email, así que no sirve para averiguar qué cuentas están registradas.
 */
export const solicitarResetPassword = async (email: string): Promise<{ message: string }> =>
  authFetch<{ message: string }>('/auth/olvide-password', {
    method: 'POST',
    body: { email },
    useAuth: false,
  });

export const resetPassword = async (token: string, password: string): Promise<{ message: string }> =>
  authFetch<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
    useAuth: false,
  });

export const verificarEmail = async (token: string): Promise<{ message: string }> =>
  authFetch<{ message: string }>('/auth/verificar-email', {
    method: 'POST',
    body: { token },
    useAuth: false,
  });

export const reenviarVerificacion = async (): Promise<{ message: string; delivered: boolean }> =>
  authFetch<{ message: string; delivered: boolean }>('/auth/verificar-email/reenviar', {
    method: 'POST',
  });

export const getProfile = async (): Promise<Usuario> => {
  const profile = await authFetch<BackendProfileResponse>('/usuarios/mi-perfil');
  return mapUsuario(profile);
};
