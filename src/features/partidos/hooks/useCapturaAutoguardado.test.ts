import { renderHook, act } from '@testing-library/react';
import { useCapturaAutoguardado } from './useCapturaAutoguardado';

/**
 * El escenario que importa de verdad acá es la captura simultánea: dos personas cargando el mismo
 * set, los guardados de una llegando a la otra por socket. Si la regla de "no pises lo que estoy
 * tecleando" se rompe, se rompe en silencio y sólo con dos personas a la vez — o sea en un
 * torneo, no en el escritorio de nadie. De ahí que exista este archivo.
 */
describe('useCapturaAutoguardado', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const avanzar = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  it('marca la fila pendiente y recién la guarda cuando pasa el debounce', async () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila, delayMs: 600 }));

    act(() => {
      result.current.editarFila(2);
    });

    expect(result.current.estados[2]).toBe('pendiente');
    expect(persistirFila).not.toHaveBeenCalled();

    await avanzar(600);

    expect(persistirFila).toHaveBeenCalledTimes(1);
    expect(persistirFila).toHaveBeenCalledWith(2);
    expect(result.current.estados[2]).toBe('guardado');
  });

  it('agrupa varias ediciones seguidas de la misma fila en un solo guardado', async () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila, delayMs: 600 }));

    act(() => {
      result.current.editarFila(0);
    });
    await avanzar(300);
    act(() => {
      result.current.editarFila(0);
    });
    await avanzar(300);

    // Todavía no: la segunda edición reinició el timer de ESA fila.
    expect(persistirFila).not.toHaveBeenCalled();

    await avanzar(300);
    expect(persistirFila).toHaveBeenCalledTimes(1);
  });

  it('cada fila tiene su propio timer: tipear en una no retrasa el guardado de otra', async () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila, delayMs: 600 }));

    act(() => {
      result.current.editarFila(1);
    });
    await avanzar(500);
    act(() => {
      result.current.editarFila(4);
    });
    await avanzar(100);

    // La fila 1 ya cumplió sus 600ms aunque la 4 se haya tocado en el medio.
    expect(persistirFila).toHaveBeenCalledTimes(1);
    expect(persistirFila).toHaveBeenCalledWith(1);
  });

  describe('debeIgnorarRemoto', () => {
    it('descarta lo remoto mientras la fila está pendiente o en vuelo, y lo acepta una vez guardada', async () => {
      let resolverPersist: ((valor: boolean) => void) | undefined;
      const persistirFila = jest.fn(
        () =>
          new Promise<boolean>((resolve) => {
            resolverPersist = resolve;
          }),
      );
      const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila, delayMs: 600 }));

      // Sin ediciones, lo que llega de otra sesión se aplica.
      expect(result.current.debeIgnorarRemoto(3)).toBe(false);

      act(() => {
        result.current.editarFila(3);
      });
      // Pendiente: el usuario tecleó y todavía no se mandó nada.
      expect(result.current.debeIgnorarRemoto(3)).toBe(true);

      await avanzar(600);
      // En vuelo: se mandó pero el backend no confirmó.
      expect(result.current.estados[3]).toBe('guardando');
      expect(result.current.debeIgnorarRemoto(3)).toBe(true);

      await act(async () => {
        resolverPersist?.(true);
      });

      // Confirmado: mi valor ya está en el backend, lo remoto puede aplicarse de nuevo.
      expect(result.current.estados[3]).toBe('guardado');
      expect(result.current.debeIgnorarRemoto(3)).toBe(false);
    });

    it('no bloquea las demás filas: sólo protege la que se está editando', () => {
      const persistirFila = jest.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

      act(() => {
        result.current.editarFila(0);
      });

      expect(result.current.debeIgnorarRemoto(0)).toBe(true);
      expect(result.current.debeIgnorarRemoto(1)).toBe(false);
    });

    it('ve la edición en el mismo tick, sin esperar un re-render', () => {
      const persistirFila = jest.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

      // Un evento de socket puede llegar en el mismo tick en que el usuario tocó la fila. Si el
      // espejo del estado se actualizara en el render, acá todavía daría `false` y el valor
      // remoto pisaría lo recién tecleado.
      act(() => {
        result.current.editarFila(5);
        expect(result.current.debeIgnorarRemoto(5)).toBe(true);
      });
    });

    it('un índice negativo (fila que no existe en la grilla) no se protege', () => {
      const persistirFila = jest.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

      expect(result.current.debeIgnorarRemoto(-1)).toBe(false);
    });
  });

  it('flushAll fuerza lo pendiente — es lo que corre antes de cambiar de set o pedir oficial', async () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila, delayMs: 600 }));

    act(() => {
      result.current.editarFila(0);
      result.current.editarFila(1);
    });

    await act(async () => {
      result.current.flushAll();
    });

    expect(persistirFila).toHaveBeenCalledTimes(2);
    expect(persistirFila).toHaveBeenCalledWith(0);
    expect(persistirFila).toHaveBeenCalledWith(1);
  });

  it('si no había nada que guardar, limpia el indicador en vez de dejarlo colgado', async () => {
    // Una fila sin jugador asignado a la que igual se le tocó un contador: antes quedaba en
    // "Sin guardar" para siempre, porque el guardado salía por un early return sin tocar el estado.
    const persistirFila = jest.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila, delayMs: 600 }));

    act(() => {
      result.current.editarFila(0);
    });
    await avanzar(600);

    expect(result.current.estados[0]).toBeUndefined();
    expect(result.current.hayFilasSinConfirmar).toBe(false);
  });

  it('si el guardado falla, la fila queda en error y se avisa al llamador', async () => {
    const fallo = new Error('500');
    const persistirFila = jest.fn().mockRejectedValue(fallo);
    const alFallar = jest.fn();
    const { result } = renderHook(() =>
      useCapturaAutoguardado({ persistirFila, alFallar, delayMs: 600 }),
    );

    act(() => {
      result.current.editarFila(2);
    });
    await avanzar(600);

    expect(result.current.estados[2]).toBe('error');
    expect(alFallar).toHaveBeenCalledWith(fallo, 2);
    // Una fila en error sigue contando como sin confirmar: el aviso al cerrar tiene que salir.
    expect(result.current.hayFilasSinConfirmar).toBe(true);
    // Y lo remoto sí puede aplicarse: no estoy tecleando ni hay nada en vuelo.
    expect(result.current.debeIgnorarRemoto(2)).toBe(false);
  });

  it('marcarFilas mueve varias filas juntas (el intercambio toca dos a la vez)', () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

    act(() => {
      result.current.marcarFilas([1, 3], 'guardando');
    });

    expect(result.current.estados[1]).toBe('guardando');
    expect(result.current.estados[3]).toBe('guardando');
    expect(result.current.debeIgnorarRemoto(1)).toBe(true);
    expect(result.current.debeIgnorarRemoto(3)).toBe(true);

    act(() => {
      result.current.marcarFilas([1, 3], 'guardado');
    });

    expect(result.current.hayFilasSinConfirmar).toBe(false);
  });

  it('olvidarFila borra el estado de un lugar que se reasignó', () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

    act(() => {
      result.current.editarFila(2);
    });
    act(() => {
      result.current.olvidarFila(2);
    });

    expect(result.current.estados[2]).toBeUndefined();
    expect(result.current.debeIgnorarRemoto(2)).toBe(false);
  });

  it('reset limpia todo — la grilla se rearma al cambiar de set', () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

    act(() => {
      result.current.editarFila(0);
      result.current.marcarFilas([1, 2], 'guardado');
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.estados).toEqual({});
    expect(result.current.hayFilasSinConfirmar).toBe(false);
  });

  it('estadosDeRango devuelve el tramo reindexado desde 0, para una lista por grupo', () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCapturaAutoguardado({ persistirFila }));

    act(() => {
      result.current.marcarFilas([6, 8], 'guardado');
    });

    // El segundo grupo de una grilla arranca en el índice absoluto 6.
    expect(result.current.estadosDeRango(6, 3)).toEqual(['guardado', undefined, 'guardado']);
  });

  it('al desmontar fuerza lo que quedaba en el debounce', async () => {
    const persistirFila = jest.fn().mockResolvedValue(true);
    const { result, unmount } = renderHook(() =>
      useCapturaAutoguardado({ persistirFila, delayMs: 600 }),
    );

    act(() => {
      result.current.editarFila(0);
    });
    expect(persistirFila).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(persistirFila).toHaveBeenCalledWith(0);
  });
});
