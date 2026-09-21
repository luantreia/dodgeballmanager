import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { formatDateTime } from '../../../shared/utils/formatDate';
import { getParticipaciones } from '../../competencias/services/equipoCompetenciaService';
import { getPartidos } from '../../partidos/services/partidoService';
import { crearPlanilla } from '../../partidos/services/planillaEquipoService';
import type { Partido } from '../../../shared/utils/types/types';

type Props = {
  equipoId: string;
  onClose: () => void;
  /** La planilla de scouting ya está creada; falta abrirla para cargar presentes/estadísticas. */
  onCreada: (partidoId: string) => void;
};

/**
 * Elegí una competencia en la que tu equipo está inscripto, después un partido de esa
 * competencia que NO jugaste, y creamos tu planilla de scouting sobre ese partido — para
 * tener con qué comparar aunque la organización (o el rival) no haya cargado nada.
 *
 * A diferencia de "Mi planilla" (que se abre siempre sobre un partido de tu propio
 * historial), acá el punto de partida es la competencia: buscamos los partidos que NO
 * son tuyos entre los que sí tiene esa competencia, para que aparezcan justo los que
 * tiene sentido scoutear.
 */
const ModalScoutearPartido = ({ equipoId, onClose, onCreada }: Props) => {
  const { addToast } = useToast();
  const [paso, setPaso] = useState<'competencia' | 'partido'>('competencia');
  const [competencias, setCompetencias] = useState<Array<{ id: string; nombre: string }>>([]);
  const [cargandoCompetencias, setCargandoCompetencias] = useState(true);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargandoPartidos, setCargandoPartidos] = useState(false);
  const [creando, setCreando] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargandoCompetencias(true);
      try {
        const participaciones = await getParticipaciones({ equipoId });
        if (cancelado) return;
        const aceptadas = participaciones.filter((p) => p.estado === 'aceptado');
        const unicas = new Map(aceptadas.map((p) => [p.competencia.id, p.competencia.nombre]));
        setCompetencias([...unicas.entries()].map(([id, nombre]) => ({ id, nombre })));
      } catch (error) {
        if (!cancelado) {
          addToast({
            type: 'error',
            title: 'No pudimos cargar tus competencias',
            message: error instanceof Error ? error.message : 'Error inesperado',
          });
        }
      } finally {
        if (!cancelado) setCargandoCompetencias(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [equipoId, addToast]);

  const elegirCompetencia = useCallback(
    async (id: string) => {
      setPaso('partido');
      setCargandoPartidos(true);
      try {
        // Sin `equipoId`: queremos TODOS los partidos de la competencia, para filtrar
        // después los que no son nuestros — es justo lo que hay que scoutear.
        const todos = await getPartidos({ competenciaId: id, tipo: 'competencia', limit: 1000 });
        setPartidos(todos.filter((p) => p.equipoLocal?._id !== equipoId && p.equipoVisitante?._id !== equipoId));
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
    [addToast, equipoId],
  );

  const partidosOrdenados = useMemo(
    () => [...partidos].sort((a, b) => (b.fechaISO ?? '').localeCompare(a.fechaISO ?? '')),
    [partidos],
  );

  const elegirPartido = useCallback(
    async (partido: Partido) => {
      setCreando(partido.id);
      try {
        await crearPlanilla({
          partido: partido.id,
          equipo: equipoId,
          modo: 'sets',
          autocompletarPresentes: false,
        });
        onCreada(partido.id);
      } catch (error) {
        addToast({
          type: 'error',
          title: 'No se pudo crear la planilla de scouting',
          message: error instanceof Error ? error.message : 'Error inesperado',
        });
      } finally {
        setCreando(null);
      }
    },
    [equipoId, onCreada, addToast],
  );

  return (
    <ModalBase isOpen onClose={onClose} size="lg" title="Scoutear un partido">
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-600">
          Elegí un partido que no jugaste, de una competencia en la que estás inscripto. Vas a
          poder cargar los números de los dos equipos como referencia propia — no toca el
          registro oficial hasta que pidas oficializarla.
        </p>

        {paso === 'competencia' && (
          <div className="space-y-2">
            {cargandoCompetencias ? (
              <p className="text-sm text-slate-500">Cargando tus competencias…</p>
            ) : competencias.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Tu equipo no está inscripto (aceptado) en ninguna competencia todavía.
              </p>
            ) : (
              competencias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void elegirCompetencia(c.id)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        )}

        {paso === 'partido' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPaso('competencia')}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              ← Elegir otra competencia
            </button>

            {cargandoPartidos ? (
              <p className="text-sm text-slate-500">Cargando partidos…</p>
            ) : partidosOrdenados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No hay partidos ajenos en esta competencia todavía.
              </p>
            ) : (
              <ul className="max-h-96 space-y-1.5 overflow-y-auto">
                {partidosOrdenados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={creando !== null}
                      onClick={() => void elegirPartido(p)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <span className="font-medium text-slate-800">
                        {p.equipoLocal?.nombre ?? 'Local'} vs {p.equipoVisitante?.nombre ?? 'Visitante'}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {creando === p.id ? 'Creando…' : formatDateTime(p.fechaISO ?? p.fecha)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default ModalScoutearPartido;
