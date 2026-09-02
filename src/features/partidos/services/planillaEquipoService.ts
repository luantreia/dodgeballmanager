import { authFetch } from '../../../shared/utils/authFetch';

/**
 * Planilla de equipo: la captura propia del equipo sobre un partido que jugó.
 *
 * Vive en paralelo al registro oficial de la competencia y no lo modifica. Sirve para
 * reconstruir y analizar partidos aunque la organización nunca haya cargado sets,
 * presentes ni estadísticas — incluso si el partido ya está finalizado.
 *
 * Los tipos espejan los schemas de Mongoose en overtime/src/models/Equipo/Planilla*.js.
 * La verdad vive ahí: si agregás un estado o un modo, agregalo primero en Mongoose.
 * A propósito sin `[key: string]: any` — es lo que hace que las copias de tipos de las
 * otras apps diverjan sin que el compilador diga nada.
 */

export type PlanillaModo = 'sets' | 'directa';

export type PlanillaEstado =
  | 'borrador'
  | 'pendiente_oficializacion'
  | 'oficializada'
  | 'rechazada';

export type PlanillaVisibilidad = 'organizacion' | 'publica';

export interface PlanillaJugadorRef {
  _id: string;
  nombre?: string;
  apellido?: string;
  alias?: string;
  foto?: string;
}

export interface PlanillaPresente {
  _id: string;
  planilla: string;
  jugador: PlanillaJugadorRef | string;
  jugadorPartido: string | null;
  numero?: number;
  rol: 'jugador' | 'entrenador';
}

export interface PlanillaSet {
  _id: string;
  planilla: string;
  numeroSet: number;
  ganadorSet: 'local' | 'visitante' | 'empate' | 'pendiente';
  setPartido: string | null;
}

export interface PlanillaEstadistica {
  _id: string;
  planilla: string;
  planillaSet: string | null;
  planillaPresente: string;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survive: boolean;
}

export interface PlanillaEquipo {
  _id: string;
  partido: string;
  equipo: string | { _id: string; nombre?: string; escudo?: string };
  modo: PlanillaModo;
  estado: PlanillaEstado;
  visibilidadObjetivo: PlanillaVisibilidad;
  solicitudOficializacion?: string;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanillaCompleta extends PlanillaEquipo {
  presentes: PlanillaPresente[];
  sets: PlanillaSet[];
  estadisticas: PlanillaEstadistica[];
}

const BASE = '/planillas-equipo';

export const listarPlanillas = (equipoId: string, partidoId?: string) => {
  const params = new URLSearchParams({ equipo: equipoId });
  if (partidoId) params.set('partido', partidoId);
  return authFetch<PlanillaEquipo[]>(`${BASE}?${params.toString()}`);
};

/** La planilla del equipo para un partido puntual, o null si todavía no existe. */
export const obtenerPlanillaDePartido = async (
  equipoId: string,
  partidoId: string,
): Promise<PlanillaEquipo | null> => {
  const planillas = await listarPlanillas(equipoId, partidoId);
  return planillas[0] ?? null;
};

export const obtenerPlanilla = (planillaId: string) =>
  authFetch<PlanillaCompleta>(`${BASE}/${planillaId}`);

export const crearPlanilla = (payload: {
  partido: string;
  equipo: string;
  modo?: PlanillaModo;
  autocompletarPresentes?: boolean;
}) => authFetch<PlanillaCompleta>(BASE, { method: 'POST', body: payload });

export const guardarPresentes = (
  planillaId: string,
  presentes: Array<{ jugador: string; numero?: number; rol?: 'jugador' | 'entrenador' }>,
) =>
  authFetch<PlanillaCompleta>(`${BASE}/${planillaId}/presentes`, {
    method: 'POST',
    body: { presentes },
  });

export const quitarPresente = (planillaId: string, presenteId: string) =>
  authFetch<void>(`${BASE}/${planillaId}/presentes/${presenteId}`, { method: 'DELETE' });

export const guardarSet = (
  planillaId: string,
  payload: { numeroSet: number; ganadorSet?: PlanillaSet['ganadorSet'] },
) => authFetch<PlanillaSet>(`${BASE}/${planillaId}/sets`, { method: 'POST', body: payload });

export const eliminarSet = (planillaId: string, setId: string) =>
  authFetch<void>(`${BASE}/${planillaId}/sets/${setId}`, { method: 'DELETE' });

/**
 * Upsert en lote. Omitir `planillaSet` carga los totales del partido, y solo funciona
 * si la planilla está en modo 'directa'.
 */
export const guardarEstadisticas = (
  planillaId: string,
  payload: {
    planillaSet?: string | null;
    estadisticas: Array<{
      planillaPresente: string;
      throws?: number;
      hits?: number;
      outs?: number;
      catches?: number;
      survive?: boolean;
    }>;
  },
) =>
  authFetch<PlanillaEstadistica[]>(`${BASE}/${planillaId}/estadisticas`, {
    method: 'PUT',
    body: payload,
  });

export interface RespuestaOficializacion {
  oficializada: boolean;
  motivo?: string;
  solicitudId?: string;
  planilla?: PlanillaCompleta;
}

/**
 * En un partido de competencia deja UNA solicitud para el organizador. En un amistoso
 * no hay quién apruebe, así que se oficializa en el acto y `oficializada` vuelve true.
 */
export const solicitarOficializacion = (
  planillaId: string,
  visibilidadObjetivo: PlanillaVisibilidad = 'organizacion',
) =>
  authFetch<RespuestaOficializacion>(`${BASE}/${planillaId}/solicitar-oficializacion`, {
    method: 'POST',
    body: { visibilidadObjetivo },
  });

export const cancelarOficializacion = (planillaId: string) =>
  authFetch<{ estado: PlanillaEstado }>(`${BASE}/${planillaId}/cancelar-oficializacion`, {
    method: 'POST',
  });

export const eliminarPlanilla = (planillaId: string) =>
  authFetch<void>(`${BASE}/${planillaId}`, { method: 'DELETE' });

export interface ResumenJugadorPlanilla {
  jugadorId: string;
  nombre: string;
  foto?: string;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  sets: number;
  partidos: number;
}

export interface ResumenPartidoPlanilla {
  planillaId: string;
  partido: {
    _id: string;
    fecha?: string;
    estado?: string;
    competencia?: string | null;
  } | null;
  estado: PlanillaEstado;
  modo: PlanillaModo;
  totales: { throws: number; hits: number; outs: number; catches: number };
}

export interface ResumenPlanillas {
  jugadores: ResumenJugadorPlanilla[];
  partidos: ResumenPartidoPlanilla[];
}

/**
 * Acumulado de todas las planillas del equipo. Son datos propios, no oficiales: no
 * salen de las colecciones de la competencia y nunca se suman a ellas. Un jugador
 * puede tener números acá y otros distintos en el registro oficial.
 */
export const getResumenPlanillas = (equipoId: string) =>
  authFetch<ResumenPlanillas>(`${BASE}/resumen?equipo=${encodeURIComponent(equipoId)}`);

/**
 * Una fila por jugador y set, con las dimensiones ya resueltas.
 *
 * Es el formato largo que consume el análisis cruzado: el cliente agrupa por lo que
 * elija el usuario sin volver a pedirle nada al servidor.
 */
export interface FilaPlanilla {
  jugadorId: string;
  jugador: string;
  partidoId: string;
  fecha: string | null;
  rival: string;
  /** 'Masculino' | 'Femenino' | 'Mixto' | 'Libre' | 'Amistoso' */
  categoria: string;
  /** 'Cloth' | 'Foam' | 'Sin modalidad' */
  modalidad: string;
  numeroSet: number | null;
  /** Visto desde el equipo, no desde local/visitante. */
  resultadoSet: 'ganado' | 'perdido' | 'empate' | 'sin definir';
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survive: boolean;
}

export const getFilasPlanillas = (equipoId: string) =>
  authFetch<{ filas: FilaPlanilla[] }>(`${BASE}/filas?equipo=${encodeURIComponent(equipoId)}`);

/** Totales por presente, sumando todos los sets. Es la base de la vista de análisis. */
export const totalizarPorPresente = (
  planilla: PlanillaCompleta,
): Record<string, { throws: number; hits: number; outs: number; catches: number; sets: number }> => {
  const totales: Record<
    string,
    { throws: number; hits: number; outs: number; catches: number; sets: number }
  > = {};

  for (const stat of planilla.estadisticas) {
    const key = stat.planillaPresente;
    if (!totales[key]) {
      totales[key] = { throws: 0, hits: 0, outs: 0, catches: 0, sets: 0 };
    }
    totales[key].throws += stat.throws || 0;
    totales[key].hits += stat.hits || 0;
    totales[key].outs += stat.outs || 0;
    totales[key].catches += stat.catches || 0;
    if (stat.planillaSet) totales[key].sets += 1;
  }

  return totales;
};
