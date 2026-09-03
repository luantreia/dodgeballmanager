import { authFetch } from '../../../shared/utils/authFetch';

export type ResultadoPartido = 'ganado' | 'perdido' | 'empate' | 'sin definir';
export type ResultadoSet = ResultadoPartido;

/**
 * Una fila por jugador y por set, con los atributos del partido desnormalizados encima.
 *
 * Los partidos sin ninguna estadística cargada aportan igual una fila, con `jugador` en null y
 * todo en cero: un partido ganado sin planilla sigue siendo un partido ganado, y sin esa fila
 * el porcentaje de victorias sólo contaría los partidos que alguien se tomó el trabajo de
 * cargar. Por eso todo lo que sea por jugador filtra `jugadorId !== null`.
 */
export type FilaAnalitica = {
  partidoId: string;
  fecha: string;
  estadoPartido: string;
  modalidad: string;
  categoria: string;
  competenciaId: string | null;
  competencia: string;
  organizacionId: string | null;
  organizacion: string;
  temporadaId: string | null;
  temporada: string;
  faseId: string | null;
  fase: string;
  rivalId: string | null;
  rival: string;
  esLocal: boolean;
  marcadorEquipo: number;
  marcadorRival: number;
  resultadoPartido: ResultadoPartido;
  /** De dónde salieron estos números. Null cuando el partido no tiene ninguna fuente cargada. */
  fuente: 'oficial' | 'planilla' | null;
  numeroSet: number | null;
  resultadoSet: ResultadoSet;
  jugadorId: string | null;
  jugador: string | null;
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survive: boolean;
};

export const getFilasAnaliticas = async (equipoId: string): Promise<FilaAnalitica[]> => {
  const resp = await authFetch<{ filas: FilaAnalitica[] }>(
    `/estadisticas/equipo/${equipoId}/filas`,
  );
  return resp.filas ?? [];
};
