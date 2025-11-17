import { authFetch } from '../../../shared/utils/authFetch';

export interface JugadorOpcion {
  id: string;
  nombre: string;
  alias?: string;
  foto?: string;
  nacionalidad?: string;
}

export const buscarJugadoresDisponibles = async (equipoId: string, query: string): Promise<JugadorOpcion[]> => {
  const params = new URLSearchParams({ equipo: equipoId });
  if (query) params.set('q', query);

  const data = await authFetch<Array<{ _id: string; nombre?: string; alias?: string; foto?: string; nacionalidad?: string }>>(
    `/jugador-equipo/opciones?${params.toString()}`
  );

  return data.map((item) => ({
    id: item._id,
    nombre: item.nombre ?? item.alias ?? 'Jugador',
    alias: item.alias,
    foto: item.foto,
    nacionalidad: item.nacionalidad,
  }));
};
