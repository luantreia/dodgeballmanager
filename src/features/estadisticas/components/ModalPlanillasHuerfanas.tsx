import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { formatDateTime } from '../../../shared/utils/formatDate';
import { getParticipaciones } from '../../competencias/services/equipoCompetenciaService';
import { getPartidos } from '../../partidos/services/partidoService';
import {
  listarPlanillasHuerfanas,
  reasignarPartidoPlanilla,
  type PlanillaHuerfana,
} from '../../partidos/services/planillaEquipoService';
import type { Partido } from '../../../shared/utils/types/types';

type Props = {
  equipoId: string;
  onClose: () => void;
  /** Se llama después de reasignar al menos una planilla, para que el padre recargue el timeline. */
  onCambio?: () => void;
};

type ConflictoEquipos = { equipos: Array<{ _id: string; nombre?: string }> };

/**
 * Borrar un Partido nunca cascadea su PlanillaEquipo (para no destruir el análisis
 * propio de un equipo) — pero eso las deja apuntando a un partido que ya no existe,
 * sin ningún otro lugar de la app donde volver a encontrarlas. Esta pantalla es esa
 * puerta: lista las huérfanas del equipo y deja elegir un partido nuevo, buscando por
 * competencia igual que "Scoutear partido".
 *
 * A diferencia del scouting, acá SÍ puede tocar el propio partido del equipo (es el
 * caso más común: la organización borró y recreó el partido en otra fase) — por eso
 * no se filtra la lista de partidos por "que no sea tuyo".
 */
const ModalPlanillasHuerfanas = ({ equipoId, onClose, onCambio }: Props) => {
  const { addToast } = useToast();
  const [huerfanas, setHuerfanas] = useState<PlanillaHuerfana[]>([]);
  const [cargando, setCargando] = useState(true);

  const [reasignando, setReasignando] = useState<PlanillaHuerfana | null>(null);
  const [competencias, setCompetencias] = useState<Array<{ id: string; nombre: string }>>([]);
  const [cargandoCompetencias, setCargandoCompetencias] = useState(false);
  const [partidosCompetencia, setPartidosCompetencia] = useState<Partido[]>([]);
  const [cargandoPartidos, setCargandoPartidos] = useState(false);
  const [destino, setDestino] = useState<Partido | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState<ConflictoEquipos | null>(null);
  const [huboCambios, setHuboCambios] = useState(false);

  const cargarHuerfanas = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await listarPlanillasHuerfanas(equipoId);
      setHuerfanas(lista);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos cargar tus planillas huérfanas',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setCargando(false);
    }
  }, [equipoId, addToast]);

  useEffect(() => {
    void cargarHuerfanas();
  }, [cargarHuerfanas]);

  const empezarReasignacion = useCallback(
    async (planilla: PlanillaHuerfana) => {
      setReasignando(planilla);
      setDestino(null);
      setConflicto(null);
      setPartidosCompetencia([]);
      setCargandoCompetencias(true);
      try {
        const participaciones = await getParticipaciones({ equipoId });
        const aceptadas = participaciones.filter((p) => p.estado === 'aceptado');
        const unicas = new Map(aceptadas.map((p) => [p.competencia.id, p.competencia.nombre]));
        setCompetencias([...unicas.entries()].map(([id, nombre]) => ({ id, nombre })));
      } catch (error) {
        addToast({
          type: 'error',
          title: 'No pudimos cargar tus competencias',
          message: error instanceof Error ? error.message : 'Error inesperado',
        });
      } finally {
        setCargandoCompetencias(false);
      }
    },
    [equipoId, addToast],
  );

  const elegirCompetencia = useCallback(
    async (competenciaId: string) => {
      setCargandoPartidos(true);
      setDestino(null);
      setConflicto(null);
      try {
        const todos = await getPartidos({ competenciaId, tipo: 'competencia', limit: 1000 });
        // El partido de origen (ya borrado) obviamente no puede aparecer, pero de
        // paso descarta cualquier otro id que coincida por las dudas.
        setPartidosCompetencia(todos.filter((p) => p.id !== reasignando?.partidoEliminado));
      } catch (error) {
        addToast({
          type: 'error',
          title: 'No pudimos cargar los partidos',
          message: error instanceof Error ? error.message : 'Error inesperado',
        });
      } finally {
        setCargandoPartidos(false);
      }
    },
    [addToast, reasignando],
  );

  const partidosOrdenados = useMemo(
    () => [...partidosCompetencia].sort((a, b) => (b.fechaISO ?? '').localeCompare(a.fechaISO ?? '')),
    [partidosCompetencia],
  );

  const confirmarReasignacion = useCallback(async () => {
    if (!reasignando || !destino) return;
    setGuardando(true);
    setConflicto(null);
    try {
      await reasignarPartidoPlanilla(reasignando._id, destino.id);
      addToast({
        type: 'success',
        title: 'Planilla reasignada',
        message: `Se movió a ${destino.equipoLocal?.nombre ?? 'Local'} vs ${destino.equipoVisitante?.nombre ?? 'Visitante'}`,
      });
      setReasignando(null);
      setDestino(null);
      setHuboCambios(true);
      await cargarHuerfanas();
    } catch (error) {
      const err = error as { status?: number; message?: string; details?: { equipos?: ConflictoEquipos['equipos'] } };
      if (err.status === 409 && err.details?.equipos?.length) {
        setConflicto({ equipos: err.details.equipos });
      } else {
        addToast({
          type: 'error',
          title: 'No se pudo reasignar la planilla',
          message: err.message ?? 'Error inesperado',
        });
      }
    } finally {
      setGuardando(false);
    }
  }, [reasignando, destino, addToast, cargarHuerfanas]);

  const cerrar = useCallback(() => {
    onClose();
    if (huboCambios) onCambio?.();
  }, [onClose, onCambio, huboCambios]);

  return (
    <ModalBase isOpen onClose={cerrar} size="lg" title="Planillas sin partido">
      <div className="space-y-4 p-1">
        {!reasignando && (
          <>
            <p className="text-sm text-slate-600">
              Estas planillas quedaron apuntando a un partido que ya no existe — se borró, pero los
              datos que cargaste siguen acá. Elegí a qué partido pertenecen en realidad.
            </p>

            {cargando ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : huerfanas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No tenés planillas huérfanas.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {huerfanas.map((pl) => (
                  <li key={pl._id}>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">Planilla {pl.modo === 'sets' ? 'set a set' : 'directa'}</p>
                        <p className="text-xs text-slate-500">
                          {pl.estado} · última edición {formatDateTime(pl.updatedAt ?? pl.createdAt ?? '')}
                        </p>
                      </div>
                      {pl.estado === 'borrador' ? (
                        <button
                          type="button"
                          onClick={() => void empezarReasignacion(pl)}
                          className="shrink-0 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          Reasignar
                        </button>
                      ) : (
                        <span
                          className="shrink-0 text-xs text-slate-400"
                          title="Sólo se puede reasignar una planilla en borrador"
                        >
                          No editable
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {reasignando && !destino && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setReasignando(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              ← Volver a la lista
            </button>
            <p className="text-sm text-slate-600">
              Elegí la competencia y después el partido correcto para esta planilla.
            </p>

            {cargandoCompetencias ? (
              <p className="text-sm text-slate-500">Cargando tus competencias…</p>
            ) : competencias.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Tu equipo no está inscripto (aceptado) en ninguna competencia todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {competencias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void elegirCompetencia(c.id)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}

            {cargandoPartidos ? (
              <p className="text-sm text-slate-500">Cargando partidos…</p>
            ) : partidosOrdenados.length > 0 ? (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {partidosOrdenados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setDestino(p)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <span className="font-medium text-slate-800">
                        {p.equipoLocal?.nombre ?? 'Local'} vs {p.equipoVisitante?.nombre ?? 'Visitante'}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{formatDateTime(p.fechaISO ?? p.fecha)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {reasignando && destino && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Confirmá la reasignación</p>
              <p className="mt-1">
                La planilla va a pasar a pertenecer a{' '}
                <strong>
                  {destino.equipoLocal?.nombre ?? 'Local'} vs {destino.equipoVisitante?.nombre ?? 'Visitante'}
                </strong>{' '}
                ({formatDateTime(destino.fechaISO ?? destino.fecha)}). Los presentes, sets y estadísticas se
                mantienen tal cual los cargaste.
              </p>
            </div>

            {conflicto && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-semibold">No se puede reasignar a ese partido</p>
                <p className="mt-1">
                  Esta planilla tiene jugadores de{' '}
                  {conflicto.equipos.map((e) => e.nombre ?? 'un equipo').join(', ')} cargados, y ese equipo no
                  juega el partido elegido — esos datos quedarían sin nada oficial contra qué compararse. Elegí
                  otro partido, o quitá esos presentes antes de reasignar.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDestino(null);
                  setConflicto(null);
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Elegir otro partido
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={() => void confirmarReasignacion()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? 'Reasignando…' : 'Sí, reasignar la planilla'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default ModalPlanillasHuerfanas;
