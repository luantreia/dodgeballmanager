import { authFetch } from '../../../shared/utils/authFetch';

/**
 * Aportes de jugadores: números que un jugador cargó sobre sí mismo en Overtime-Manager y
 * le ofreció al cuerpo técnico. Aceptar los copia a la planilla del equipo (no a lo
 * oficial); desde ahí siguen el flujo normal de oficialización.
 *
 * Espeja overtime/src/services/planillaJugadorService.js (listarAportes / resolverAporte).
 */

export type Totales = { throws: number; hits: number; outs: number; catches: number };

export interface AporteJugador {
  planillaId: string;
  jugador: { _id: string; nombre?: string; apellido?: string; alias?: string; foto?: string };
  partido: {
    _id: string;
    fecha: string;
    equipoLocal?: { _id: string; nombre?: string };
    equipoVisitante?: { _id: string; nombre?: string };
  };
  aporte: { estado: 'pendiente' | 'aceptado' | 'descartado'; fecha: string };
  notas: string;
  totales: Totales;
  /** La planilla del equipo para ese partido, si existe, y lo que ya dice sobre este jugador. */
  planillaDelEquipo: {
    _id: string;
    estado: string;
    modo: 'sets' | 'directa';
    totalesDelJugador: Totales | null;
  } | null;
}

export const listarAportes = (equipoId: string) =>
  authFetch<AporteJugador[]>(`/planillas-jugador/aportes?equipo=${equipoId}`);

export const resolverAporte = (planillaId: string, accion: 'aceptar' | 'descartar', motivo?: string) =>
  authFetch<{ estado: string; planillaEquipo: string | null }>(`/planillas-jugador/${planillaId}/aporte/${accion}`, {
    method: 'POST',
    body: motivo ? { motivo } : {},
  });
