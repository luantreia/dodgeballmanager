import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from '../../../shared/hooks/useDebouncedCallback';
import type { EstadoGuardadoFila } from '../components/common/JugadorEstadisticasCard';

export type EstadosPorFila = Record<number, EstadoGuardadoFila>;

/** Una fila que el usuario está editando, o cuyo guardado está en vuelo. */
const EN_CURSO: EstadoGuardadoFila[] = ['pendiente', 'guardando'];

export type UseCapturaAutoguardadoOpciones = {
  /**
   * Persiste UNA fila, por su índice en la grilla. Lee por su cuenta qué hay en esa fila (los
   * llamadores lo hacen con refs, para no recrear el callback en cada tecla): este hook no sabe
   * nada del contenido, sólo decide CUÁNDO guardar y lleva el estado de cada fila.
   *
   * Devuelve `false` cuando no había nada que guardar —una fila sin jugador asignado, por
   * ejemplo—, y entonces el indicador de esa fila se limpia en vez de quedar colgado en
   * "Sin guardar" para siempre.
   */
  persistirFila: (index: number) => Promise<boolean>;
  /** Se llama si `persistirFila` tira. El aviso al usuario lo decide el llamador. */
  alFallar?: (error: unknown, index: number) => void;
  delayMs?: number;
};

/**
 * El motor del autoguardado por fila de las capturas de estadísticas.
 *
 * Nació de tener la misma máquina escrita dos veces: una en "Mi planilla" (indexada por grupos
 * de la grilla) y otra en la captura set a set del partido oficial (indexada por lado,
 * local/visitante). Las dos hacían exactamente lo mismo —marcar la fila pendiente, debouncear su
 * guardado, mostrar en qué estado está, y no dejar que una actualización remota pise lo que el
 * usuario todavía está tecleando— cambiando sólo cómo se identifica una fila y a qué endpoint se
 * escribe. Eso es lo que queda afuera del hook, en `persistirFila`.
 *
 * Lo que NO hace, a propósito: suscribirse al socket (cada captura tiene sus propios eventos y su
 * propia sala) ni ejecutar el intercambio entre filas (endpoints distintos). De esas dos, el hook
 * aporta la parte que sí era idéntica: `debeIgnorarRemoto` para la primera y `marcarFilas` para
 * la segunda.
 *
 * Una captura con dos lados usa DOS instancias, una por lado: cada una lleva su propio mapa de
 * estados y su propio debounce, que es justo lo que antes se escribía a mano con un ternario
 * `lado === 'local' ? ... : ...` en cada punto.
 */
export function useCapturaAutoguardado({
  persistirFila,
  alFallar,
  delayMs = 600,
}: UseCapturaAutoguardadoOpciones) {
  const [estados, setEstados] = useState<EstadosPorFila>({});

  /**
   * Espejo sincrónico de `estados`. No se asigna en el render: lo escriben los propios setters,
   * antes de pedirle a React que re-renderice. Así `debeIgnorarRemoto` ve el estado correcto
   * incluso si el evento de socket llega en el mismo tick en que el usuario tocó la fila —
   * leyendo un ref actualizado en render, esa ventana quedaba abierta.
   */
  const estadosRef = useRef<EstadosPorFila>(estados);

  const persistirRef = useRef(persistirFila);
  persistirRef.current = persistirFila;
  const alFallarRef = useRef(alFallar);
  alFallarRef.current = alFallar;

  const aplicar = useCallback((fn: (prev: EstadosPorFila) => EstadosPorFila) => {
    estadosRef.current = fn(estadosRef.current);
    setEstados(estadosRef.current);
  }, []);

  const guardarFilaAhora = useCallback(
    async (index: number): Promise<void> => {
      aplicar((prev) => ({ ...prev, [index]: 'guardando' }));
      try {
        const seGuardo = await persistirRef.current(index);
        aplicar((prev) => {
          if (seGuardo) return { ...prev, [index]: 'guardado' };
          const next = { ...prev };
          delete next[index];
          return next;
        });
      } catch (error) {
        aplicar((prev) => ({ ...prev, [index]: 'error' }));
        alFallarRef.current?.(error, index);
      }
    },
    [aplicar],
  );

  const { debounced, flush, flushAll } = useDebouncedCallback((clave: string) => {
    void guardarFilaAhora(Number(clave));
  }, delayMs);

  // Si el modal se cierra con una edición todavía en el debounce, se fuerza su guardado en vez de
  // perderla: el aviso de "cambios sin guardar" ya advierte, pero si igual confirman cerrar, mejor
  // que la última tecleada llegue al backend a que se vaya en silencio.
  useEffect(() => () => flushAll(), [flushAll]);

  /** El usuario tocó algo de esta fila: queda pendiente y se programa su guardado. */
  const editarFila = useCallback(
    (index: number) => {
      aplicar((prev) => ({ ...prev, [index]: 'pendiente' }));
      debounced(String(index));
    },
    [aplicar, debounced],
  );

  /** Olvida el estado de una fila — para cuando ese lugar de la grilla se reasigna o se vacía. */
  const olvidarFila = useCallback(
    (index: number) => {
      aplicar((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [aplicar],
  );

  /** Marca varias filas de una (el intercambio toca dos a la vez y tienen que moverse juntas). */
  const marcarFilas = useCallback(
    (indices: number[], estado: EstadoGuardadoFila) => {
      aplicar((prev) => {
        const next = { ...prev };
        indices.forEach((i) => {
          next[i] = estado;
        });
        return next;
      });
    },
    [aplicar],
  );

  /** Borra todos los estados — al cambiar de set o de planilla la grilla se rearma de cero. */
  const reset = useCallback(() => aplicar(() => ({})), [aplicar]);

  /**
   * ¿Hay que descartar una actualización que llegó de otra sesión para esta fila?
   *
   * Sí mientras yo la tenga pendiente o en vuelo: entre lo que estoy tecleando ahora y la versión
   * remota, gana lo mío, y cuando mi propio guardado confirme va a traer el valor correcto de
   * todos modos. Sin esta regla, cargar la misma planilla entre dos personas se pisa en vivo.
   */
  const debeIgnorarRemoto = useCallback((index: number): boolean => {
    if (index < 0) return false;
    const estado = estadosRef.current[index];
    return estado !== undefined && EN_CURSO.includes(estado);
  }, []);

  /** "Hay al menos una fila que el backend todavía no confirmó." */
  const hayFilasSinConfirmar = useMemo(
    () => Object.values(estados).some((estado) => estado !== 'guardado'),
    [estados],
  );

  /** Los estados de un tramo de la grilla, para pasárselos a una lista que indexa desde 0. */
  const estadosDeRango = useCallback(
    (desde: number, largo: number): Array<EstadoGuardadoFila | undefined> =>
      Array.from({ length: largo }, (_, i) => estados[desde + i]),
    [estados],
  );

  return {
    estados,
    estadosDeRango,
    editarFila,
    olvidarFila,
    marcarFilas,
    reset,
    debeIgnorarRemoto,
    hayFilasSinConfirmar,
    guardarFilaAhora,
    flush,
    flushAll,
  };
}
