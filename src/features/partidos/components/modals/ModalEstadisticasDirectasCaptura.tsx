import React, { useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { ListaJugadores } from './ListaJugadores';
import { extractEquipoId, type PartidoDetallado } from '../../services/partidoService';
import {
  getJugadoresPartido,
  getEstadisticasJugadorPartidoManual,
  guardarEstadisticaManualJugadorPartido,
  actualizarEstadisticaManualJugadorPartido,
  type JugadorPartidoResumen,
  type EstadisticaManualJugador,
} from '../../../estadisticas/services/estadisticasService';
import { crearSolicitudEdicion } from '../../../../shared/features/solicitudes/services/solicitudesEdicionService';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';

type EstadisticasFila = { _id?: string; throws: number; hits: number; outs: number; catches: number };

const FILA_VACIA: EstadisticasFila = { throws: 0, hits: 0, outs: 0, catches: 0 };

/** El nombre del jugador de una fila de convocatoria, que puede venir poblado o como id. */
const nombreDeConvocado = (convocado: JugadorPartidoResumen): string => {
  const j = convocado.jugador as unknown;
  if (!j) return 'Jugador';
  if (typeof j === 'string') return 'Jugador';
  const obj = j as { nombre?: string; apellido?: string; alias?: string };
  return obj.alias || [obj.nombre, obj.apellido].filter(Boolean).join(' ') || 'Jugador';
};

interface ModalEstadisticasDirectasCapturaProps {
  partido: PartidoDetallado | null;
  partidoId: string;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
}

/**
 * Captura de los totales de un partido, por jugador, sin desglose por set.
 *
 * Comparte la grilla con las otras dos capturas (`ListaJugadores`), pero con dos diferencias que
 * son de su naturaleza, no de su implementación:
 *
 * - **Sin tope de jugadores.** El eje acá no es quién está en cancha —eso son 6 y es la regla del
 *   juego— sino quién jugó el partido, que a lo largo de varios sets puede ser cualquier número.
 *   Por eso va sin `capacidad`: una fila por convocado.
 * - **Sin asignación ni "sobrevive".** Cada fila ES un convocado (la alineación se arma en
 *   `ModalAlineacionPartido`), y "sobrevive" es un dato de un set, no de todo el partido.
 *
 * A diferencia de la captura set a set y de "Mi planilla", acá **no hay autoguardado por fila**, y
 * es a propósito: en un partido de competencia el guardado arma UNA sola
 * `estadisticas-partido-propuesta` con todo. Autoguardar fila por fila exigiría separar "guardo"
 * de "pido oficial", como hace la captura por set — y eso no existe todavía del lado del backend
 * para los totales del partido.
 */
const ModalEstadisticasDirectasCaptura: React.FC<ModalEstadisticasDirectasCapturaProps> = ({
  partido,
  partidoId,
  onClose,
  onRefresh,
}) => {
  const { addToast } = useToast();
  const [convocados, setConvocados] = useState<JugadorPartidoResumen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [statsByJp, setStatsByJp] = useState<Record<string, EstadisticasFila>>({});
  /** Números cargados sin guardar: cerrar por backdrop o Escape pide confirmación. */
  const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false);

  const equipoLocalId = useMemo(() => extractEquipoId(partido?.equipoLocal), [partido]);
  const equipoVisitanteId = useMemo(() => extractEquipoId(partido?.equipoVisitante), [partido]);

  useEffect(() => {
    let cancelado = false;
    const cargar = async (): Promise<void> => {
      try {
        setLoading(true);
        const [jp, manuales] = await Promise.all([
          getJugadoresPartido(partidoId),
          getEstadisticasJugadorPartidoManual(partidoId),
        ]);
        if (cancelado) return;
        const lista = Array.isArray(jp) ? jp : [];
        setConvocados(lista);

        const mapa: Record<string, EstadisticasFila> = {};
        const listaManuales: EstadisticaManualJugador[] = Array.isArray(manuales) ? manuales : [];

        listaManuales.forEach((m) => {
          const jpId = typeof m.jugadorPartido === 'string' ? m.jugadorPartido : m.jugadorPartido?._id;
          if (!jpId) return;
          mapa[jpId] = {
            _id: m._id,
            throws: m.throws ?? 0,
            hits: m.hits ?? 0,
            outs: m.outs ?? 0,
            catches: m.catches ?? 0,
          };
        });

        // Todo convocado tiene fila en la grilla, aunque no tenga números cargados todavía.
        lista.forEach((j) => {
          if (!mapa[j._id]) mapa[j._id] = { ...FILA_VACIA };
        });

        setStatsByJp(mapa);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [partidoId]);

  const convocadosDe = (equipoId: string | undefined): JugadorPartidoResumen[] =>
    convocados.filter((j) => (typeof j.equipo === 'string' ? j.equipo === equipoId : j.equipo?._id === equipoId));

  const convocadosLocal = useMemo(
    () => convocadosDe(equipoLocalId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convocados, equipoLocalId],
  );
  const convocadosVisitante = useMemo(
    () => convocadosDe(equipoVisitanteId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convocados, equipoVisitanteId],
  );

  const cambiarEstadistica = (
    jugadorPartidoId: string,
    campo: 'throws' | 'hits' | 'outs' | 'catches',
    delta: number,
  ) => {
    setHayCambiosSinGuardar(true);
    setStatsByJp((prev) => {
      const actual = prev[jugadorPartidoId] ?? { ...FILA_VACIA };
      const siguiente = Math.max(0, (actual[campo] ?? 0) + delta);
      return { ...prev, [jugadorPartidoId]: { ...actual, [campo]: siguiente } };
    });
  };

  /** Lo que la grilla necesita de un grupo de convocados: valor por fila y opciones (su nombre). */
  const grillaDe = (lista: JugadorPartidoResumen[]) => ({
    estadisticas: lista.map((j) => ({
      jugadorId: j._id,
      estadisticas: statsByJp[j._id] ?? FILA_VACIA,
    })),
    opciones: lista.map((j) => ({ value: j._id, label: nombreDeConvocado(j) })),
  });

  const guardar = async (): Promise<void> => {
    setGuardando(true);
    try {
      const esCompetencia = !!partido?.competencia;

      if (esCompetencia) {
        const estadisticas = convocados
          .map((j) => {
            const stats = statsByJp[j._id];
            if (!stats) return null;
            return {
              jugadorPartido: j._id,
              throws: stats.throws ?? 0,
              hits: stats.hits ?? 0,
              outs: stats.outs ?? 0,
              catches: stats.catches ?? 0,
              tipoCaptura: 'manual',
              statId: stats._id,
            };
          })
          .filter(Boolean);

        await crearSolicitudEdicion({
          // Mismo caso que en la captura por set: son números que todavía no existen,
          // no una fila a publicar. Con 'estadisticasJugadorPartido' el backend
          // buscaba una estadística con el id del partido y descartaba la propuesta.
          tipo: 'estadisticas-partido-propuesta',
          entidad: partidoId,
          datosPropuestos: {
            estadisticas,
          },
        });

        addToast({ type: 'success', title: 'Solicitud enviada', message: 'Se solicitó la actualización de estadísticas' });
        onClose();
        return;
      }

      const tareas: Array<Promise<unknown>> = [];
      convocados.forEach((j) => {
        const stats = statsByJp[j._id];
        if (!stats) return;
        const payload = {
          jugadorPartido: j._id,
          throws: stats.throws ?? 0,
          hits: stats.hits ?? 0,
          outs: stats.outs ?? 0,
          catches: stats.catches ?? 0,
          tipoCaptura: 'manual',
        } as const;
        if (stats._id) {
          tareas.push(actualizarEstadisticaManualJugadorPartido(stats._id, payload));
        } else {
          tareas.push(guardarEstadisticaManualJugadorPartido(payload));
        }
      });
      await Promise.all(tareas);
      setHayCambiosSinGuardar(false);
      await Promise.resolve(onRefresh?.());
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  const nombreLocal =
    partido?.equipoLocal && typeof partido.equipoLocal !== 'string'
      ? partido.equipoLocal.nombre || 'Local'
      : 'Local';
  const nombreVisitante =
    partido?.equipoVisitante && typeof partido.equipoVisitante !== 'string'
      ? partido.equipoVisitante.nombre || 'Visitante'
      : 'Visitante';

  const grillaLocal = grillaDe(convocadosLocal);
  const grillaVisitante = grillaDe(convocadosVisitante);

  return (
    <ModalBase
      title="Captura de estadísticas directas"
      onClose={onClose}
      size="xl"
      isOpen
      hasUnsavedChanges={hayCambiosSinGuardar}
      unsavedMessage="Cargaste estadísticas que todavía no guardaste. ¿Cerrar y perderlas?"
    >
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Cargando jugadores y estadísticas...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Totales de todo el partido, sin desglose por set. Está la convocatoria completa: cargá
            los números de quienes jugaron y dejá en cero al resto.
          </p>

          {/* Una grilla por equipo, sin tope de jugadores y sin selector: cada fila ya es un
              convocado. En mobile van una debajo de la otra; ver el comentario de
              `TablaJugadoresEstadisticas` sobre por qué de `sm:` para arriba se usa la tabla. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <ListaJugadores
              equipoNombre={nombreLocal}
              estadisticasJugador={grillaLocal.estadisticas}
              opcionesJugadores={grillaLocal.opciones}
              asignable={false}
              mostrarSurvive={false}
              onCambiarEstadistica={(index, campo, delta) => {
                const convocado = convocadosLocal[index];
                if (convocado) cambiarEstadistica(convocado._id, campo, delta);
              }}
            />
            <ListaJugadores
              equipoNombre={nombreVisitante}
              estadisticasJugador={grillaVisitante.estadisticas}
              opcionesJugadores={grillaVisitante.opciones}
              asignable={false}
              mostrarSurvive={false}
              onCambiarEstadistica={(index, campo, delta) => {
                const convocado = convocadosVisitante[index];
                if (convocado) cambiarEstadistica(convocado._id, campo, delta);
              }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar estadísticas del partido'}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  );
};

export default ModalEstadisticasDirectasCaptura;
