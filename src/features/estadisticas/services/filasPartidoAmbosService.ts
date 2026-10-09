import { getSetsConEstadisticas } from './estadisticasService';
import { obtenerPlanilla, type PlanillaPresente } from '../../partidos/services/planillaEquipoService';
import type { PartidoTimeline } from './timelineService';
import type { FilaAnalitica } from './filasService';

/**
 * Una `FilaAnalitica` de un partido puntual, pero de los DOS equipos — no sólo el propio.
 *
 * `getFilasAnaliticas` (el dataset de toda la pantalla de análisis) filtra por `perspectiva` a
 * propósito: agregar métricas de un equipo no puede mezclar jugadores del rival sin arruinar los
 * totales. Para exportar un partido puntual eso es justo lo que no queremos — por eso esto vive
 * aparte, con un campo nuevo (`equipo`) que dice de qué lado de la cancha es cada fila, y nunca
 * se usa para alimentar una métrica agregada del equipo.
 */
export type FilaPartidoAmbosEquipos = FilaAnalitica & {
  equipoId: string | null;
  equipo: string;
};

const nombreDeOficial = (j?: { nombre?: string; apellido?: string } | null): string =>
  [j?.nombre, j?.apellido].filter(Boolean).join(' ').trim() || 'Jugador';

const nombreDePresente = (presente?: PlanillaPresente): string => {
  const j = presente?.jugador;
  if (!j || typeof j === 'string') return 'Jugador';
  return j.alias || [j.nombre, j.apellido].filter(Boolean).join(' ').trim() || 'Jugador';
};

const jugadorIdDePresente = (presente?: PlanillaPresente): string | null => {
  const j = presente?.jugador;
  if (!j) return null;
  return typeof j === 'string' ? j : j._id;
};

/**
 * El id del equipo detrás de `PlanillaPresente.equipo`, o `null` si no está (un presente viejo,
 * de antes de que ese campo existiera). `null` se trata como "el equipo dueño de la planilla" en
 * `esLocalDe`, igual que ya hace `ModalVisorPartido`.
 */
const equipoIdDePresente = (presente?: PlanillaPresente): string | null => {
  const raw = presente?.equipo;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : raw._id;
};

/** 'local'/'visitante' del dato crudo, traducido a si ESE equipo (no el que exporta) ganó el set. */
const resultadoDesdeGanador = (
  ganador: 'local' | 'visitante' | 'empate' | 'pendiente' | undefined,
  esLocal: boolean,
): FilaAnalitica['resultadoSet'] => {
  if (ganador === 'empate') return 'empate';
  if (ganador === 'local') return esLocal ? 'ganado' : 'perdido';
  if (ganador === 'visitante') return esLocal ? 'perdido' : 'ganado';
  return 'sin definir';
};

/**
 * Las filas de un partido, de los dos equipos, en la misma fuente que ya está usando el análisis
 * (`fuenteEfectiva`). No se mezclan oficial y planilla por la misma razón que en el backend: un
 * partido con las dos cargadas sumaría al mismo jugador dos veces.
 */
export const obtenerFilasAmbosEquipos = async (
  partido: PartidoTimeline,
  /**
   * El equipo a través del cual se armó `partido` — `perspectiva`, no necesariamente el club
   * propio. En un partido scouteado (`listarPlanillasScouteadas`) tu club ni jugó: `esLocal` y
   * `rival` ya vienen resueltos desde ese otro equipo, así que compararlos contra tu club de
   * verdad hacía que ninguno de los dos lados matcheara y los dos cayeran en "Otro equipo".
   */
  perspectivaId: string,
  perspectivaNombre: string,
): Promise<FilaPartidoAmbosEquipos[]> => {
  const { fuenteEfectiva } = partido.datos;
  if (fuenteEfectiva === 'sin_datos') return [];

  const rivalId = partido.rival?._id ?? null;
  const rivalNombre = partido.rival?.nombre ?? 'Rival';

  const nombreDeEquipo = (equipoIdFila: string | null): string => {
    if (!equipoIdFila || equipoIdFila === perspectivaId) return perspectivaNombre || 'Mi equipo';
    if (equipoIdFila === rivalId) return rivalNombre;
    return 'Otro equipo';
  };

  // Un presente/stat de este mismo equipo juega del mismo lado (local/visitante) que `partido`;
  // uno del rival juega del lado contrario. Sin dato de equipo, se trata como propio.
  const esLocalDe = (equipoIdFila: string | null): boolean =>
    equipoIdFila && equipoIdFila !== perspectivaId ? !partido.esLocal : partido.esLocal;

  let resultadoPartido: FilaAnalitica['resultadoPartido'] = 'sin definir';
  if (partido.estado === 'finalizado') {
    if (partido.marcadorEquipo > partido.marcadorRival) resultadoPartido = 'ganado';
    else if (partido.marcadorEquipo < partido.marcadorRival) resultadoPartido = 'perdido';
    else resultadoPartido = 'empate';
  }

  const contexto = {
    partidoId: partido._id,
    fecha: partido.fecha,
    estadoPartido: partido.estado,
    modalidad: partido.modalidad,
    categoria: partido.categoria,
    competenciaId: partido.competencia?._id ?? null,
    competencia: partido.competencia?.nombre ?? 'Amistoso',
    organizacionId: partido.competencia?.organizacion?._id ?? null,
    organizacion: partido.competencia?.organizacion?.nombre ?? 'Amistoso',
    temporadaId: partido.temporada?._id ?? null,
    temporada: partido.temporada?.nombre ?? 'Sin temporada',
    faseId: partido.fase?._id ?? null,
    fase: partido.fase?.nombre ?? 'Sin fase',
    rivalId,
    rival: rivalNombre,
    esLocal: partido.esLocal,
    marcadorEquipo: partido.marcadorEquipo,
    marcadorRival: partido.marcadorRival,
    resultadoPartido,
  };

  const filas: FilaPartidoAmbosEquipos[] = [];

  if (fuenteEfectiva === 'oficial') {
    const sets = await getSetsConEstadisticas(partido._id);
    for (const set of sets) {
      for (const stat of set.estadisticas ?? []) {
        const equipoIdFila = stat.equipo?._id ?? null;
        filas.push({
          ...contexto,
          fuente: 'oficial',
          numeroSet: set.numeroSet,
          resultadoSet: resultadoDesdeGanador(set.ganadorSet, esLocalDe(equipoIdFila)),
          equipoId: equipoIdFila,
          equipo: nombreDeEquipo(equipoIdFila),
          jugadorId: stat.jugador?._id ?? null,
          jugador: nombreDeOficial(stat.jugador),
          throws: stat.throws ?? 0,
          hits: stat.hits ?? 0,
          outs: stat.outs ?? 0,
          catches: stat.catches ?? 0,
          survive: Boolean(stat.survive),
        });
      }
    }
    return filas;
  }

  if (!partido.datos.planilla) return [];
  const planilla = await obtenerPlanilla(partido.datos.planilla._id);
  const presentePorId = new Map(planilla.presentes.map((p) => [p._id, p]));
  const setPorId = new Map(planilla.sets.map((s) => [s._id, s]));

  for (const stat of planilla.estadisticas) {
    const presente = presentePorId.get(stat.planillaPresente);
    const equipoIdFila = equipoIdDePresente(presente);
    const setDoc = stat.planillaSet ? setPorId.get(stat.planillaSet) : null;
    filas.push({
      ...contexto,
      fuente: 'planilla',
      numeroSet: setDoc?.numeroSet ?? null,
      resultadoSet: setDoc ? resultadoDesdeGanador(setDoc.ganadorSet, esLocalDe(equipoIdFila)) : 'sin definir',
      equipoId: equipoIdFila,
      equipo: nombreDeEquipo(equipoIdFila),
      jugadorId: jugadorIdDePresente(presente),
      jugador: nombreDePresente(presente),
      throws: stat.throws ?? 0,
      hits: stat.hits ?? 0,
      outs: stat.outs ?? 0,
      catches: stat.catches ?? 0,
      survive: Boolean(stat.survive),
    });
  }
  return filas;
};
