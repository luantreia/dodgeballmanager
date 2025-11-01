import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import JugadorEstadisticasCard, {
  type EstadisticasJugador,
} from '../common/JugadorEstadisticasCard';
import { getJugadoresEquipo } from '../../../jugadores/services/jugadorEquipoService';

export type EstadisticaJugadorEntrada = {
  jugadorId?: string;
  estadisticas?: Record<string, number>;
};

export type ListaJugadoresProps = {
  equipoNombre: string;
  equipoId: string;
  estadisticasJugador?: EstadisticaJugadorEntrada[];
  onAsignarJugador: (index: number, jugadorId: string) => void;
  onCambiarEstadistica: (index: number, campo: keyof EstadisticasJugador, delta: number) => void;
  token: string;
  opcionesJugadores?: Array<{ value: string; label: string }>;
};

export const ListaJugadores: FC<ListaJugadoresProps> = ({
  equipoNombre,
  equipoId,
  estadisticasJugador = [],
  onAsignarJugador,
  onCambiarEstadistica,
  token,
  opcionesJugadores,
}) => {
  type JugadorRelacion = {
    id: string;
    nombre: string;
  };

  const [relaciones, setRelaciones] = useState<JugadorRelacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const cargarJugadores = async () => {
      try {
        setLoading(true);
        if (opcionesJugadores && opcionesJugadores.length > 0) {
          if (!isMounted) return;
          setRelaciones([]);
          return;
        }
        const jugadores = await getJugadoresEquipo({ equipoId });
        if (!isMounted) return;
        setRelaciones(
          jugadores.map((jugador) => ({
            id: jugador.id,
            nombre: jugador.nombre,
          })),
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('Error cargando jugadores del equipo:', error);
        setRelaciones([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void cargarJugadores();

    return () => {
      isMounted = false;
    };
  }, [equipoId, token, opcionesJugadores]);

  const opcionesSelect = useMemo(() => {
    if (opcionesJugadores && opcionesJugadores.length > 0) {
      return opcionesJugadores.filter((opt) => Boolean(opt.value));
    }
    return relaciones
      .map((rel) => ({ value: rel.id, label: rel.nombre ?? 'Sin nombre' }))
      .filter((opt) => Boolean(opt.value));
  }, [opcionesJugadores, relaciones]);

  const obtenerJugadoresSeleccionados = (excluirIndex: number) =>
    estadisticasJugador
      .filter((_, index) => index !== excluirIndex)
      .map((j) => j?.jugadorId)
      .filter((value): value is string => Boolean(value));

  const estadisticasCompletas: Array<EstadisticaJugadorEntrada | null> = [
    ...estadisticasJugador,
    ...Array.from({ length: Math.max(0, 6 - estadisticasJugador.length) }, () => null),
  ].slice(0, 6);

  if (loading) {
    return (
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-slate-800">{equipoNombre}</h3>
        <p className="text-slate-500">Cargando jugadores...</p>
      </div>
    );
  }

  return (
    <div className="p-1">
      <h3 className="mb-1 text-lg font-semibold text-slate-800">{equipoNombre}</h3>
      <div className="grid grid-cols-3 gap-2 xs:grid-cols-6 md:grid-cols-6">
        {estadisticasCompletas.map((jugadorObj, idx) => {
          const jugadorId = jugadorObj?.jugadorId ?? '';
          const stats = jugadorObj?.estadisticas ?? {};
          const jugadoresSeleccionados = obtenerJugadoresSeleccionados(idx);
          const opcionesFiltradas = opcionesSelect.filter(
            (op) => !jugadoresSeleccionados.includes(op.value) || op.value === jugadorId,
          );

          return (
            <JugadorEstadisticasCard
              key={`jugador-estadisticas-${idx}`}
              index={idx}
              jugadorId={jugadorId}
              opcionesJugadores={opcionesFiltradas}
              onCambiarJugador={(nuevoId: string) => onAsignarJugador(idx, nuevoId)}
              onCambiarEstadistica={(campo: keyof EstadisticasJugador, delta: number) =>
                onCambiarEstadistica(idx, campo, delta)
              }
              estadisticasJugador={stats}
            />
          );
        })}
      </div>
    </div>
  );
};
