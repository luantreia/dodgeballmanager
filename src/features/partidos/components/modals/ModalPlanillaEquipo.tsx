import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import ConfirmModal from '../../../../shared/components/ConfirmModal/ConfirmModal';
import MenuAcciones from '../../../../shared/components/MenuAcciones/MenuAcciones';
import TablaScroll from '../../../../shared/components/TablaScroll/TablaScroll';
import { ListaJugadores } from './ListaJugadores';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { useDebouncedCallback } from '../../../../shared/hooks/useDebouncedCallback';
import { socket } from '../../../../shared/services/socket';
import { getAccessToken } from '../../../../shared/utils/authFetch';
import type { EstadoGuardadoFila } from '../common/JugadorEstadisticasCard';
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
  eliminarPlanilla,
  eliminarSet,
  quitarPresente,
  eliminarEstadisticaPresente,
  intercambiarEstadisticas,
  totalizarPorPresente,
  type PlanillaCompleta,
  type PlanillaEstadistica,
  type PlanillaModo,
  type PlanillaPresente,
  type PlanillaSet as PlanillaSetTipo,
} from '../../services/planillaEquipoService';
import { extractEquipoNombre, type PartidoDetallado } from '../../services/partidoService';

/**
 * Upsert de una fila dentro de `planilla.estadisticas`, sin tocar el resto — ni el autoguardado
 * por fila ni las actualizaciones que llegan por socket de otra persona cargando la misma
 * planilla tienen que disparar un refetch completo (eso es lo que pisaba capturas sin guardar).
 */
const mergeEstadisticaEnPlanilla = (
  planilla: PlanillaCompleta,
  fila: PlanillaEstadistica,
): PlanillaCompleta => {
  const idx = planilla.estadisticas.findIndex((e) => e._id === fila._id);
  const estadisticas =
    idx >= 0
      ? planilla.estadisticas.map((e, i) => (i === idx ? fila : e))
      : [...planilla.estadisticas, fila];
  return { ...planilla, estadisticas };
};

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
  /**
   * Autoguardado por fila: cada slot de la grilla se guarda solo, ~600ms después de la última
   * edición. `filasGuardando` es lo que muestra el estado de esa fila puntual; el viejo
   * "hay cambios sin guardar" global (más abajo) ahora se deriva de esto en vez de vivir como
   * estado propio, porque la fuente de la verdad es "¿qué filas no confirmó el backend todavía?".
   */
  const [filasGuardando, setFilasGuardando] = useState<Record<number, EstadoGuardadoFila>>({});
  const [eliminando, setEliminando] = useState(false);

  // Refs para leer el estado más fresco desde callbacks que no pueden depender de él sin
  // volver a crearse en cada tecla (el debounce por fila y los listeners de socket).
  const planillaRef = useRef(planilla);
  planillaRef.current = planilla;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const setActivoIdRef = useRef(setActivoId);
  setActivoIdRef.current = setActivoId;
  const filasGuardandoRef = useRef(filasGuardando);
  filasGuardandoRef.current = filasGuardando;

  // "Hay cambios sin guardar" ahora es "hay al menos una fila que el backend todavía no
  // confirmó" — con autoguardado, ya no depende de que alguien se acuerde de tocar "Guardar".
  const hayCambiosSinGuardar = useMemo(
    () => Object.values(filasGuardando).some((estado) => estado !== 'guardado'),
    [filasGuardando],
  );
  /**
   * Un solo `ConfirmModal` para los tres borrados (planilla, set y presente). Todos destruyen
   * estadísticas ya cargadas y ninguno se puede deshacer, así que ninguno se dispara directo
   * desde el click.
   */
  const [confirmacion, setConfirmacion] = useState<{
    titulo: string;
    mensaje: React.ReactNode;
    confirmLabel: string;
    accion: () => Promise<void>;
  } | null>(null);

  /**
   * Reasignar un slot que ya tenía números es ambiguo: puede ser "este jugador no jugó acá,
   * empezá de cero" o "puse el nombre mal, esos números son del que estoy por elegir ahora".
   * Este estado abre el diálogo que deja elegir entre las dos, en vez de asumir una.
   */
  const [decisionCambioJugador, setDecisionCambioJugador] = useState<{
    index: number;
    presenteAnterior: string;
    nuevoPresenteId: string;
    nombreAnterior: string;
    nombreNuevo: string;
  } | null>(null);

  /** Índice del slot para el que se está por elegir con quién intercambiar sus números. */
  const [intercambioAbierto, setIntercambioAbierto] = useState<number | null>(null);

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

  /**
   * Reconstruye `slots` desde lo que hay guardado. Se llama por `_id`/`modo`/`setActivoId`
   * (ver el efecto de abajo) y no por cada cambio de `planilla.estadisticas` — el autoguardado
   * por fila y las actualizaciones que llegan por socket tocan `planilla.estadisticas` todo el
   * tiempo, y si eso disparara esto se perdería cualquier edición reciente todavía no reflejada
   * en la respuesta del backend. Lee `planillaRef`/`setActivoIdRef` (no los valores del closure)
   * para no tener que declarar `planilla`/`setActivoId` como dependencias de nada.
   */
  const resincronizarSlots = useCallback(() => {
    const actual = planillaRef.current;
    if (!actual) {
      setSlots(slotsVacios());
      setFilasGuardando({});
      return;
    }

    const filas = actual.estadisticas.filter((e) =>
      actual.modo === 'sets' ? e.planillaSet === setActivoIdRef.current : e.planillaSet === null,
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
    setFilasGuardando({});
  }, []);

  // Los slots en pantalla siempre reflejan el set activo (o los totales, en modo directa). Se
  // recargan al abrir la planilla y al cambiar de set — nunca por un cambio de `planilla` que no
  // sea uno de esos dos (ver el comentario en `resincronizarSlots`).
  useEffect(() => {
    resincronizarSlots();
  }, [planilla?._id, planilla?.modo, setActivoId, resincronizarSlots]);

  /**
   * Captura simultánea: cuando otra persona con permiso sobre el equipo tiene esta misma
   * planilla abierta, sus guardados (por fila o del ganador del set) llegan acá por socket y se
   * mergean sin refetch — mismo motivo que en `guardarFilaAhora`/`cambiarGanador`. Si la fila que
   * llegó es una que YO tengo pendiente o en vuelo, se descarta: se prioriza no perder lo que
   * estoy tecleando ahora mismo antes que la versión remota, y cuando mi guardado confirme va a
   * traer el valor correcto de todos modos.
   */
  useEffect(() => {
    const planillaId = planilla?._id;
    if (!planillaId) return;

    const unirse = () => socket.emit('planilla:join', { planillaId, token: getAccessToken() });

    const alEstadisticasActualizadas = (payload: {
      planillaId: string;
      estadisticas: PlanillaEstadistica[];
    }) => {
      if (payload.planillaId !== planillaId) return;

      setPlanilla((prev) => {
        if (!prev) return prev;
        let siguiente = prev;
        payload.estadisticas.forEach((fila) => {
          const indiceLocal = slotsRef.current.findIndex((s) => s.presenteId === fila.planillaPresente);
          const estadoLocal = indiceLocal >= 0 ? filasGuardandoRef.current[indiceLocal] : undefined;
          if (estadoLocal === 'pendiente' || estadoLocal === 'guardando') return;
          siguiente = mergeEstadisticaEnPlanilla(siguiente, fila);
        });
        return siguiente;
      });

      // Lo de arriba alimenta "Totales del partido", pero la grilla interactiva (`slots`) es
      // estado aparte — sin esto, lo que carga otra persona se ve en los totales pero nunca en
      // las tarjetas, ni actualiza los números de alguien ya asignado ni ubica a alguien nuevo.
      setSlots((prev) => {
        const modo = planillaRef.current?.modo;
        const setActivo = setActivoIdRef.current;
        let next = prev;
        let cambio = false;
        payload.estadisticas.forEach((fila) => {
          const esDelSetActivo = modo === 'sets' ? fila.planillaSet === setActivo : fila.planillaSet === null;
          if (!esDelSetActivo) return;

          const idxExistente = next.findIndex((s) => s.presenteId === fila.planillaPresente);
          const estadoLocal = idxExistente >= 0 ? filasGuardandoRef.current[idxExistente] : undefined;
          // No pisar una fila que YO tengo pendiente o en vuelo — mismo criterio que para `planilla`.
          if (estadoLocal === 'pendiente' || estadoLocal === 'guardando') return;

          const estadisticasNuevas: EstadisticasSlot = {
            throws: fila.throws ?? 0,
            hits: fila.hits ?? 0,
            outs: fila.outs ?? 0,
            catches: fila.catches ?? 0,
            survive: Boolean(fila.survive),
          };

          if (idxExistente >= 0) {
            if (!cambio) next = [...next];
            cambio = true;
            next[idxExistente] = { ...next[idxExistente], estadisticas: estadisticasNuevas };
            return;
          }

          // Es un presente que no ocupa ningún slot local todavía (alguien lo asignó recién en
          // otra sesión): se ubica en el primer slot vacío. Si no hay ninguno libre, esta grilla
          // ya está llena con otra gente y no hay dónde mostrarlo — sigue existiendo en
          // "Totales", sólo que no visible acá hasta que se libere un lugar.
          const idxVacio = next.findIndex((s) => !s.presenteId);
          if (idxVacio === -1) return;
          if (!cambio) next = [...next];
          cambio = true;
          next[idxVacio] = { presenteId: fila.planillaPresente, estadisticas: estadisticasNuevas };
        });
        return cambio ? next : prev;
      });
    };

    const alSetActualizado = (payload: { planillaId: string; set: PlanillaSetTipo }) => {
      if (payload.planillaId !== planillaId) return;
      setPlanilla((prev) =>
        prev ? { ...prev, sets: prev.sets.map((s) => (s._id === payload.set._id ? payload.set : s)) } : prev,
      );
    };

    // Cuando otra persona reasigna un slot, su limpieza del jugador anterior (`limpiarFilaAnterior`)
    // también tiene que reflejarse acá — si no, "Totales del partido" sigue mostrando una fila que
    // ya no existe en el backend hasta que se cierre y reabra la planilla.
    const alEstadisticaEliminada = (payload: {
      planillaId: string;
      planillaSet: string | null;
      planillaPresente: string;
    }) => {
      if (payload.planillaId !== planillaId) return;
      setPlanilla((prev) =>
        prev
          ? {
              ...prev,
              estadisticas: prev.estadisticas.filter(
                (e) => !(e.planillaPresente === payload.planillaPresente && e.planillaSet === payload.planillaSet),
              ),
            }
          : prev,
      );

      // Si ese presente ocupaba un slot acá, se vacía — salvo que sea la propia reasignación de
      // este mismo browser haciendo eco (el `findIndex` ya no lo encuentra en ese caso).
      const modo = planillaRef.current?.modo;
      const setActivo = setActivoIdRef.current;
      const esDelSetActivo = modo === 'sets' ? payload.planillaSet === setActivo : payload.planillaSet === null;
      if (!esDelSetActivo) return;

      setSlots((prev) => {
        const idx = prev.findIndex((s) => s.presenteId === payload.planillaPresente);
        if (idx === -1) return prev;
        const estadoLocal = filasGuardandoRef.current[idx];
        if (estadoLocal === 'pendiente' || estadoLocal === 'guardando') return prev;
        const next = [...prev];
        next[idx] = slotVacio();
        return next;
      });
    };

    socket.on('connect', unirse);
    socket.on('planilla:estadisticas_actualizadas', alEstadisticasActualizadas);
    socket.on('planilla:set_actualizado', alSetActualizado);
    socket.on('planilla:estadistica_eliminada', alEstadisticaEliminada);
    if (socket.connected) unirse();
    else socket.connect();

    return () => {
      socket.emit('planilla:leave', { planillaId });
      socket.off('connect', unirse);
      socket.off('planilla:estadisticas_actualizadas', alEstadisticasActualizadas);
      socket.off('planilla:set_actualizado', alSetActualizado);
      socket.off('planilla:estadistica_eliminada', alEstadisticaEliminada);
      socket.disconnect();
    };
  }, [planilla?._id]);

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
   * Filas de `planilla.estadisticas` de este set que ya no corresponden a ningún slot visible.
   * Es el rastro que dejaban los cambios de jugador ANTES de este fix (o cualquier otra causa
   * pasada) — la limpieza automática de `limpiarFilaAnterior` sólo actúa en el momento de
   * reasignar, así que esto es lo que permite ordenar lo que ya quedó guardado de antes.
   */
  const filasHuerfanasDelSet = useMemo(() => {
    if (!planilla) return [];
    const setId = planilla.modo === 'sets' ? setActivoId : null;
    const idsEnSlots = new Set(slots.map((s) => s.presenteId).filter(Boolean));
    return planilla.estadisticas.filter((e) => e.planillaSet === setId && !idsEnSlots.has(e.planillaPresente));
  }, [planilla, setActivoId, slots]);

  /**
   * Guarda UNA fila de la grilla — la clave del autoguardado. El backend ya hace upsert por
   * fila (`{planillaSet, planillaPresente}`), así que mandar un array de una sola entrada no
   * pisa las demás filas de otros jugadores, ni las que esté cargando otra persona a la vez.
   */
  const guardarFilaAhora = useCallback(
    async (index: number) => {
      const planillaActual = planillaRef.current;
      const slot = slotsRef.current[index];
      if (!planillaActual || !slot?.presenteId) return;

      setFilasGuardando((prev) => ({ ...prev, [index]: 'guardando' }));
      try {
        const [guardada] = await guardarEstadisticas(planillaActual._id, {
          planillaSet: planillaActual.modo === 'sets' ? setActivoIdRef.current : null,
          estadisticas: [
            {
              planillaPresente: slot.presenteId,
              throws: slot.estadisticas.throws,
              hits: slot.estadisticas.hits,
              outs: slot.estadisticas.outs,
              catches: slot.estadisticas.catches,
              survive: slot.estadisticas.survive,
            },
          ],
        });
        setFilasGuardando((prev) => ({ ...prev, [index]: 'guardado' }));
        if (guardada) {
          setPlanilla((prev) => (prev ? mergeEstadisticaEnPlanilla(prev, guardada) : prev));
        }
      } catch (error) {
        setFilasGuardando((prev) => ({ ...prev, [index]: 'error' }));
        addToast({
          type: 'error',
          title: 'No se guardó una fila',
          message: error instanceof Error ? error.message : 'Reintentá tocando algo de esa fila',
        });
      }
    },
    [addToast],
  );

  const { debounced: programarGuardadoFila, flushAll: flushAllFilas } = useDebouncedCallback(
    (clave: string) => {
      void guardarFilaAhora(Number(clave));
    },
    600,
  );

  // Si cierran el modal con una edición reciente todavía en el debounce, se fuerza su guardado
  // en vez de perderla — el guard de `hasUnsavedChanges` avisa, pero si igual confirman cerrar,
  // mejor que la última tecleada llegue al backend a que se pierda en silencio.
  useEffect(() => () => flushAllFilas(), [flushAllFilas]);

  /**
   * Sin ganador el set se oficializa como 'pendiente', y al oficializar se crea un
   * SetPartido en estado 'en_juego' dentro de un partido finalizado. Peor: el marcador
   * del partido se deriva de los sets FINALIZADOS, así que un recálculo posterior los
   * contaría como cero. Registrar el ganador acá es lo que cierra ese agujero.
   */
  const cambiarGanador = async (ganadorSet: PlanillaSetTipo['ganadorSet']): Promise<void> => {
    if (!planilla || !setActivo) return;
    try {
      const actualizado = await guardarSet(planilla._id, { numeroSet: setActivo.numeroSet, ganadorSet });
      // Se parchea sólo el set tocado, no se refetchea la planilla entera: un refetch completo
      // reemplaza `estadisticas` por lo último guardado en el backend, y la grilla en pantalla
      // puede tener números que el usuario cargó pero todavía no guardó con el botón "Guardar".
      setPlanilla((prev) =>
        prev ? { ...prev, sets: prev.sets.map((s) => (s._id === actualizado._id ? actualizado : s)) } : prev,
      );
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
    flushAllFilas();
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

  /** Marca la fila como pendiente y programa su autoguardado — común a las tres ediciones. */
  const marcarPendienteYGuardar = (index: number) => {
    setFilasGuardando((prev) => ({ ...prev, [index]: 'pendiente' }));
    programarGuardadoFila(String(index));
  };

  const filaTieneDatos = (estadisticas: EstadisticasSlot): boolean =>
    estadisticas.throws > 0 || estadisticas.hits > 0 || estadisticas.outs > 0 || estadisticas.catches > 0 || estadisticas.survive;

  /**
   * Borra en el backend la fila del presente que se va de este slot — sin esto quedaba huérfana:
   * ya no aparece en ningún slot de la grilla pero seguía sumando en "Totales del partido". No
   * se borra si ese mismo presente sigue ocupando OTRO slot (posible con captura simultánea: dos
   * personas pueden, en teoría, asignarlo a la vez en dos slots antes de sincronizarse).
   */
  const limpiarFilaAnterior = useCallback(
    async (presenteAnterior: string, indexQueSeReasigna: number) => {
      // `slotsRef.current` en este punto todavía es el array VIEJO (el `setSlots` de
      // `asignarJugador` recién se pidió, React no lo aplicó todavía) — por eso se excluye el
      // propio índice que se está reasignando: si no, siempre "encuentra" al jugador anterior
      // ahí mismo y esta función nunca llega a borrar nada.
      if (slotsRef.current.some((s, i) => i !== indexQueSeReasigna && s.presenteId === presenteAnterior)) return;
      const planillaActual = planillaRef.current;
      if (!planillaActual) return;
      const planillaSetId = planillaActual.modo === 'sets' ? setActivoIdRef.current : null;
      try {
        await eliminarEstadisticaPresente(planillaActual._id, presenteAnterior, planillaSetId);
        setPlanilla((prev) =>
          prev
            ? {
                ...prev,
                estadisticas: prev.estadisticas.filter(
                  (e) => !(e.planillaPresente === presenteAnterior && e.planillaSet === planillaSetId),
                ),
              }
            : prev,
        );
      } catch (error) {
        addToast({
          type: 'error',
          title: 'No se pudo limpiar al jugador anterior',
          message: error instanceof Error ? error.message : 'Sus números viejos pueden seguir sumando en los totales',
        });
      }
    },
    [addToast],
  );

  const asignarJugador = (index: number, presenteId: string): void => {
    const anterior = slotsRef.current[index]?.presenteId;
    setSlots((prev) => {
      const next = [...prev];
      // Arranca en cero: si sólo se pisara `presenteId` el nuevo jugador heredaba los números
      // del que estaba antes en este slot — eso es justo el bug que esto soluciona.
      next[index] = { presenteId: presenteId || undefined, estadisticas: { ...ESTADISTICAS_SLOT_VACIO } };
      return next;
    });
    setFilasGuardando((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (anterior && anterior !== presenteId) void limpiarFilaAnterior(anterior, index);
    if (presenteId) marcarPendienteYGuardar(index);
  };

  /**
   * Núcleo común de "mover números a otro jugador" e "intercambiar dos slots": los dos son la
   * misma operación de backend (intercambiar los valores de dos presentes en este set), sólo
   * cambia si uno de los dos lados arrancaba vacío o si los dos ya tenían algo cargado.
   */
  const ejecutarIntercambioBackend = useCallback(
    async (presenteA: string, presenteB: string, indices: number[]) => {
      const planillaActual = planillaRef.current;
      if (!planillaActual) return;
      const planillaSetId = planillaActual.modo === 'sets' ? setActivoIdRef.current : null;

      setFilasGuardando((prev) => {
        const next = { ...prev };
        indices.forEach((i) => {
          next[i] = 'guardando';
        });
        return next;
      });

      try {
        const { presenteA: resultA, presenteB: resultB } = await intercambiarEstadisticas(planillaActual._id, {
          planillaSet: planillaSetId,
          presenteA,
          presenteB,
        });

        setFilasGuardando((prev) => {
          const next = { ...prev };
          indices.forEach((i) => {
            next[i] = 'guardado';
          });
          return next;
        });

        setPlanilla((prev) => {
          if (!prev) return prev;
          let siguiente: PlanillaCompleta = {
            ...prev,
            estadisticas: prev.estadisticas.filter(
              (e) =>
                !((e.planillaPresente === presenteA || e.planillaPresente === presenteB) && e.planillaSet === planillaSetId),
            ),
          };
          if (resultA) siguiente = mergeEstadisticaEnPlanilla(siguiente, resultA);
          if (resultB) siguiente = mergeEstadisticaEnPlanilla(siguiente, resultB);
          return siguiente;
        });
      } catch (error) {
        setFilasGuardando((prev) => {
          const next = { ...prev };
          indices.forEach((i) => {
            next[i] = 'error';
          });
          return next;
        });
        addToast({
          type: 'error',
          title: 'No se pudo mover/intercambiar los números',
          message: error instanceof Error ? error.message : 'Reintentá desde el mismo slot',
        });
      }
    },
    [addToast],
  );

  /**
   * "Puse el nombre mal, esos números en realidad son del que estoy por elegir ahora": los
   * números del slot NO se tocan localmente (ya son los correctos), sólo cambia a quién
   * pertenecen — al revés que `asignarJugador`, que arranca en cero a propósito.
   */
  const asignarJugadorMoviendoNumeros = (index: number, presenteId: string): void => {
    const anterior = slotsRef.current[index]?.presenteId;
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], presenteId: presenteId || undefined };
      return next;
    });
    if (anterior && presenteId && anterior !== presenteId) {
      void ejecutarIntercambioBackend(anterior, presenteId, [index]);
    }
  };

  /**
   * Antes de reasignar, si el slot ya tenía un jugador CON números cargados, la ambigüedad se
   * resuelve preguntando en vez de asumir: puede ser que ese jugador realmente no haya jugado
   * acá (vaciar y empezar de cero), o que el nombre estuviera mal puesto y esos números sean
   * del jugador nuevo (mover, sin perder nada). Sin esto, un cambio de nombre tira datos sin
   * que quede claro qué pasó — que es justo lo que reportó el usuario.
   */
  const solicitarAsignarJugador = (index: number, presenteId: string): void => {
    const actual = slots[index];
    const hayAlgoQuePerder = Boolean(actual?.presenteId) && actual.presenteId !== presenteId && filaTieneDatos(actual.estadisticas);
    if (!hayAlgoQuePerder) {
      asignarJugador(index, presenteId);
      return;
    }
    const presenteAnteriorObj = planilla?.presentes.find((p) => p._id === actual.presenteId);
    const nuevoPresenteObj = planilla?.presentes.find((p) => p._id === presenteId);
    setDecisionCambioJugador({
      index,
      presenteAnterior: actual.presenteId as string,
      nuevoPresenteId: presenteId,
      nombreAnterior: presenteAnteriorObj ? nombrePresente(presenteAnteriorObj) : 'el jugador anterior',
      nombreNuevo: nuevoPresenteObj ? nombrePresente(nuevoPresenteObj) : 'el nuevo jugador',
    });
  };

  /** Abre el selector de con quién intercambiar los números de este slot. */
  const solicitarIntercambio = (index: number): void => {
    if (!slots[index]?.presenteId) return;
    setIntercambioAbierto(index);
  };

  /** Swap explícito entre dos slots YA ocupados — ninguno de los dos cambia de jugador. */
  const confirmarIntercambio = (indexA: number, indexB: number): void => {
    const slotA = slotsRef.current[indexA];
    const slotB = slotsRef.current[indexB];
    if (!slotA?.presenteId || !slotB?.presenteId) return;
    setIntercambioAbierto(null);
    setSlots((prev) => {
      const next = [...prev];
      next[indexA] = { ...next[indexA], estadisticas: prev[indexB].estadisticas };
      next[indexB] = { ...next[indexB], estadisticas: prev[indexA].estadisticas };
      return next;
    });
    void ejecutarIntercambioBackend(slotA.presenteId, slotB.presenteId, [indexA, indexB]);
  };

  /**
   * Limpieza manual de una fila huérfana ya guardada — no dispara la reasignación de ningún
   * slot, así que no pasa por `asignarJugador`. Va con confirmación: es la misma acción
   * destructiva de siempre, sólo que el usuario la pide directamente en vez de que ocurra sola
   * al cambiar un jugador.
   */
  const solicitarLimpiarHuerfana = (presenteId: string, nombre: string): void => {
    setConfirmacion({
      titulo: `Quitar a ${nombre} de este set`,
      mensaje:
        'Ya no está en ningún slot de la grilla, pero sigue sumando en "Totales del partido". Se borra su fila de estadísticas de este set puntual; no se lo saca de la planilla.',
      confirmLabel: 'Quitar del set',
      accion: () => limpiarFilaAnterior(presenteId, -1),
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
    marcarPendienteYGuardar(index);
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
    marcarPendienteYGuardar(index);
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
      // Todo lo que había en pantalla quedó confirmado — no hace falta esperar a que los
      // autoguardados individuales, si alguno seguía en vuelo, lleguen a marcarlo por su cuenta.
      setFilasGuardando((prev) => {
        const next = { ...prev };
        slots.forEach((s, i) => {
          if (s.presenteId) next[i] = 'guardado';
        });
        return next;
      });
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

  /**
   * Estos tres borrados existían en el backend y en `planillaEquipoService` desde siempre, pero
   * no había ningún botón que los llamara: una planilla cargada por error no se podía deshacer
   * desde la app, y vaciarla tampoco servía porque guardar exige al menos un jugador asignado.
   */
  const recargarPlanilla = async (planillaId: string): Promise<void> => {
    const completa = await obtenerPlanilla(planillaId);
    setPlanilla(completa);
  };

  const borrarPlanilla = async (): Promise<void> => {
    if (!planilla) return;
    setEliminando(true);
    try {
      await eliminarPlanilla(planilla._id);
      // Antes de cerrar: si no, la guardia de cambios sin guardar pregunta por datos que
      // acaban de dejar de existir.
      setFilasGuardando({});
      await Promise.resolve(onRefresh?.());
      addToast({
        type: 'success',
        title: 'Planilla eliminada',
        message: 'Se borraron sus sets, presentes y estadísticas. Los datos oficiales no se tocaron.',
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo eliminar la planilla',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setEliminando(false);
    }
  };

  const borrarSet = async (setId: string): Promise<void> => {
    if (!planilla) return;
    setEliminando(true);
    try {
      await eliminarSet(planilla._id, setId);
      const completa = await obtenerPlanilla(planilla._id);
      setPlanilla(completa);
      // Si el set borrado era el que estaba en pantalla hay que mover el foco a otro, o la
      // grilla queda apuntando a un set que ya no existe.
      setSetActivoId((prev) => (prev === setId ? completa.sets[0]?._id ?? null : prev));
      addToast({ type: 'success', title: 'Set eliminado', message: 'Se borraron sus estadísticas.' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo eliminar el set',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setEliminando(false);
    }
  };

  const borrarPresente = async (presenteId: string): Promise<void> => {
    if (!planilla) return;
    setEliminando(true);
    try {
      await quitarPresente(planilla._id, presenteId);
      await recargarPlanilla(planilla._id);
      // Mismo id de planilla y mismo set activo: el efecto automático no reconstruye la
      // grilla solo, y acá si hace falta (el jugador quitado pudo estar ocupando un slot).
      resincronizarSlots();
      addToast({
        type: 'success',
        title: 'Jugador quitado',
        message: 'Se borraron también sus estadísticas en esta planilla.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo quitar al jugador',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setEliminando(false);
    }
  };

  return (
    <ModalBase
      // Antes "Mi planilla" y "MORAN · captura propia, no afecta los datos oficiales" eran dos
      // líneas — la segunda se pliega acá al lado de la primera para no gastar esa fila entera
      // arriba de las tarjetas, que son lo que de verdad hay que ver en una pantalla chica.
      // El título de `ModalBase` crece a `sm:text-2xl` por default (pensado para modales con
      // mucho contenido debajo); acá se lo neutraliza envolviendo TODO en un `span` con su
      // propio tamaño fijo, para que en horizontal (donde sobra ancho pero no alto) el título
      // no crezca y siga ocupando lo mismo.
      title={
        <span className="text-base font-semibold sm:text-base">
          Mi planilla
          {equipoNombre && (
            <span className="ml-1.5 align-middle text-xs font-normal text-slate-400">
              · {equipoNombre}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      size="xl"
      isOpen
      hasUnsavedChanges={hayCambiosSinGuardar}
      unsavedMessage="Hay filas que todavía no se terminaron de guardar. ¿Cerrar igual?"
    >
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
              {/* El botón de borrar va al lado del de seleccionar, no adentro: un <button>
                  anidado en otro es HTML inválido y el click interior no se puede detener. */}
              {planilla.sets.map((s) => {
                const activo = setActivoId === s._id;
                return (
                  <span
                    key={s._id}
                    className={`inline-flex items-stretch overflow-hidden rounded-md ${
                      activo ? 'bg-blue-600' : 'bg-gray-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // Fuerza el guardado de lo que se estaba tecleando en el set que se
                        // abandona, antes de que la grilla se reconstruya para el nuevo.
                        flushAllFilas();
                        setSetActivoId(s._id);
                      }}
                      className={`px-3 py-1.5 text-sm font-medium transition ${
                        activo ? 'text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Set {s.numeroSet}
                    </button>
                    {editable && (
                      <button
                        type="button"
                        disabled={eliminando}
                        aria-label={`Eliminar el set ${s.numeroSet}`}
                        title={`Eliminar el set ${s.numeroSet}`}
                        onClick={() =>
                          setConfirmacion({
                            titulo: `Eliminar el set ${s.numeroSet}`,
                            mensaje: `Se borran las estadísticas que cargaste en este set. Los demás sets de la planilla no se tocan. No se puede deshacer.`,
                            confirmLabel: 'Eliminar set',
                            accion: () => borrarSet(s._id),
                          })
                        }
                        className={`px-2 text-sm font-bold transition disabled:opacity-40 ${
                          activo
                            ? 'text-blue-100 hover:bg-blue-700 hover:text-white'
                            : 'text-gray-400 hover:bg-gray-200 hover:text-rose-600'
                        }`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
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
              {filasHuerfanasDelSet.length > 0 && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">
                    Estos jugadores ya no están en ningún slot de este set, pero sus números
                    siguen sumando en "Totales del partido":
                  </p>
                  <ul className="mt-2 space-y-1">
                    {filasHuerfanasDelSet.map((fila) => {
                      const presente = planilla.presentes.find((p) => p._id === fila.planillaPresente);
                      const nombre = presente ? nombrePresente(presente) : 'Jugador';
                      return (
                        <li key={fila._id} className="flex items-center justify-between gap-2 text-sm text-amber-900">
                          <span>{nombre}</span>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => solicitarLimpiarHuerfana(fila.planillaPresente, nombre)}
                              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                            >
                              Quitar del set
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

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
                estadosGuardado={slots.map((_, i) => filasGuardando[i])}
                onSolicitarIntercambio={solicitarIntercambio}
                onAsignarJugador={(index, presenteId) => {
                  if (editable) solicitarAsignarJugador(index, presenteId);
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

          {/* Los presentes sólo se veían como opciones del desplegable de la grilla, así que no
              había dónde sacar a alguien que se cargó de más (el autocompletado trae el plantel
              entero, incluida gente que no fue al partido). */}
          {editable && planilla.presentes.length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                Jugadores en la planilla ({planilla.presentes.length})
              </summary>
              <ul className="mt-3 divide-y divide-gray-200">
                {planilla.presentes.map((presente) => (
                  <li key={presente._id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-gray-800">{nombrePresente(presente)}</span>
                    <button
                      type="button"
                      disabled={eliminando}
                      onClick={() =>
                        setConfirmacion({
                          titulo: `Quitar a ${nombrePresente(presente)}`,
                          mensaje:
                            'Sale de esta planilla y se borran todas las estadísticas que le hayas cargado, en todos los sets. Su ficha de jugador y el plantel del equipo no se tocan.',
                          confirmLabel: 'Quitar de la planilla',
                          accion: () => borrarPresente(presente._id),
                        })
                      }
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {Object.keys(totales).length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                Totales del partido según esta planilla
              </summary>
              <TablaScroll className="mt-3">
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
              </TablaScroll>
            </details>
          )}

          {/*
            El pie reordenado por peso real, no por orden alfabético de cuándo se agregó cada
            botón:
            - "Eliminar planilla" es rara y destructiva → detrás del "⋯", mismo patrón que ya usa
              PartidosPage para no competir con lo que se usa todos los días.
            - "Guardar ahora" ya casi no hace falta con el autoguardado por fila: pasa a ser un
              botón chico, no el CTA grande de antes.
            - "Pedir oficial" es la única acción que de verdad importa acá — es la que manda el
              trabajo a la organización — así que se queda como la destacada.
            Sigue sin depender de `editable`: la planilla se puede eliminar también mientras
            espera oficialización, y con la oficializada hay que explicar por qué no en vez de
            esconder el botón. Pegado al fondo del área scrolleable (no al final del contenido)
            para no obligar a bajar toda la grilla para llegar acá.
          */}
          <div className="sticky bottom-0 z-10 -mx-4 -mb-3 flex items-center justify-between gap-2
                          border-t border-gray-200 bg-white px-4 py-2
                          pb-[calc(0.5rem+env(safe-area-inset-bottom))]
                          sm:-mx-6 sm:-mb-4 sm:px-6 sm:pb-2">
            {planilla.estado === 'oficializada' ? (
              <p className="text-xs text-gray-500">Oficializada: no se puede eliminar.</p>
            ) : (
              <MenuAcciones
                etiqueta="Más opciones de esta planilla"
                acciones={[
                  {
                    label: eliminando ? 'Eliminando...' : 'Eliminar planilla',
                    tono: 'cuidado',
                    onSelect: () =>
                      setConfirmacion({
                        titulo: 'Eliminar la planilla',
                        mensaje: (
                          <>
                            <p>
                              Se borra la planilla completa: sus sets, los jugadores presentes y
                              todas las estadísticas que cargaste. No se puede deshacer.
                            </p>
                            <p className="mt-2">
                              Los datos oficiales del partido no se tocan
                              {planilla.estado === 'pendiente_oficializacion'
                                ? ', y la solicitud de oficialización pendiente queda sin efecto.'
                                : '.'}
                            </p>
                          </>
                        ),
                        confirmLabel: 'Eliminar planilla',
                        accion: borrarPlanilla,
                      }),
                  },
                ]}
              />
            )}

            {editable && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  title="Cada fila ya se guarda sola; esto fuerza el guardado de todo ahora"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium
                             text-gray-600 transition [touch-action:manipulation]
                             hover:bg-gray-50 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar ahora'}
                </button>
                <button
                  type="button"
                  onClick={oficializar}
                  disabled={guardando}
                  className="min-h-[2.75rem] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold
                             text-white transition [touch-action:manipulation]
                             hover:bg-blue-700 disabled:opacity-50"
                >
                  Pedir oficial
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmacion !== null}
        variant="danger"
        title={confirmacion?.titulo}
        message={confirmacion?.mensaje}
        confirmLabel={confirmacion?.confirmLabel}
        cancelLabel="Cancelar"
        onCancel={() => setConfirmacion(null)}
        onConfirm={async () => {
          const accion = confirmacion?.accion;
          setConfirmacion(null);
          await accion?.();
        }}
      />

      <ModalBase
        isOpen={decisionCambioJugador !== null}
        onClose={() => setDecisionCambioJugador(null)}
        title="Cambiar el jugador de este slot"
        size="sm"
      >
        {decisionCambioJugador && (
          <div className="space-y-4 p-1">
            <p className="text-sm text-slate-700">
              Este slot ya tiene números cargados para {decisionCambioJugador.nombreAnterior}. ¿Qué
              querés hacer al poner a {decisionCambioJugador.nombreNuevo}?
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const { index, nuevoPresenteId } = decisionCambioJugador;
                  setDecisionCambioJugador(null);
                  asignarJugador(index, nuevoPresenteId);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Vaciar y empezar de cero
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  {decisionCambioJugador.nombreAnterior} queda sin fila en este set; {decisionCambioJugador.nombreNuevo}{' '}
                  arranca en cero.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const { index, nuevoPresenteId } = decisionCambioJugador;
                  setDecisionCambioJugador(null);
                  asignarJugadorMoviendoNumeros(index, nuevoPresenteId);
                }}
                className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-left text-sm font-medium text-blue-800 transition hover:bg-blue-100"
              >
                Mover estos números a {decisionCambioJugador.nombreNuevo}
                <span className="mt-0.5 block text-xs font-normal text-blue-700">
                  Los números no cambian, sólo el dueño. {decisionCambioJugador.nombreAnterior} queda sin fila en este
                  set.
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDecisionCambioJugador(null)}
              className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        )}
      </ModalBase>

      <ModalBase
        isOpen={intercambioAbierto !== null}
        onClose={() => setIntercambioAbierto(null)}
        title="Intercambiar con otro jugador"
        size="sm"
      >
        {intercambioAbierto !== null && (
          <div className="space-y-2 p-1">
            <p className="text-sm text-slate-700">
              Elegí con quién intercambiar los números de este slot. Ninguno de los dos cambia de
              jugador — sólo se cruzan los números.
            </p>
            {slots.map((s, i) => {
              if (i === intercambioAbierto || !s.presenteId) return null;
              const presente = planilla?.presentes.find((p) => p._id === s.presenteId);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => confirmarIntercambio(intercambioAbierto, i)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  {presente ? nombrePresente(presente) : 'Jugador'}
                </button>
              );
            })}
            {slots.every((s, i) => i === intercambioAbierto || !s.presenteId) && (
              <p className="text-xs text-slate-500">Todavía no hay otro slot con jugador asignado.</p>
            )}
          </div>
        )}
      </ModalBase>
    </ModalBase>
  );
};

export default ModalPlanillaEquipo;
