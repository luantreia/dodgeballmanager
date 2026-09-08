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
  toString?: () => string;
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
    /**
     * `en_creacion` | `en_curso` | `finalizada`, del schema de Temporada. Es lo que permite
     * mostrar primero los torneos que se están jugando. El backend no lo mandaba: el `populate`
     * de `/participacion-temporada` seleccionaba nombre y fechas pero no el estado.
     */
    estado?: string;
    fechaInicio?: string;
    fechaFin?: string;
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
  if (ref.id || ref._id) return ref.id || ref._id;

  // Mongoose ObjectId serialized through lean can arrive as object with only toString.
  if (typeof ref.toString === 'function') {
    const raw = ref.toString();
    if (raw && raw !== '[object Object]') return raw;
  }

  return undefined;
};

const toNombre = (ref?: BackendRef | string, fallback = 'Competencia'): string => {
  if (!ref) return fallback;
  if (typeof ref === 'string') return fallback;
  return ref.nombre || fallback;
};

type EstadoTemporada = NonNullable<EquipoCompetencia['temporada']>['estado'];

/**
 * Angosta el estado que viene del backend a la unión del schema. Un valor desconocido queda en
 * `undefined` en vez de colarse: si mañana Mongoose suma un estado, esta competencia ordena como
 * «sin declarar» en lugar de mentir que está en curso.
 */
const estadoTemporada = (estado?: string): EstadoTemporada =>
  estado === 'en_curso' || estado === 'en_creacion' || estado === 'finalizada' ? estado : undefined;

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
        temporada: item.temporada?._id
          ? {
              id: item.temporada._id,
              nombre: item.temporada.nombre || 'Temporada',
              estado: estadoTemporada(item.temporada.estado),
            }
          : undefined,
      });

      return acc;
    }, []);

  return ordenarPorVigencia([...normalizadasRelaciones, ...normalizadasTemporadas]);
};

/**
 * Primero lo que se está jugando.
 *
 * Un DT entra a Competencias para mirar el torneo en curso, no el del año pasado, y la lista
 * venía en orden de creación — así que con tres temporadas encima la vigente podía quedar
 * última. El orden es: en curso, después las que todavía no arrancaron, después las que no
 * declaran estado (la relación vieja `/equipos-competencia` no lo trae), y al final las
 * finalizadas.
 */
const PESO_TEMPORADA: Record<string, number> = {
  en_curso: 0,
  en_creacion: 1,
  finalizada: 3,
};

const ordenarPorVigencia = (items: EquipoCompetencia[]): EquipoCompetencia[] =>
  [...items].sort((a, b) => {
    const pa = a.temporada?.estado ? PESO_TEMPORADA[a.temporada.estado] ?? 2 : 2;
    const pb = b.temporada?.estado ? PESO_TEMPORADA[b.temporada.estado] ?? 2 : 2;
    if (pa !== pb) return pa - pb;
    // A igual vigencia, alfabético: es un orden estable y previsible entre recargas.
    return a.competencia.nombre.localeCompare(b.competencia.nombre, 'es');
  });

export const solicitarInscripcion = (payload: InscripcionPayload) =>
  authFetch<SolicitudCompetencia>('/equipos-competencia', {
    method: 'POST',
    body: payload,
  });
