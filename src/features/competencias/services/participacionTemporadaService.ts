import { authFetch } from '../../../shared/utils/authFetch';

export type TemporadaOpcion = {
  _id: string;
  nombre: string;
  fechaInicio?: string;
  fechaFin?: string;
  competencia?: string;
};

export async function opcionesTemporadasParaEquipo(equipoId: string, q?: string): Promise<TemporadaOpcion[]> {
  const params = new URLSearchParams();
  params.set('equipo', equipoId);
  if (q) params.set('q', q);
  return authFetch<TemporadaOpcion[]>(`/participacion-temporada/opciones?${params.toString()}`);
}

export async function crearSolicitudParticipacionTemporada(temporadaId: string, equipoId: string) {
  return authFetch<{ _id: string }>(`/solicitudes-edicion`, {
    method: 'POST',
    body: {
      tipo: 'contratoEquipoCompetencia',
      entidad: null,
      datosPropuestos: { temporada: temporadaId, equipo: equipoId },
    },
  });
}
