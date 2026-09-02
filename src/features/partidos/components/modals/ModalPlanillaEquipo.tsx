import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { ListaJugadores } from './ListaJugadores';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import {
  JUGADORES_POR_SET,
  ESTADISTICAS_SLOT_VACIO,
  completarSlots,
  type EstadisticasSlot,
} from '../../constants/capturaSet';
import {
  obtenerPlanillaDePartido,
  obtenerPlanilla,
  crearPlanilla,
  guardarSet,
  guardarEstadisticas,
  solicitarOficializacion,
  cancelarOficializacion,
  totalizarPorPresente,
  type PlanillaCompleta,
  type PlanillaModo,
  type PlanillaPresente,
  type PlanillaSet as PlanillaSetTipo,
} from '../../services/planillaEquipoService';
import { extractEquipoNombre, type PartidoDetallado } from '../../services/partidoService';

/**
 * Captura del equipo sobre un partido propio.
 *
 * A diferencia de ModalCapturaSetEstadisticas y ModalEstadisticasDirectasCaptura, este
 * modal NO depende de que existan sets ni convocatoria oficiales: la planilla trae los
 * suyos. Por eso sirve para partidos ya finalizados que la organización cargó solo con
 * el marcador. Nada de lo que se guarda acá toca el registro oficial hasta que el
 * organizador aprueba la oficialización.
 */

interface Props {
  partidoId: string;
  equipoId: string;
  equipoNombre?: string;
  /** Necesario para nombrar a los equipos en el selector de ganador de cada set. */
  partido?: PartidoDetallado | null;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
}

/**
 * Un slot de la grilla. `presenteId` es quién ocupa ese lugar en cancha este set;
 * vacío significa que todavía no se eligió. Son JUGADORES_POR_SET slots fijos, igual
 * que en la captura set a set del partido, para que las dos vistas se lean igual.
 */
type Slot = { presenteId?: string; estadisticas: EstadisticasSlot };

const slotVacio = (): Slot => ({ estadisticas: { ...ESTADISTICAS_SLOT_VACIO } });

const slotsVacios = (): Slot[] =>
  Array.from({ length: JUGADORES_POR_SET }, slotVacio);

const nombrePresente = (presente: PlanillaPresente): string => {
  const j = presente.jugador;
  if (!j) return 'Jugador';
  if (typeof j === 'string') return 'Jugador';
  return j.alias || [j.nombre, j.apellido].filter(Boolean).join(' ') || 'Jugador';
};

const ModalPlanillaEquipo: React.FC<Props> = ({
  partidoId,
  equipoId,
  equipoNombre,
  partido,
  onClose,
  onRefresh,
}) => {
  const { addToast } = useToast();
  const [planilla, setPlanilla] = useState<PlanillaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [modoNuevo, setModoNuevo] = useState<PlanillaModo>('sets');
  const [setActivoId, setSetActivoId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>(slotsVacios);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const resumen = await obtenerPlanillaDePartido(equipoId, partidoId);
      if (!resumen) {
        setPlanilla(null);
        return;
      }
      const completa = await obtenerPlanilla(resumen._id);
      setPlanilla(completa);
      if (completa.modo === 'sets') {
        setSetActivoId((prev) => prev ?? completa.sets[0]?._id ?? null);
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo cargar la planilla',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setLoading(false);
    }
  }, [equipoId, partidoId, addToast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Los slots en pantalla siempre reflejan el set activo (o los totales, en modo
  // directa). Al cambiar de set se recargan desde lo guardado.
  useEffect(() => {
    if (!planilla) {
      setSlots(slotsVacios());
      return;
    }

    const filas = planilla.estadisticas.filter((e) =>
      planilla.modo === 'sets' ? e.planillaSet === setActivoId : e.planillaSet === null,
    );

    const ocupados: Slot[] = filas.map((fila) => ({
      presenteId: fila.planillaPresente,
      estadisticas: {
        throws: fila.throws ?? 0,
        hits: fila.hits ?? 0,
        outs: fila.outs ?? 0,
        catches: fila.catches ?? 0,
        survive: Boolean(fila.survive),
      },
    }));

    setSlots(completarSlots(ocupados, slotVacio));
  }, [planilla, setActivoId]);

  const editable = planilla?.estado === 'borrador' || planilla?.estado === 'rechazada';

  const totales = useMemo(
    () => (planilla ? totalizarPorPresente(planilla) : {}),
    [planilla],
  );

  // ListaJugadores lo usa para cargar el plantel cuando no recibe opciones. Acá siempre
  // se las pasamos, así que no llega a consultarlo, pero el prop es obligatorio.
  const equipoIdDePlanilla = useMemo(() => {
    if (!planilla) return equipoId;
    return typeof planilla.equipo === 'string' ? planilla.equipo : planilla.equipo._id;
  }, [planilla, equipoId]);

  const crear = async (): Promise<void> => {
    setCreando(true);
    try {
      const nueva = await crearPlanilla({
        partido: partidoId,
        equipo: equipoId,
        modo: modoNuevo,
        autocompletarPresentes: true,
      });
      setPlanilla(nueva);
      setSetActivoId(nueva.sets[0]?._id ?? null);
      addToast({
        type: 'success',
        title: 'Planilla creada',
        message: 'Cargá los sets y las estadísticas. Nada de esto afecta los datos oficiales.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo crear la planilla',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setCreando(false);
    }
  };

  const nombreLocal = useMemo(
    () => extractEquipoNombre(partido?.equipoLocal, 'Local'),
    [partido],
  );
  const nombreVisitante = useMemo(
    () => extractEquipoNombre(partido?.equipoVisitante, 'Visitante'),
    [partido],
  );

  const setActivo = useMemo(
    () => planilla?.sets.find((s) => s._id === setActivoId) ?? null,
    [planilla, setActivoId],
  );

  /**
   * Sin ganador el set se oficializa como 'pendiente', y al oficializar se crea un
   * SetPartido en estado 'en_juego' dentro de un partido finalizado. Peor: el marcador
   * del partido se deriva de los sets FINALIZADOS, así que un recálculo posterior los
   * contaría como cero. Registrar el ganador acá es lo que cierra ese agujero.
   */
  const cambiarGanador = async (ganadorSet: PlanillaSetTipo['ganadorSet']): Promise<void> => {
    if (!planilla || !setActivo) return;
    try {
      await guardarSet(planilla._id, { numeroSet: setActivo.numeroSet, ganadorSet });
      const completa = await obtenerPlanilla(planilla._id);
      setPlanilla(completa);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo guardar el resultado del set',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  };

  const agregarSet = async (): Promise<void> => {
    if (!planilla) return;
    const siguiente = (planilla.sets.reduce((max, s) => Math.max(max, s.numeroSet), 0) || 0) + 1;
    try {
      const creado = await guardarSet(planilla._id, { numeroSet: siguiente });
      const completa = await obtenerPlanilla(planilla._id);
      setPlanilla(completa);
      setSetActivoId(creado._id);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo agregar el set',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  };

  const asignarJugador = (index: number, presenteId: string): void => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], presenteId: presenteId || undefined };
      return next;
    });
  };

  const cambiarEstadistica = (
    index: number,
    campo: 'throws' | 'hits' | 'outs' | 'catches',
    delta: number,
  ): void => {
    setSlots((prev) => {
      const next = [...prev];
      const actual = next[index];
      next[index] = {
        ...actual,
        estadisticas: {
          ...actual.estadisticas,
          [campo]: Math.max(0, (actual.estadisticas[campo] ?? 0) + delta),
        },
      };
      return next;
    });
  };

  const cambiarSurvive = (index: number, value: boolean): void => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        estadisticas: { ...next[index].estadisticas, survive: value },
      };
      return next;
    });
  };

  const guardar = async (): Promise<void> => {
    if (!planilla) return;
    if (planilla.modo === 'sets' && !setActivoId) {
      addToast({ type: 'error', title: 'Elegí un set', message: 'Agregá o seleccioná un set antes de guardar' });
      return;
    }

    setGuardando(true);
    try {
      // Solo los slots con jugador asignado. Un slot vacío no es un jugador en cero:
      // es un lugar que todavía no se completó, y no debe generar una fila.
      const filas = slots
        .filter((s): s is Slot & { presenteId: string } => Boolean(s.presenteId))
        .map((s) => ({
          planillaPresente: s.presenteId,
          throws: s.estadisticas.throws,
          hits: s.estadisticas.hits,
          outs: s.estadisticas.outs,
          catches: s.estadisticas.catches,
          survive: s.estadisticas.survive,
        }));

      if (!filas.length) {
        addToast({
          type: 'error',
          title: 'Nada para guardar',
          message: 'Asigná al menos un jugador a la grilla',
        });
        return;
      }

      await guardarEstadisticas(planilla._id, {
        planillaSet: planilla.modo === 'sets' ? setActivoId : null,
        estadisticas: filas,
      });

      const completa = await obtenerPlanilla(planilla._id);
      setPlanilla(completa);
      addToast({ type: 'success', title: 'Planilla guardada', message: 'Los datos oficiales no se modificaron' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo guardar',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setGuardando(false);
    }
  };

  const oficializar = async (): Promise<void> => {
    if (!planilla) return;
    setGuardando(true);
    try {
      const resultado = await solicitarOficializacion(planilla._id);
      const completa = await obtenerPlanilla(planilla._id);
      setPlanilla(completa);
      await Promise.resolve(onRefresh?.());

      addToast({
        type: 'success',
        title: resultado.oficializada ? 'Planilla oficializada' : 'Solicitud enviada',
        message: resultado.oficializada
          ? 'Como es un amistoso, no hacía falta aprobación de nadie.'
          : 'La organización tiene que aprobarla para que pase a ser dato oficial.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo solicitar la oficialización',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (): Promise<void> => {
    if (!planilla) return;
    setGuardando(true);
    try {
      await cancelarOficializacion(planilla._id);
      const completa = await obtenerPlanilla(planilla._id);
      setPlanilla(completa);
      addToast({ type: 'success', title: 'Solicitud retirada', message: 'Podés volver a editar la planilla' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo retirar la solicitud',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setGuardando(false);
    }
  };

  const subtitulo = equipoNombre
    ? `${equipoNombre} · captura propia, no afecta los datos oficiales`
    : 'Captura propia del equipo, no afecta los datos oficiales';

  return (
    <ModalBase title="Mi planilla" subtitle={subtitulo} onClose={onClose} size="xl" isOpen>
      {loading ? (
        <div className="py-10 text-center text-gray-600">Cargando planilla...</div>
      ) : !planilla ? (
        <div className="space-y-5 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Todavía no tenés planilla de este partido. La planilla es tuya: podés cargar sets,
            presentes y estadísticas aunque el partido esté finalizado y la organización no haya
            cargado nada. El registro oficial de la competencia no se modifica.
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">¿Cómo querés cargarla?</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModoNuevo('sets')}
                className={`rounded-lg border p-4 text-left transition ${
                  modoNuevo === 'sets'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="block font-semibold text-gray-900">Set a set</span>
                <span className="mt-1 block text-sm text-gray-600">
                  Desglose por set. Es lo que permite analizar rendimiento dentro del partido.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModoNuevo('directa')}
                className={`rounded-lg border p-4 text-left transition ${
                  modoNuevo === 'directa'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="block font-semibold text-gray-900">Totales del partido</span>
                <span className="mt-1 block text-sm text-gray-600">
                  Un solo número por jugador. Más rápido si no tenés el detalle por set.
                </span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={crear}
            disabled={creando}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {creando ? 'Creando...' : 'Crear planilla con mi plantel'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {planilla.estado === 'pendiente_oficializacion' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <span>Esperando que la organización apruebe la oficialización. Mientras tanto no se puede editar.</span>
              <button
                type="button"
                onClick={cancelar}
                disabled={guardando}
                className="rounded-md border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                Retirar solicitud
              </button>
            </div>
          )}

          {planilla.estado === 'oficializada' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              Esta planilla ya fue adoptada como dato oficial de la competencia. Queda como registro
              y no admite más cambios.
            </div>
          )}

          {planilla.estado === 'rechazada' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              La organización rechazó la oficialización. La planilla sigue siendo tuya: podés
              corregirla y volver a pedirla.
            </div>
          )}

          {planilla.modo === 'sets' && (
            <div className="flex flex-wrap items-center gap-2">
              {planilla.sets.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => setSetActivoId(s._id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    setActivoId === s._id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Set {s.numeroSet}
                </button>
              ))}
              {editable && (
                <button
                  type="button"
                  onClick={agregarSet}
                  className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-800"
                >
                  + Agregar set
                </button>
              )}
            </div>
          )}

          {planilla.modo === 'sets' && setActivo && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <label
                htmlFor="ganador-set-planilla"
                className="text-sm font-medium text-gray-700"
              >
                ¿Quién ganó el set {setActivo.numeroSet}?
              </label>
              <select
                id="ganador-set-planilla"
                value={setActivo.ganadorSet}
                disabled={!editable}
                onChange={(e) =>
                  void cambiarGanador(e.target.value as PlanillaSetTipo['ganadorSet'])
                }
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="pendiente">Sin definir</option>
                <option value="local">{nombreLocal}</option>
                <option value="visitante">{nombreVisitante}</option>
                <option value="empate">Empate</option>
              </select>
              {setActivo.ganadorSet === 'pendiente' && (
                <span className="text-xs text-amber-700">
                  Sin esto el set queda como no jugado si alguna vez se oficializa.
                </span>
              )}
            </div>
          )}

          {planilla.presentes.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              La planilla no tiene jugadores. Revisá que tu plantel tenga contratos aceptados.
            </div>
          ) : planilla.modo === 'sets' && !setActivoId ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Agregá un set para empezar a cargar estadísticas.
            </div>
          ) : (
            <div>
              <p className="mb-1 text-xs text-slate-500">
                {JUGADORES_POR_SET} en cancha
                {planilla.modo === 'sets' ? ' en este set' : ''}. Elegí quiénes jugaron y cargá sus
                números.
              </p>
              {/* Misma grilla que usa la captura set a set del partido, para que las dos
                  vistas se lean igual. Acá las opciones son los presentes de la planilla
                  (id de PlanillaPresente), no jugadores sueltos. */}
              <ListaJugadores
                equipoNombre={equipoNombre ?? 'Mi equipo'}
                equipoId={equipoIdDePlanilla}
                token=""
                estadisticasJugador={slots.map((s) => ({
                  jugadorId: s.presenteId,
                  estadisticas: s.estadisticas,
                }))}
                opcionesJugadores={planilla.presentes.map((p) => ({
                  value: p._id,
                  label: nombrePresente(p),
                }))}
                onAsignarJugador={(index, presenteId) => {
                  if (editable) asignarJugador(index, presenteId);
                }}
                onCambiarEstadistica={(index, campo, delta) => {
                  if (editable) cambiarEstadistica(index, campo, delta);
                }}
                onCambiarSurvive={(index, value) => {
                  if (editable) cambiarSurvive(index, value);
                }}
              />
            </div>
          )}

          {Object.keys(totales).length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                Totales del partido según esta planilla
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-3">Jugador</th>
                      <th className="pb-2 pr-3 text-right">Throws</th>
                      <th className="pb-2 pr-3 text-right">Hits</th>
                      <th className="pb-2 pr-3 text-right">Outs</th>
                      <th className="pb-2 text-right">Catches</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {planilla.presentes.map((presente) => {
                      const t = totales[presente._id];
                      if (!t) return null;
                      return (
                        <tr key={presente._id} className="border-b border-gray-200 last:border-0">
                          <td className="py-1.5 pr-3 text-gray-800">{nombrePresente(presente)}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-600">{t.throws}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-600">{t.hits}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-600">{t.outs}</td>
                          <td className="py-1.5 text-right text-gray-600">{t.catches}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {editable && (
            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={oficializar}
                disabled={guardando}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Pedir que sea oficial
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      )}
    </ModalBase>
  );
};

export default ModalPlanillaEquipo;
