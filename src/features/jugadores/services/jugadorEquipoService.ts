import { authFetch } from '../../../shared/utils/authFetch';
import type { Jugador, ContratoJugadorResumen } from '../../../shared/utils/types/types';

type JugadorEquipoQuery = {
  equipoId: string;
  estado?: 'activo' | 'pendiente' | 'baja';
};

type BackendJugador = {
  _id: string;
  nombre?: string;
  posicion?: string;
  alias?: string;
  estado?: string;
  numeroCamiseta?: number;
};

type BackendJugadorEquipo = {
  _id: string;
  jugador: BackendJugador | string;
  equipo: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'cancelado' | 'baja';
  /**
   * Campo derivado que agrega el backend cruzando `estado` con `desde`/`hasta`. Se usa este y
   * no `estado`: deducirlo acá significaría que cada app tiene su propia versión de la regla,
   * que es exactamente cómo empiezan a diferir.
   */
  vigencia?: 'vigente' | 'vencido' | 'futuro' | 'pendiente' | 'baja';
  rol?: string;
  desde?: string;
  hasta?: string;
  fechaSolicitud?: string;
  origen?: 'equipo' | 'jugador';
  fechaAceptacion?: string;
  createdAt?: string;
  updatedAt?: string;
};

const mapJugador = (relacion: BackendJugadorEquipo): Jugador => {
  const jugadorData = typeof relacion.jugador === 'string' ? { _id: relacion.jugador } : relacion.jugador;

  return {
    id: jugadorData._id,
    nombre: jugadorData.nombre ?? jugadorData.alias ?? 'Jugador',
    posicion: jugadorData.posicion ?? 'Jugador',
    numeroCamiseta: jugadorData.numeroCamiseta,
    // El fallback existe sólo para un backend viejo que todavía no mande `vigencia`; el
    // mapeo que había antes daba 'activo' a cualquier contrato aceptado, vencido incluido.
    estado: relacion.vigencia ?? (relacion.estado === 'aceptado' ? 'vigente' : relacion.estado === 'baja' ? 'baja' : 'pendiente'),
    rolEnEquipo: relacion.rol,
    rol: relacion.rol,
    fechaInicio: relacion.desde ?? undefined,
    fechaFin: relacion.hasta ?? undefined,
    contratoId: relacion._id,
  };
};

const mapContratoResumen = (relacion: BackendJugadorEquipo): ContratoJugadorResumen => {
  const jugadorData = typeof relacion.jugador === 'string' ? { _id: relacion.jugador } : relacion.jugador;

  return {
    id: relacion._id,
    jugadorNombre: jugadorData.nombre ?? jugadorData.alias ?? 'Jugador',
    estado: relacion.estado,
    rol: relacion.rol,
    origen: relacion.origen,
    fechaInicio: relacion.desde,
    fechaFin: relacion.hasta ?? null,
    fechaSolicitud: relacion.fechaSolicitud ?? relacion.createdAt,
    fechaAceptacion: relacion.fechaAceptacion ?? undefined,
  };
};

/** ¿Este contrato pone al jugador en el plantel de hoy? */
const estaVigente = (relacion: BackendJugadorEquipo): boolean =>
  (relacion.vigencia ?? (relacion.estado === 'aceptado' ? 'vigente' : 'baja')) === 'vigente';

/**
 * El plantel de hoy.
 *
 * Filtra por vigencia y no por `estado === 'aceptado'`: un contrato con `hasta` en el pasado
 * sigue estando aceptado —nadie lo dio de baja, se cumplió el plazo— y hacía que jugadores que
 * ya no están en el equipo aparecieran como activos.
 */
export const getJugadoresEquipo = async ({ equipoId, estado }: JugadorEquipoQuery): Promise<Jugador[]> => {
  const queryEstado = estado ? `&estado=${estado}` : '';
  const relaciones = await authFetch<BackendJugadorEquipo[]>(`/jugador-equipo?equipo=${equipoId}${queryEstado}`);
  return relaciones.filter(estaVigente).map(mapJugador);
};

/** Todo lo que no está vigente: vencidos, dados de baja, pendientes y los que aún no empezaron. */
export const getContratosNoActivos = async (equipoId: string): Promise<ContratoJugadorResumen[]> => {
  const relaciones = await authFetch<BackendJugadorEquipo[]>(`/jugador-equipo?equipo=${equipoId}`);
  return relaciones.filter((relacion) => !estaVigente(relacion)).map(mapContratoResumen);
};
