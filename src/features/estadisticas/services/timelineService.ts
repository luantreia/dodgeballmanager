import { authFetch } from '../../../shared/utils/authFetch';
import type { EstadoPartido } from '../../../shared/utils/types/types';

/** Estado de la planilla propia del equipo. Espeja el enum de PlanillaEquipo en Mongoose. */
export type PlanillaEstado = 'borrador' | 'pendiente_oficializacion' | 'oficializada' | 'rechazada';

/**
 * Qué fuente alimenta el análisis del equipo para un partido.
 *
 * `fuentePreferida` es la elección del equipo y sólo desempata cuando existen las dos fuentes.
 * `fuenteEfectiva` es la que realmente se usa una vez resuelto ese desempate contra lo que hay:
 * preferir lo oficial no puede dejar sin datos a un partido que sólo tiene planilla.
 */
export type FuenteDatos = 'oficial' | 'planilla';
export type FuenteEfectiva = FuenteDatos | 'sin_datos';

export type DatosPartido = {
  oficial: {
    existe: boolean;
    /** Cargadas set a set. */
    porSets: boolean;
    /** Cargadas como totales del partido, sin desglose. */
    directa: boolean;
    /**
     * Al menos una fila ya aprobada (`estadoPublicacion` 'organizacion' o 'publica'). Las
     * 'privada' y 'pendiente_aprobacion' existen pero nadie las validó todavía: esa es la
     * diferencia entre "tiene datos" y "está verificado".
     */
    verificada: boolean;
  };
  planilla: {
    _id: string;
    estado: PlanillaEstado;
    modo: 'sets' | 'directa';
    fuentePreferida: FuenteDatos;
  } | null;
  fuenteEfectiva: FuenteEfectiva;
};

/** Un equipo, para listas de elección (selector de perspectiva, rival de un partido, etc). */
export type EquipoResumen = { _id: string; nombre: string; escudo: string | null };

export type PartidoTimeline = {
  _id: string;
  /** ISO completo del backend. Convertir a hora local para mostrar; nunca partirlo por la 'T'. */
  fecha: string;
  estado: EstadoPartido;
  modalidad: string;
  categoria: string;
  ubicacion: string | null;
  jornada: string | null;
  etapa: string | null;
  nombrePartido: string | null;
  esLocal: boolean;
  marcadorEquipo: number;
  marcadorRival: number;
  rival: EquipoResumen | null;
  competencia: {
    _id: string;
    nombre: string;
    modalidad: string;
    categoria: string;
    organizacion: { _id: string; nombre: string } | null;
  } | null;
  temporada: { _id: string; nombre: string } | null;
  fase: { _id: string; nombre: string } | null;
  datos: DatosPartido;
};

export type TimelineEquipo = {
  partidos: PartidoTimeline[];
  /**
   * Equipos sobre los que `equipoId` tiene algún dato propio: él mismo, sus rivales de
   * partidos jugados, y ambos lados de lo que haya scouteado sin jugar. Alimenta el selector
   * de perspectiva.
   */
  equiposDisponibles: EquipoResumen[];
};

/**
 * Todos los partidos del equipo (o, con `perspectiva`, los de otro equipo dentro de lo que
 * `equipoId` tiene capturado), anotados con lo necesario para filtrarlos y para saber qué
 * datos tiene cada uno. Se pide una sola vez y el filtrado facetado ocurre en el navegador:
 * un equipo juega decenas de partidos por temporada y así las facetas cascadean al instante,
 * sin un ida y vuelta al backend por cada clic.
 */
export const getTimelineEquipo = async (
  equipoId: string,
  opciones?: { desde?: string; hasta?: string; perspectiva?: string },
): Promise<TimelineEquipo> => {
  const params = new URLSearchParams({ equipo: equipoId });
  if (opciones?.desde) params.set('desde', opciones.desde);
  if (opciones?.hasta) params.set('hasta', opciones.hasta);
  if (opciones?.perspectiva) params.set('perspectiva', opciones.perspectiva);
  const resp = await authFetch<Partial<TimelineEquipo>>(
    `/partidos/timeline?${params.toString()}`,
  );
  return { partidos: resp.partidos ?? [], equiposDisponibles: resp.equiposDisponibles ?? [] };
};

/** Cambia qué fuente alimenta el análisis del equipo para el partido de esa planilla. */
export const setFuentePreferida = (planillaId: string, fuentePreferida: FuenteDatos) =>
  authFetch<{ _id: string; fuentePreferida: FuenteDatos }>(
    `/planillas-equipo/${planillaId}/fuente-preferida`,
    { method: 'PUT', body: { fuentePreferida } },
  );
