import { authFetch } from '../../../shared/utils/authFetch';
import type { EquipoCompetencia, SolicitudCompetencia } from '../../../shared/utils/types/types';

type EquipoCompetenciaQuery = {
  equipoId: string;
};

type InscripcionPayload = {
  equipoId: string;
  competenciaId: string;
  mensaje?: string;
};

export const getParticipaciones = ({ equipoId }: EquipoCompetenciaQuery) =>
  authFetch<EquipoCompetencia[]>(`/equipos-competencia?equipo=${equipoId}`);

export const solicitarInscripcion = (payload: InscripcionPayload) =>
  authFetch<SolicitudCompetencia>('/equipos-competencia', {
    method: 'POST',
    body: payload,
  });
