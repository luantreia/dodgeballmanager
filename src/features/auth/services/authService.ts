import { authFetch } from '../../../utils/authFetch';
import type { RolUsuario, Usuario } from '../../../types';

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
  };
};

type BackendProfileResponse = {
  id?: string;
  nombre: string;
  email: string;
  rol: RolUsuario | string;
};

const mapUsuario = (usuario: BackendLoginResponse['user'] | BackendProfileResponse): Usuario => ({
  id: usuario.id ?? usuario.email,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: (usuario.rol as RolUsuario) ?? 'lector',
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

export const getProfile = async (): Promise<Usuario> => {
  const profile = await authFetch<BackendProfileResponse>('/usuarios/mi-perfil');
  return mapUsuario(profile);
};
