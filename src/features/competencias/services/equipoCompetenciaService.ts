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

type BackendRef = {
  _id?: string;
  id?: string;
  nombre?: string;
};

type BackendEquipoCompetencia = {
  _id?: string;
  id?: string;
  estado?: string;
  equipo?: BackendRef | string;
  competencia?: BackendRef | string;
  fixtureUrl?: string;
};

type BackendParticipacionTemporada = {
  _id?: string;
  estado?: string;
  equipo?: BackendRef | string;
  temporada?: {
    _id?: string;
    nombre?: string;
    competencia?: BackendRef | string;
  };
};

type BackendCompetenciaCatalogo = {
  _id: string;
  nombre?: string;
};

const toId = (ref?: BackendRef | string): string | undefined => {
  if (!ref) return undefined;
  if (typeof ref === 'string') return ref;
  return ref.id || ref._id;
};

const toNombre = (ref?: BackendRef | string, fallback = 'Competencia'): string => {
  if (!ref) return fallback;
  if (typeof ref === 'string') return fallback;
  return ref.nombre || fallback;
};

const mapEstado = (estado?: string): EquipoCompetencia['estado'] => {
  if (estado === 'aceptado' || estado === 'pendiente' || estado === 'rechazado') return estado;
  if (estado === 'activo') return 'aceptado';
  return 'pendiente';
};

export const getParticipaciones = async ({ equipoId }: EquipoCompetenciaQuery): Promise<EquipoCompetencia[]> => {
  const [relacionesResp, participacionesResp, competenciasResp] = await Promise.all([
    authFetch<BackendEquipoCompetencia[]>(`/equipos-competencia?equipo=${equipoId}`).catch(() => [] as BackendEquipoCompetencia[]),
    authFetch<BackendParticipacionTemporada[]>(`/participacion-temporada?equipo=${equipoId}`).catch(() => [] as BackendParticipacionTemporada[]),
    authFetch<BackendCompetenciaCatalogo[]>(`/competencias`).catch(() => [] as BackendCompetenciaCatalogo[]),
  ]);

  const relaciones: BackendEquipoCompetencia[] = Array.isArray(relacionesResp) ? relacionesResp : [];
  const participacionesTemporada: BackendParticipacionTemporada[] = Array.isArray(participacionesResp) ? participacionesResp : [];
  const competenciasCatalogo: BackendCompetenciaCatalogo[] = Array.isArray(competenciasResp) ? competenciasResp : [];

  const nombreCompetenciaPorId = new Map<string, string>();
  competenciasCatalogo.forEach((c) => {
    if (c?._id) nombreCompetenciaPorId.set(c._id, c.nombre || 'Competencia');
  });

  const normalizadasRelaciones: EquipoCompetencia[] = relaciones.reduce<EquipoCompetencia[]>((acc, item, index) => {
      const competenciaId = toId(item.competencia);
      const equipoRef = item.equipo;
      const equipoIdLocal = toId(equipoRef) || equipoId;
      if (!competenciaId) return acc;

      acc.push({
        id: item.id || item._id || `${competenciaId}-${index}`,
        estado: mapEstado(item.estado),
        fixtureUrl: item.fixtureUrl,
        equipo: {
          id: equipoIdLocal,
          nombre: typeof equipoRef === 'string' ? 'Equipo' : equipoRef?.nombre || 'Equipo',
        },
        competencia: {
          id: competenciaId,
          nombre: toNombre(item.competencia, nombreCompetenciaPorId.get(competenciaId) || 'Competencia'),
          estado: 'activa',
        },
      });

      return acc;
    }, []);

  const existentes = new Set(normalizadasRelaciones.map((item) => `${item.competencia.id}:${item.estado}`));

  const normalizadasTemporadas: EquipoCompetencia[] = participacionesTemporada.reduce<EquipoCompetencia[]>((acc, item, index) => {
      const compRef = item.temporada?.competencia;
      const competenciaId = toId(compRef);
      if (!competenciaId) return acc;

      const competenciaNombre =
        toNombre(compRef, nombreCompetenciaPorId.get(competenciaId) || 'Competencia');
      const estado = mapEstado(item.estado);
      const firma = `${competenciaId}:${estado}`;
      if (existentes.has(firma)) return acc;

      acc.push({
        id: item._id || `pt-${competenciaId}-${index}`,
        estado,
        equipo: {
          id: toId(item.equipo) || equipoId,
          nombre: typeof item.equipo === 'string' ? 'Equipo' : item.equipo?.nombre || 'Equipo',
        },
        competencia: {
          id: competenciaId,
          nombre: competenciaNombre,
          estado: 'activa',
        },
      });

      return acc;
    }, []);

  return [...normalizadasRelaciones, ...normalizadasTemporadas];
};

export const solicitarInscripcion = (payload: InscripcionPayload) =>
  authFetch<SolicitudCompetencia>('/equipos-competencia', {
    method: 'POST',
    body: payload,
  });
