import { authFetch } from '../../../shared/utils/authFetch';

export type FilaTabla = {
  _id: string;
  equipo: { _id: string; nombre: string; escudo: string | null } | null;
  grupo: string | null;
  division: string | null;
  /** `null` cuando la fase nunca fue recalculada por la organización. */
  posicion: number | null;
  puntos: number;
  partidosJugados: number;
  partidosGanados: number;
  partidosEmpatados: number;
  partidosPerdidos: number;
  diferenciaPuntos: number;
  clasificado: boolean;
  eliminado: boolean;
};

export type TablaFase = {
  fase: { _id: string; nombre?: string; tipo?: string };
  /**
   * `false` significa que la organización todavía no corrió el recálculo de la fase, así que
   * las posiciones vienen del orden de respaldo (puntos, luego diferencia) y no del criterio
   * de desempate configurado. La UI tiene que decirlo: una tabla provisoria presentada como
   * oficial es peor que no mostrar tabla.
   */
  calculada: boolean;
  posiciones: FilaTabla[];
};

/**
 * Tabla de posiciones de una fase. Es de sólo lectura: el recálculo (que reordena y escribe las
 * posiciones en la base) es una acción del organizador, no algo que dispare abrir una pantalla.
 */
export const getTablaFase = (faseId: string) => authFetch<TablaFase>(`/fases/${faseId}/tabla`);
