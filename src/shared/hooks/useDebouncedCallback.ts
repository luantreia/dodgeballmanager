import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounce por clave: cada clave tiene su propio timer, así que tipear en la fila del
 * jugador 3 no reinicia el guardado pendiente de la fila del jugador 1. Nace de la captura de
 * estadísticas en "Mi planilla", donde cada fila de la grilla se autoguarda de forma
 * independiente.
 *
 * `flush(key)` fuerza el guardado inmediato de una clave puntual (usado antes de cambiar de
 * set o cerrar el modal, para no dejar una edición reciente sin persistir). `flushAll()` hace
 * lo mismo con todas las claves pendientes.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (key: string, ...args: Args) => void,
  delayMs: number,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendientes = useRef<Map<string, Args>>(new Map());

  useEffect(() => {
    const timersAlDesmontar = timers.current;
    return () => {
      timersAlDesmontar.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const dispara = useCallback((key: string) => {
    const args = pendientes.current.get(key);
    timers.current.delete(key);
    pendientes.current.delete(key);
    if (args) callbackRef.current(key, ...args);
  }, []);

  const debounced = useCallback(
    (key: string, ...args: Args) => {
      pendientes.current.set(key, args);
      const timerAnterior = timers.current.get(key);
      if (timerAnterior) clearTimeout(timerAnterior);
      timers.current.set(
        key,
        setTimeout(() => dispara(key), delayMs),
      );
    },
    [delayMs, dispara],
  );

  const flush = useCallback(
    (key: string) => {
      const timer = timers.current.get(key);
      if (!timer) return;
      clearTimeout(timer);
      dispara(key);
    },
    [dispara],
  );

  const flushAll = useCallback(() => {
    Array.from(timers.current.keys()).forEach(flush);
  }, [flush]);

  return { debounced, flush, flushAll };
}
