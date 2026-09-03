import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { formatDateTime } from '../../../shared/utils/formatDate';
import { getSetsConEstadisticas, type SetConEstadisticas } from '../services/estadisticasService';
import {
  obtenerPlanilla,
  totalizarPorPresente,
  type PlanillaCompleta,
} from '../../partidos/services/planillaEquipoService';
import {
  setFuentePreferida,
  type FuenteDatos,
  type PartidoTimeline,
} from '../services/timelineService';

type Props = {
  partido: PartidoTimeline;
  equipoId: string;
  onClose: () => void;
  /** Abre la captura correspondiente a la fuente que se está mirando. */
  onEditar: (partido: PartidoTimeline, fuente: FuenteDatos) => void;
  /** Para que la línea temporal refleje un cambio de fuente preferida. */
  onCambio?: () => void | Promise<void>;
};

type Fila = { nombre: string; throws: number; hits: number; outs: number; catches: number; sets: number };

const nombreDeJugador = (j: SetConEstadisticas['estadisticas'][number]['jugador']): string => {
  if (!j) return 'Jugador';
  return [j.nombre, j.apellido].filter(Boolean).join(' ').trim() || 'Jugador';
};

/**
 * Visor de un partido: el contrapunto de solo lectura de los modales de captura.
 *
 * Existe porque hasta ahora la única forma de ver lo que se había cargado era abrir el modal
 * que sirve para editarlo — con sus botones de guardar y de oficializar— aunque uno sólo
 * quisiera mirar, y aunque no tuviera permiso para escribir. Acá se mira; el botón de editar
 * es una salida explícita hacia el modal que corresponda.
 *
 * Cuando el partido tiene las dos fuentes, arriba se elige cuál se está viendo, y esa
 * elección es la misma que decide qué alimenta el análisis del equipo: no son dos ajustes
 * distintos, para no tener que explicar por qué mirás una cosa y se suma otra.
 */
const ModalVisorPartido = ({ partido, equipoId, onClose, onEditar, onCambio }: Props) => {
  const { addToast } = useToast();
  const { oficial, planilla } = partido.datos;
  const hayDosFuentes = oficial.existe && Boolean(planilla);

  const [fuente, setFuente] = useState<FuenteDatos>(
    partido.datos.fuenteEfectiva === 'planilla' ? 'planilla' : 'oficial',
  );
  const [sets, setSets] = useState<SetConEstadisticas[] | null>(null);
  const [planillaCompleta, setPlanillaCompleta] = useState<PlanillaCompleta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardandoFuente, setGuardandoFuente] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setCargando(true);
      try {
        if (fuente === 'oficial') {
          if (!oficial.existe) return;
          const data = await getSetsConEstadisticas(partido._id);
          if (!cancelado) setSets(data);
        } else {
          if (!planilla) return;
          const data = await obtenerPlanilla(planilla._id);
          if (!cancelado) setPlanillaCompleta(data);
        }
      } catch (error) {
        if (!cancelado) {
          addToast({
            type: 'error',
            title: 'No pudimos cargar las estadísticas',
            message: error instanceof Error ? error.message : 'Error inesperado',
          });
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [fuente, partido._id, oficial.existe, planilla, addToast]);

  /** Filas del equipo propio, sumando todos los sets. El visor es del equipo, no del partido. */
  const filas = useMemo<Fila[]>(() => {
    if (fuente === 'oficial') {
      if (!sets) return [];
      const acc = new Map<string, Fila>();
      for (const set of sets) {
        for (const stat of set.estadisticas ?? []) {
          // Sólo el propio equipo: el otro lado puede tener estadísticas que no son asunto
          // de este panel, y mezclarlas haría que los totales no cierren con nada.
          if (stat.equipo?._id && String(stat.equipo._id) !== String(equipoId)) continue;
          const nombre = nombreDeJugador(stat.jugador);
          const fila = acc.get(nombre) ?? { nombre, throws: 0, hits: 0, outs: 0, catches: 0, sets: 0 };
          fila.throws += stat.throws ?? 0;
          fila.hits += stat.hits ?? 0;
          fila.outs += stat.outs ?? 0;
          fila.catches += stat.catches ?? 0;
          fila.sets += 1;
          acc.set(nombre, fila);
        }
      }
      return [...acc.values()].sort((a, b) => b.hits - a.hits || a.nombre.localeCompare(b.nombre, 'es'));
    }

    if (!planillaCompleta) return [];
    const totales = totalizarPorPresente(planillaCompleta);
    return planillaCompleta.presentes
      .map((presente) => {
        const t = totales[presente._id];
        const j = presente.jugador;
        const nombre =
          !j || typeof j === 'string'
            ? 'Jugador'
            : j.alias || [j.nombre, j.apellido].filter(Boolean).join(' ').trim() || 'Jugador';
        return t
          ? { nombre, throws: t.throws, hits: t.hits, outs: t.outs, catches: t.catches, sets: t.sets }
          : null;
      })
      .filter((f): f is Fila => f !== null)
      .sort((a, b) => b.hits - a.hits || a.nombre.localeCompare(b.nombre, 'es'));
  }, [fuente, sets, planillaCompleta, equipoId]);

  const cambiarFuente = useCallback(
    async (nueva: FuenteDatos) => {
      setFuente(nueva);
      if (!planilla || !hayDosFuentes) return;

      setGuardandoFuente(true);
      try {
        await setFuentePreferida(planilla._id, nueva);
        await Promise.resolve(onCambio?.());
        addToast({
          type: 'success',
          title: nueva === 'planilla' ? 'Usando tu planilla' : 'Usando lo oficial',
          message:
            nueva === 'planilla'
              ? 'Este partido va a contar con los números de tu planilla en el análisis del equipo.'
              : 'Este partido vuelve a contar con los números oficiales de la competencia.',
        });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'No pudimos guardar la preferencia',
          message: error instanceof Error ? error.message : 'Error inesperado',
        });
      } finally {
        setGuardandoFuente(false);
      }
    },
    [planilla, hayDosFuentes, onCambio, addToast],
  );

  const sinDatos = partido.datos.fuenteEfectiva === 'sin_datos';

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      size="xl"
      title={`${partido.esLocal ? 'vs' : '@'} ${partido.rival?.nombre ?? 'Rival'}`}
      subtitle={`${formatDateTime(partido.fecha)} · ${partido.competencia?.nombre ?? 'Amistoso'} · ${partido.modalidad}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {fuente === 'oficial'
              ? 'Datos oficiales de la competencia.'
              : 'Captura propia del equipo. No es dato oficial.'}
          </p>
          <button
            type="button"
            onClick={() => onEditar(partido, fuente)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {sinDatos ? 'Cargar estadísticas' : 'Editar esta fuente'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {partido.marcadorEquipo}–{partido.marcadorRival}
          </span>
          <span className="text-xs text-slate-500">
            {partido.esLocal ? 'Local' : 'Visitante'}
            {partido.ubicacion ? ` · ${partido.ubicacion}` : ''}
          </span>
        </div>

        {hayDosFuentes && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="text-xs font-semibold text-brand-900">
              Este partido tiene dos versiones de los datos
            </p>
            <p className="mt-0.5 text-xs text-brand-800/80">
              Elegí cuál mirás acá y cuál cuenta en el análisis del equipo. No modifica el
              registro oficial de la competencia.
            </p>
            <div className="mt-2 flex gap-2">
              {(['oficial', 'planilla'] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  disabled={guardandoFuente}
                  onClick={() => void cambiarFuente(opcion)}
                  aria-pressed={fuente === opcion}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 [touch-action:manipulation] ${
                    fuente === opcion
                      ? 'bg-brand-600 text-white'
                      : 'border border-brand-300 bg-white text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  {opcion === 'oficial' ? 'Oficial' : 'Mi planilla'}
                </button>
              ))}
            </div>
          </div>
        )}

        {sinDatos ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            Este partido todavía no tiene estadísticas ni planilla propia.
          </div>
        ) : cargando ? (
          <p className="py-6 text-center text-sm text-slate-500">Cargando estadísticas…</p>
        ) : filas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No hay estadísticas de tu equipo en esta fuente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">Jugador</th>
                  <th className="pb-2 pr-3 text-right">Sets</th>
                  <th className="pb-2 pr-3 text-right">Throws</th>
                  <th className="pb-2 pr-3 text-right">Hits</th>
                  <th className="pb-2 pr-3 text-right">Outs</th>
                  <th className="pb-2 text-right">Catches</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {filas.map((fila) => (
                  <tr key={fila.nombre} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 text-slate-800">{fila.nombre}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-500">{fila.sets}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-600">{fila.throws}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-slate-800">{fila.hits}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-600">{fila.outs}</td>
                    <td className="py-1.5 text-right text-slate-600">{fila.catches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fuente === 'oficial' && oficial.existe && !oficial.verificada && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Estas estadísticas están cargadas pero todavía no fueron aprobadas por la
            organización.
          </p>
        )}
      </div>
    </ModalBase>
  );
};

export default ModalVisorPartido;
