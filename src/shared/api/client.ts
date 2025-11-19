// API client for DT (coach) panel
interface ApiConfig { baseUrl?: string; getToken?: () => string | null }
const defaultConfig: ApiConfig = { baseUrl: process.env.REACT_APP_API_BASE || '/api', getToken: () => localStorage.getItem('auth_token') };
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
async function request<T>(path: string, options: { method?: HttpMethod; body?: any; config?: ApiConfig } = {}): Promise<T> {
  const { method = 'GET', body, config = defaultConfig } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = config.getToken?.();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${config.baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { let message = `Error ${res.status}`; try { const err = await res.json(); message = err.message || message; } catch {} throw new Error(message); }
  return res.status === 204 ? (undefined as unknown as T) : res.json();
}
export interface Jugador { id: string; nombre: string; posicion?: string }
export interface Partido { id: string; localEquipoId: string; visitanteEquipoId: string; fecha: string; tipo: string; estado?: string }
export interface SolicitudEdicion { id: string; tipo: string; estado: string; entidad: string; entidadId: string }
export const api = {
  me: () => request<{ id: string; nombre: string; rol: string }>(`/auth/me`),
  misPartidos: (equipoId: string) => request<Partido[]>(`/partidos?equipoId=${equipoId}`),
  crearAmistoso: (payload: Partial<Partido>) => request<Partido>(`/partidos`, { method: 'POST', body: payload }),
  registrarStatsAmistoso: (partidoId: string, stats: any) => request<any>(`/partidos/${partidoId}/estadisticas`, { method: 'POST', body: stats }),
  jugadoresEquipo: (equipoId: string) => request<Jugador[]>(`/jugadores?equipoId=${equipoId}`),
  crearSolicitudEdicion: (payload: Partial<SolicitudEdicion>) => request<SolicitudEdicion>(`/solicitud-edicion`, { method: 'POST', body: payload }),
  listarSolicitudes: () => request<SolicitudEdicion[]>(`/solicitud-edicion?creadoPor=me`),
};
export default api;
