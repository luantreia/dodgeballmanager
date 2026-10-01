import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import ConfirmModal from '../../../../shared/components/ConfirmModal/ConfirmModal';
import TablaScroll from '../../../../shared/components/TablaScroll/TablaScroll';
import { ListaJugadores } from './ListaJugadores';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { socket } from '../../../../shared/services/socket';
import { getAccessToken } from '../../../../shared/utils/authFetch';
import { useCapturaAutoguardado } from '../../hooks/useCapturaAutoguardado';
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
  autocompletarPresentesDeEquipo,
  totalizarPorPresente,
  type PlanillaCompleta,
  type PlanillaEstadistica,
  type PlanillaModo,
  type PlanillaPresente,
  type PlanillaSet as PlanillaSetTipo,
} from '../../services/planillaEquipoService';
import { extractEquipoId, extractEquipoNombre, type PartidoDetallado } from '../../services/partidoService';

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
 * Un lugar de la grilla. `presenteId` es de quién son esos números.
 *
 * Cuántos lugares hay depende del modo (ver `capacidadesDeGrupo`): en 'sets' son los
 * JUGADORES_POR_SET de la cancha y un lugar vacío significa que todavía no se eligió quién lo
 * ocupa; en 'directa' hay uno por presente y vienen todos asignados de entrada.
 */
type Slot = { presenteId?: string; estadisticas: EstadisticasSlot };

const slotVacio = (): Slot => ({ estadisticas: { ...ESTADISTICAS_SLOT_VACIO } });

const slotsVaciosPara = (total: number): Slot[] => Array.from({ length: total }, slotVacio);

const nombrePresente = (presente: PlanillaPresente): string => {
  const j = presente.jugador;
  if (!j) return 'Jugador';
  if (typeof j === 'string') return 'Jugador';
  return j.alias || [j.nombre, j.apellido].filter(Boolean).join(' ') || 'Jugador';
};

const idEquipoDePresente = (presente: PlanillaPresente): string | undefined => {
  const eq = presente.equipo;
  if (!eq) return undefined;
  return typeof eq === 'string' ? eq : eq._id;
};

/**
 * Los presentes que le corresponden a un grupo de la grilla. Un presente sin `equipo` explícito
 * (documentos de antes de ese campo) cae en el grupo 0, que `gruposDePlanilla` ya garantiza que
 * es el dueño de la planilla.
 */
const presentesDeGrupo = (
  presentes: PlanillaPresente[],
  grupoId: string,
  grupoIndex: number,
): PlanillaPresente[] =>
  presentes.filter((p) => {
    const idEq = idEquipoDePresente(p);
    return idEq ? idEq === grupoId : grupoIndex === 0;
  });

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
  const [slots, setSlots] = useState<Slot[]>(() => slotsVaciosPara(JUGADORES_POR_SET));
  const [eliminando, setEliminando] = useState(false);

  // Refs para leer el estado más fresco desde callbacks que no pueden depender de él sin
  // volver a crearse en cada tecla (el debounce por fila y los listeners de socket).
  const planillaRef = useRef(planilla);
  planillaRef.current = planilla;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const setActivoIdRef = useRef(setActivoId);
  setActivoIdRef.current = setActivoId;
  /**
   * Autoguardado por fila: cada lugar de la grilla se guarda solo, ~600ms después de la última
   * edición, y muestra su propio estado. El motor (debounce por fila, estados, y la regla de que
   * lo remoto no pisa lo que se está tecleando) es el mismo que usa la captura set a set del
   * partido oficial — ver `useCapturaAutoguardado`. Lo único propio de la planilla es cómo se
   * persiste una fila, que es lo que va acá abajo.
   */
  const {
    estadosDeRango,
    editarFila,
    olvidarFila,
    marcarFilas,
    reset: resetEstadosFilas,
    debeIgnorarRemoto,
    hayFilasSinConfirmar,
    flushAll: flushAllFilas,
  } = useCapturaAutoguardado({
    /**
     * El backend ya hace upsert por fila (`{planillaSet, planillaPresente}`), así que mandar un
     * array de una sola entrada no pisa las filas de otros jugadores, ni las que esté cargando
     * otra persona a la vez.
     */
    persistirFila: useCallback(async (index: number): Promise<boolean> => {
      const planillaActual = planillaRef.current;
      const slot = slotsRef.current[index];
      // Un lugar sin jugador asignado no es un jugador en cero: no hay nada que guardar.
      if (!planillaActual || !slot?.presenteId) return false;

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
      if (guardada) {
        setPlanilla((prev) => (prev ? mergeEstadisticaEnPlanilla(prev, guardada) : prev));
      }
      return true;
    }, []),
    alFallar: useCallback(
      (error: unknown) => {
        addToast({
          type: 'error',
          title: 'No se guardó una fila',
          message: error instanceof Error ? error.message : 'Reintentá tocando algo de esa fila',
        });
      },
      [addToast],
    ),
  });

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

  /**
   * Los dos equipos del partido, para elegir de qué plantel traer presentes. No se
   * asume "mi equipo / el rival": en modo scouting ninguno de los dos es el dueño de
   * la planilla, así que se listan los dos por nombre y se marca el propio si
   * corresponde.
   */
  const equiposDelPartido = useMemo(() => {
    const localId = extractEquipoId(partido?.equipoLocal);
    const visitId = extractEquipoId(partido?.equipoVisitante);
    return [
      { id: localId, nombre: nombreLocal },
      { id: visitId, nombre: nombreVisitante },
    ].filter((e): e is { id: string; nombre: string } => Boolean(e.id));
  }, [partido, nombreLocal, nombreVisitante]);

  /**
   * Los grupos que arma la grilla: uno por cada equipo que tiene presentes cargados en esta
   * planilla. Con un solo equipo (el caso común, sin rival agregado) es un único grupo, igual
   * que siempre. Apenas hay presentes de los dos lados, son dos — cada uno con sus propios
   * lugares (ver `capacidadesDeGrupo`), para no compartir una sola grilla entre dos planteles.
   *
   * El propio equipo va primero cuando es uno de los dos: los presentes viejos sin `equipo`
   * (de antes de que este campo existiera) se tratan como del grupo 0 en `resincronizarSlots`,
   * así que ese grupo tiene que ser siempre el dueño de la planilla, no un orden arbitrario de
   * local/visitante.
   */
  const gruposDePlanilla = useMemo(() => {
    if (!planilla) return [] as Array<{ id: string; nombre: string }>;
    // Un presente sin `equipo` explícito (documentos de antes de ese campo, o de un
    // autocompletado que todavía no lo seteaba) cuenta como del DUEÑO de la planilla — no se
    // descarta: si se descartara, una planilla con presentes propios sin tag y presentes del
    // rival con tag terminaba viendo sólo al rival como "el único equipo con gente cargada".
    const idsConPresente = new Set(
      planilla.presentes.map((p) => idEquipoDePresente(p) ?? equipoIdDePlanilla),
    );
    // Sin ningún presente (planilla recién creada, todavía sin nadie cargado): un solo grupo,
    // el dueño — es la única opción posible en ese caso.
    if (idsConPresente.size === 0) {
      return [{ id: equipoIdDePlanilla, nombre: equipoNombre ?? 'Mi equipo' }];
    }
    if (idsConPresente.size === 1) {
      // OJO: el único equipo con presentes no tiene por qué ser el dueño de la planilla — por
      // ejemplo, si sólo se tocó "Agregar plantel de: [rival]" sin agregar el propio. Usar acá
      // el id del dueño a ciegas dejaba la grilla vacía (los presentes eran del rival, el grupo
      // buscaba al dueño, ninguno calzaba).
      const [unicoId] = idsConPresente;
      const nombreConocido = equiposDelPartido.find((eq) => eq.id === unicoId)?.nombre;
      return [{
        id: unicoId,
        nombre: unicoId === equipoIdDePlanilla ? (equipoNombre ?? nombreConocido ?? 'Mi equipo') : (nombreConocido ?? 'Equipo'),
      }];
    }
    const base = equiposDelPartido.length > 0
      ? equiposDelPartido
      : [...idsConPresente].map((id) => ({ id, nombre: 'Equipo' }));
    return [...base].sort((a, b) => {
      if (a.id === equipoIdDePlanilla) return -1;
      if (b.id === equipoIdDePlanilla) return 1;
      return 0;
    });
  }, [planilla, equipoIdDePlanilla, equipoNombre, equiposDelPartido]);

  const gruposRef = useRef(gruposDePlanilla);
  gruposRef.current = gruposDePlanilla;

  /** En qué grupo cae un presente — por su `equipo`, o el grupo 0 si es de antes de ese campo. */
  const indiceGrupoDePresente = useCallback((presenteId: string): number => {
    const presente = planillaRef.current?.presentes.find((p) => p._id === presenteId);
    const idEquipo = presente ? idEquipoDePresente(presente) : undefined;
    if (!idEquipo) return 0;
    const idx = gruposRef.current.findIndex((g) => g.id === idEquipo);
    return idx === -1 ? 0 : idx;
  }, []);

  /**
   * Cuántas filas tiene cada grupo de la grilla.
   *
   * En modo 'sets' son los JUGADORES_POR_SET de la cancha: ahí el tope es la regla del juego.
   * En modo 'directa' el eje no es quién está en cancha sino quién jugó el partido —a lo largo
   * de varios sets eso puede ser 8, 10 o 12 jugadores—, así que la grilla lista a todos los
   * presentes del grupo y no tiene tope. Antes heredaba los 6 de la captura por set y no había
   * forma de cargarle los números al séptimo jugador de un partido.
   */
  const capacidadesDeGrupo = useMemo<number[]>(() => {
    if (!planilla) return [];
    return gruposDePlanilla.map((grupo, grupoIndex) =>
      planilla.modo === 'sets'
        ? JUGADORES_POR_SET
        : presentesDeGrupo(planilla.presentes, grupo.id, grupoIndex).length,
    );
  }, [planilla, gruposDePlanilla]);

  /**
   * Dónde arranca y dónde termina cada grupo dentro del array plano de `slots`. Con bloques de
   * largo fijo esto era `grupoIndex * JUGADORES_POR_SET`; con bloques de largo variable hay que
   * acumular los largos reales, o el intercambio y el merge por socket ubican las filas en el
   * grupo equivocado — y ahí se terminan cruzando números entre dos planteles distintos.
   */
  const offsetsDeGrupo = useMemo<Array<[number, number]>>(() => {
    const offsets: Array<[number, number]> = [];
    let acumulado = 0;
    capacidadesDeGrupo.forEach((capacidad) => {
      offsets.push([acumulado, acumulado + capacidad]);
      acumulado += capacidad;
    });
    return offsets;
  }, [capacidadesDeGrupo]);

  const offsetsRef = useRef(offsetsDeGrupo);
  offsetsRef.current = offsetsDeGrupo;

  const rangoDeGrupo = useCallback(
    (grupoIndex: number): [number, number] => offsetsRef.current[grupoIndex] ?? [0, 0],
    [],
  );

  /** A qué grupo pertenece un índice absoluto de la grilla. */
  const grupoDeIndice = useCallback((index: number): number => {
    const idx = offsetsRef.current.findIndex(([desde, hasta]) => index >= desde && index < hasta);
    return idx === -1 ? 0 : idx;
  }, []);

  /**
   * Cambia cuando cambia el conjunto de grupos O el largo de cualquiera de ellos. Lo segundo
   * importa en modo 'directa': agregar un presente agranda la grilla, y sin esto el array de
   * slots se quedaba con el largo viejo y el jugador nuevo no aparecía nunca.
   */
  const gruposKey = `${gruposDePlanilla.map((g) => g.id).join(',')}|${capacidadesDeGrupo.join(',')}`;

  // "Hay cambios sin guardar" ahora es "hay al menos una fila que el backend todavía no
  // confirmó" — con autoguardado, ya no depende de que alguien se acuerde de tocar "Guardar".
  const hayCambiosSinGuardar = hayFilasSinConfirmar;
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
    const grupos = gruposRef.current;
    if (!actual || grupos.length === 0) {
      setSlots(slotsVaciosPara(JUGADORES_POR_SET));
      resetEstadosFilas();
      return;
    }

    const presentePorId = new Map(actual.presentes.map((p) => [p._id, p]));
    const filas = actual.estadisticas.filter((e) =>
      actual.modo === 'sets' ? e.planillaSet === setActivoIdRef.current : e.planillaSet === null,
    );

    const estadisticasDeFila = (fila: PlanillaEstadistica): EstadisticasSlot => ({
      throws: fila.throws ?? 0,
      hits: fila.hits ?? 0,
      outs: fila.outs ?? 0,
      catches: fila.catches ?? 0,
      survive: Boolean(fila.survive),
    });

    // Un bloque por grupo, en el mismo orden que `grupos`. El índice absoluto de una fila sale
    // de `offsetsRef` (ver `offsetsDeGrupo`), no de multiplicar por un largo fijo.
    const bloques: Slot[][] = grupos.map((grupo, grupoIndex) => {
      // Modo 'directa': una fila por presente del grupo, estén o no cargados sus números. Acá no
      // hay nada que elegir —la pregunta no es quién estaba en cancha sino cuánto hizo cada uno
      // en todo el partido—, así que la grilla muestra el plantel entero y no tiene tope.
      if (actual.modo === 'directa') {
        const filaPorPresente = new Map(filas.map((fila) => [fila.planillaPresente, fila]));
        return presentesDeGrupo(actual.presentes, grupo.id, grupoIndex).map((presente) => {
          const fila = filaPorPresente.get(presente._id);
          return {
            presenteId: presente._id,
            estadisticas: fila ? estadisticasDeFila(fila) : { ...ESTADISTICAS_SLOT_VACIO },
          };
        });
      }

      // Modo 'sets': los JUGADORES_POR_SET lugares de la cancha. Sólo ocupa un lugar quien tiene
      // fila cargada en ESTE set — un presente sin fila es alguien que no jugó este set.
      const ocupados: Slot[] = filas
        .filter((fila) => {
          const presente = presentePorId.get(fila.planillaPresente);
          const idEquipo = presente ? idEquipoDePresente(presente) : undefined;
          // Sin `equipo` (presente de antes de ese campo): cae en el primer grupo, que
          // `gruposDePlanilla` ya garantiza que es el dueño de la planilla.
          return idEquipo ? idEquipo === grupo.id : grupoIndex === 0;
        })
        .map((fila) => ({ presenteId: fila.planillaPresente, estadisticas: estadisticasDeFila(fila) }));
      return completarSlots(ocupados, slotVacio);
    });

    setSlots(bloques.flat());
    resetEstadosFilas();
  }, [resetEstadosFilas]);

  // Los slots en pantalla siempre reflejan el set activo (o los totales, en modo directa). Se
  // recargan al abrir la planilla, al cambiar de set, y cuando cambia el conjunto de grupos
  // (ej. al agregar el plantel del rival, que pasa de 1 a 2 grupos y el array de slots tiene
  // que duplicar su tamaño) — nunca por cualquier otro cambio de `planilla` (ver el comentario
  // en `resincronizarSlots`).
  useEffect(() => {
    resincronizarSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planilla?._id, planilla?.modo, setActivoId, gruposKey, resincronizarSlots]);

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
          if (debeIgnorarRemoto(indiceLocal)) return;
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
          // No pisar una fila que YO tengo pendiente o en vuelo — mismo criterio que para `planilla`.
          if (debeIgnorarRemoto(idxExistente)) return;

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
          // otra sesión): se ubica en el primer slot vacío DENTRO DEL RANGO DE SU GRUPO — no en
          // el primer vacío de toda la grilla, o un jugador del rival podría terminar mostrado
          // en el bloque del equipo dueño. Si no hay ninguno libre en su grupo, esta grilla ya
          // está llena para ese equipo y no hay dónde mostrarlo — sigue existiendo en
          // "Totales", sólo que no visible acá hasta que se libere un lugar.
          const [desde, hasta] = rangoDeGrupo(indiceGrupoDePresente(fila.planillaPresente));
          let idxVacio = -1;
          for (let i = desde; i < hasta && i < next.length; i += 1) {
            if (!next[i].presenteId) {
              idxVacio = i;
              break;
            }
          }
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
        if (debeIgnorarRemoto(idx)) return prev;
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
  }, [planilla?._id, indiceGrupoDePresente, rangoDeGrupo, debeIgnorarRemoto]);

  const editable = planilla?.estado === 'borrador' || planilla?.estado === 'rechazada';

  const totales = useMemo(
    () => (planilla ? totalizarPorPresente(planilla) : {}),
    [planilla],
  );

  const [autocompletandoEquipo, setAutocompletandoEquipo] = useState<string | null>(null);

  const autocompletarPlantelDe = useCallback(
    async (equipoAutocompletar: string): Promise<void> => {
      if (!planilla) return;
      setAutocompletandoEquipo(equipoAutocompletar);
      try {
        const completa = await autocompletarPresentesDeEquipo(planilla._id, equipoAutocompletar);
        setPlanilla(completa);
        addToast({ type: 'success', title: 'Plantel agregado', message: 'Se sumaron los jugadores elegibles de ese equipo a la planilla.' });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'No se pudo traer el plantel',
          message: error instanceof Error ? error.message : 'Error inesperado',
        });
      } finally {
        setAutocompletandoEquipo(null);
      }
    },
    [planilla, addToast],
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
    olvidarFila(index);
    if (anterior && anterior !== presenteId) void limpiarFilaAnterior(anterior, index);
    if (presenteId) editarFila(index);
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

      marcarFilas(indices, 'guardando');

      try {
        const { presenteA: resultA, presenteB: resultB } = await intercambiarEstadisticas(planillaActual._id, {
          planillaSet: planillaSetId,
          presenteA,
          presenteB,
        });

        marcarFilas(indices, 'guardado');

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
        marcarFilas(indices, 'error');
        addToast({
          type: 'error',
          title: 'No se pudo mover/intercambiar los números',
          message: error instanceof Error ? error.message : 'Reintentá desde el mismo slot',
        });
      }
    },
    [addToast, marcarFilas],
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
    editarFila(index);
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
    editarFila(index);
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
      //
      // Y en modo 'directa' hay un filtro más: la grilla lista a TODOS los presentes, así que un
      // slot sin números no significa "jugó y no hizo nada", significa que no se cargó. Grabarle
      // una fila en cero lo haría figurar como participante del partido en todo el análisis. En
      // 'sets' es al revés: poner a alguien en un slot ya es decir que estuvo en cancha, aunque
      // no haya sumado nada, así que esa fila sí tiene que existir.
      const tieneFilaGuardada = (presenteId: string): boolean =>
        planilla.estadisticas.some(
          (e) => e.planillaPresente === presenteId && e.planillaSet === null,
        );

      const filas = slots
        .filter((s): s is Slot & { presenteId: string } => Boolean(s.presenteId))
        .filter(
          (s) =>
            planilla.modo !== 'directa' ||
            filaTieneDatos(s.estadisticas) ||
            tieneFilaGuardada(s.presenteId),
        )
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
      marcarFilas(
        slots.flatMap((s, i) => (s.presenteId ? [i] : [])),
        'guardado',
      );
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
      resetEstadosFilas();
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
      // `bodyClassName` reemplaza el default de `ModalBase` en vez de mezclarse con él (así lo
      // usa `Modal.tsx`), así que achicarlo acá es un ajuste sin riesgo de pelea de cascada.
      // `headerClassName`, en cambio, SE CONCATENA con las clases propias del header de
      // `ModalBase` (mb-0.5/pb-1/border-b): dos utilities de Tailwind en conflicto tienen la
      // misma especificidad, así que gana la que aparezca última en la hoja de estilos
      // COMPILADA — un orden que depende de dónde se usó cada clase por primera vez en todo el
      // proyecto, no del orden en este `className`. Por eso las de acá van con `!` (important):
      // así se anulan de forma determinística en vez de apostar a ese orden.
      bodyClassName="px-4 pt-2 pb-3 sm:px-6 sm:pt-3 sm:pb-4"
      headerClassName="!mb-0 !border-b !border-slate-100 !pb-1 sm:!pb-1"
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

          {editable && equiposDelPartido.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs font-medium text-slate-600">Agregar plantel de:</span>
              {equiposDelPartido.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  disabled={autocompletandoEquipo !== null}
                  onClick={() => void autocompletarPlantelDe(eq.id)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition [touch-action:manipulation] hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  {autocompletandoEquipo === eq.id ? 'Agregando…' : eq.nombre}
                  {eq.id === equipoIdDePlanilla ? ' (el mío)' : ''}
                </button>
              ))}
            </div>
          )}

          {planilla.presentes.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              La planilla no tiene jugadores. Revisá que tu plantel tenga contratos aceptados, o
              agregá el plantel del rival con los botones de arriba.
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
                {planilla.modo === 'sets'
                  ? `${JUGADORES_POR_SET} en cancha en este set${
                      gruposDePlanilla.length > 1 ? ' por equipo' : ''
                    }. Elegí quiénes jugaron y cargá sus números.`
                  : 'Totales de todo el partido. Está el plantel completo: cargá los números de quienes jugaron y dejá en cero al resto.'}
              </p>
              {/* Un bloque por grupo (normalmente 1, o 2 si la planilla tiene presentes de los
                  dos equipos) — mismo componente que usa la captura set a set del partido
                  oficial, para que las dos vistas se lean igual. El largo de cada bloque sale de
                  `capacidadesDeGrupo`. Acá las opciones son los presentes de la planilla (id de
                  PlanillaPresente), no jugadores sueltos, y cada bloque sólo ofrece los presentes
                  DE ESE equipo. */}
              <div className="space-y-4">
                {gruposDePlanilla.map((grupo, grupoIndex) => {
                  const [desde, hasta] = rangoDeGrupo(grupoIndex);
                  const slotsDelGrupo = slots.slice(desde, hasta);
                  const presentesDelGrupo = presentesDeGrupo(planilla.presentes, grupo.id, grupoIndex);
                  return (
                    <ListaJugadores
                      key={grupo.id}
                      equipoNombre={grupo.nombre}
                      capacidad={planilla.modo === 'sets' ? JUGADORES_POR_SET : undefined}
                      estadisticasJugador={slotsDelGrupo.map((s) => ({
                        jugadorId: s.presenteId,
                        estadisticas: s.estadisticas,
                      }))}
                      opcionesJugadores={presentesDelGrupo.map((p) => ({
                        value: p._id,
                        label: nombrePresente(p),
                      }))}
                      estadosGuardado={estadosDeRango(desde, slotsDelGrupo.length)}
                      onSolicitarIntercambio={(indexLocal) => solicitarIntercambio(desde + indexLocal)}
                      onAsignarJugador={(indexLocal, presenteId) => {
                        if (editable) solicitarAsignarJugador(desde + indexLocal, presenteId);
                      }}
                      onCambiarEstadistica={(indexLocal, campo, delta) => {
                        if (editable) cambiarEstadistica(desde + indexLocal, campo, delta);
                      }}
                      onCambiarSurvive={(indexLocal, value) => {
                        if (editable) cambiarSurvive(desde + indexLocal, value);
                      }}
                    />
                  );
                })}
              </div>
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
                    <span className="text-sm text-gray-800">
                      {nombrePresente(presente)}
                      {gruposDePlanilla.length > 1 && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          · {gruposDePlanilla.find((g) => g.id === (idEquipoDePresente(presente) ?? gruposDePlanilla[0]?.id))?.nombre}
                        </span>
                      )}
                    </span>
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
                          <td className="py-1.5 pr-3 text-gray-800">
                            {nombrePresente(presente)}
                            {gruposDePlanilla.length > 1 && (
                              <span className="ml-1.5 text-xs text-slate-400">
                                · {gruposDePlanilla.find((g) => g.id === (idEquipoDePresente(presente) ?? gruposDePlanilla[0]?.id))?.nombre}
                              </span>
                            )}
                          </td>
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
            - "Eliminar planilla" es rara y destructiva → texto chico sin caja, no un "⋯" con
              menú propio. `MenuAcciones` (portal + trigger h-11/w-11) tiene sentido cuando hay
              VARIAS acciones secundarias detrás — acá sólo hay una, así que el "⋯" era un tap de
              indirección y una caja de más sin ganar nada a cambio; se queda para `PartidosPage`,
              que sí agrupa varias.
            - "Guardar ahora" ya casi no hace falta con el autoguardado por fila: pasa a ser un
              link de texto plano, sin borde ni fondo — sigue siendo un botón real (mismo
              handler), sólo que no compite visualmente con nada.
            - "Pedir oficial" es la única acción que de verdad importa acá — es la que manda el
              trabajo a la organización — así que se queda como la única con caja/color sólido.
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
              <button
                type="button"
                disabled={eliminando}
                onClick={() =>
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
                  })
                }
                className="rounded-md px-2 py-2 text-xs font-medium text-rose-600 transition
                           [touch-action:manipulation] hover:bg-rose-50 disabled:opacity-40"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar planilla'}
              </button>
            )}

            {editable && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  title="Cada fila ya se guarda sola; esto fuerza el guardado de todo ahora"
                  className="px-1 py-2 text-xs font-medium text-gray-500 transition
                             [touch-action:manipulation] hover:text-gray-700 hover:underline
                             disabled:opacity-50"
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
        {intercambioAbierto !== null && (() => {
          // Sólo candidatos DEL MISMO GRUPO: cruzar números entre dos equipos distintos no
          // tiene sentido (serían estadísticas de otro plantel).
          const [desde, hasta] = rangoDeGrupo(grupoDeIndice(intercambioAbierto));
          const candidatosEnRango = slots
            .map((s, i) => ({ s, i }))
            .filter(({ i }) => i >= desde && i < hasta);
          return (
            <div className="space-y-2 p-1">
              <p className="text-sm text-slate-700">
                Elegí con quién intercambiar los números de este slot. Ninguno de los dos cambia de
                jugador — sólo se cruzan los números.
              </p>
              {candidatosEnRango.map(({ s, i }) => {
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
              {candidatosEnRango.every(({ s, i }) => i === intercambioAbierto || !s.presenteId) && (
                <p className="text-xs text-slate-500">Todavía no hay otro slot con jugador asignado.</p>
              )}
            </div>
          );
        })()}
      </ModalBase>
    </ModalBase>
  );
};

export default ModalPlanillaEquipo;
