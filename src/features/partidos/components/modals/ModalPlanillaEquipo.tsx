import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import JugadorEstadisticasCard from '../common/JugadorEstadisticasCard';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
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
} from '../../services/planillaEquipoService';

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
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
}

type Valores = { throws: number; hits: number; outs: number; catches: number; survive: boolean };

const VACIO: Valores = { throws: 0, hits: 0, outs: 0, catches: 0, survive: false };

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
  const [valores, setValores] = useState<Record<string, Valores>>({});

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

  // Los contadores en pantalla siempre reflejan el set activo (o los totales, en modo
  // directa). Al cambiar de set se recargan desde lo guardado.
  useEffect(() => {
    if (!planilla) return;
    const filas = planilla.estadisticas.filter((e) =>
      planilla.modo === 'sets' ? e.planillaSet === setActivoId : e.planillaSet === null,
    );
    const mapa: Record<string, Valores> = {};
    for (const fila of filas) {
      mapa[fila.planillaPresente] = {
        throws: fila.throws ?? 0,
        hits: fila.hits ?? 0,
        outs: fila.outs ?? 0,
        catches: fila.catches ?? 0,
        survive: Boolean(fila.survive),
      };
    }
    setValores(mapa);
  }, [planilla, setActivoId]);

  const editable = planilla?.estado === 'borrador' || planilla?.estado === 'rechazada';

  const totales = useMemo(
    () => (planilla ? totalizarPorPresente(planilla) : {}),
    [planilla],
  );

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

  const cambiarEstadistica = (
    presenteId: string,
    campo: 'throws' | 'hits' | 'outs' | 'catches',
    delta: number,
  ): void => {
    setValores((prev) => {
      const actual = prev[presenteId] ?? VACIO;
      return {
        ...prev,
        [presenteId]: { ...actual, [campo]: Math.max(0, (actual[campo] ?? 0) + delta) },
      };
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
      const filas = Object.entries(valores).map(([planillaPresente, v]) => ({
        planillaPresente,
        throws: v.throws,
        hits: v.hits,
        outs: v.outs,
        catches: v.catches,
        survive: v.survive,
      }));

      if (!filas.length) {
        addToast({ type: 'error', title: 'Nada para guardar', message: 'Cargá al menos un jugador' });
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

          {planilla.presentes.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              La planilla no tiene jugadores. Revisá que tu plantel tenga contratos aceptados.
            </div>
          ) : planilla.modo === 'sets' && !setActivoId ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Agregá un set para empezar a cargar estadísticas.
            </div>
          ) : (
            <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
              {planilla.presentes.map((presente, idx) => (
                <JugadorEstadisticasCard
                  key={presente._id}
                  index={idx}
                  jugadorId={presente._id}
                  opcionesJugadores={[{ value: presente._id, label: nombrePresente(presente) }]}
                  onCambiarJugador={() => { /* el plantel se gestiona en el equipo, no acá */ }}
                  onCambiarEstadistica={(campo, delta) =>
                    editable && cambiarEstadistica(presente._id, campo, delta)
                  }
                  onCambiarSurvive={(value) =>
                    editable &&
                    setValores((prev) => ({
                      ...prev,
                      [presente._id]: { ...(prev[presente._id] ?? VACIO), survive: value },
                    }))
                  }
                  estadisticasJugador={valores[presente._id] ?? VACIO}
                />
              ))}
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
