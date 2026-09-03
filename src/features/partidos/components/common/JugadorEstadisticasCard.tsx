import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import SelectDropdown from '../../../../shared/components/ui/FormComponents/SelectDropdown';

export type EstadisticasJugador = {
  throws: number;
  hits: number;
  outs: number;
  catches: number;
  survive?: boolean;
};

type OpcionJugador = {
  value: string;
  label: string;
};

type CampoNumerico = 'throws' | 'hits' | 'outs' | 'catches';

export type JugadorEstadisticasCardProps = {
  index: number;
  jugadorId: string;
  opcionesJugadores: OpcionJugador[];
  onCambiarJugador: (jugadorId: string) => void;
  onCambiarEstadistica: (campo: CampoNumerico, delta: number) => void;
  onCambiarSurvive?: (value: boolean) => void;
  estadisticasJugador?: Partial<EstadisticasJugador>;
};

const CONTROLES: Array<{ campo: CampoNumerico; label: string }> = [
  { campo: 'throws', label: 'Throws' },
  { campo: 'hits', label: 'Hits' },
  { campo: 'outs', label: 'Outs' },
  { campo: 'catches', label: 'Catches' },
];

const LONG_PRESS_DELAY = 500;
const SUBTRACT_INTERVAL = 400;
const FEEDBACK_DURATION = 300;

/**
 * Contador de estadísticas de un jugador en un set. Es la pantalla que el DT usa parado al
 * costado de la cancha, con una mano y el partido en curso, así que las decisiones de acá son
 * todas a favor del pulgar:
 *
 * - Tocar el número suma; mantenerlo apretado resta en cadena. Además hay un botón "−"
 *   explícito: la resta por long-press no se descubre sola y sin el botón no había forma de
 *   corregir un error con el teclado ni con un lector de pantalla.
 * - Se usan eventos de puntero en vez de mouse+touch a la vez. La versión anterior escuchaba
 *   los dos y el navegador emula los de mouse después de cada toque, así que cada gesto pasaba
 *   por los handlers dos veces.
 * - `onPointerCancel` corta el long-press: cuando el navegador se queda con el gesto para
 *   scrollear dispara ese evento, y sin escucharlo bastaba apoyar el dedo sobre un contador
 *   para scrollear la grilla para que empezara a restar solo.
 * - Los targets son de 44px, el mínimo táctil. Antes medían 32px de alto.
 */
const JugadorEstadisticasCard: FC<JugadorEstadisticasCardProps> = ({
  index,
  jugadorId,
  opcionesJugadores,
  onCambiarJugador,
  onCambiarEstadistica,
  onCambiarSurvive,
  estadisticasJugador = { throws: 0, hits: 0, outs: 0, catches: 0 },
}) => {
  const timerRef = useRef<number | null>(null);
  const intervaloRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  /**
   * Ref y no estado: el `click` se dispara inmediatamente después del `pointerup`, y cuando
   * esto era `useState` el handler de click leía el valor ya reseteado y sumaba +1. O sea que
   * toda sesión de resta terminaba sumando uno: restabas 3 y quedabas en -2.
   */
  const huboLongPressRef = useRef(false);
  /** Los valores frescos para el intervalo, que si no captura los del render en que arrancó. */
  const valoresRef = useRef(estadisticasJugador);
  valoresRef.current = estadisticasJugador;

  const [feedback, setFeedback] = useState<{ campo: CampoNumerico; tipo: 'suma' | 'resta' } | null>(null);

  const marcarFeedback = (campo: CampoNumerico, tipo: 'suma' | 'resta') => {
    setFeedback({ campo, tipo });
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), FEEDBACK_DURATION);
  };

  const detenerLongPress = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervaloRef.current !== null) {
      window.clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  };

  // Sin esto, desmontar el modal a mitad de un long-press deja el intervalo corriendo.
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (intervaloRef.current !== null) window.clearInterval(intervaloRef.current);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const restar = (campo: CampoNumerico) => {
    if ((valoresRef.current[campo] ?? 0) <= 0) return false;
    onCambiarEstadistica(campo, -1);
    marcarFeedback(campo, 'resta');
    return true;
  };

  const iniciarLongPress = (campo: CampoNumerico) => {
    detenerLongPress();
    huboLongPressRef.current = false;

    timerRef.current = window.setTimeout(() => {
      huboLongPressRef.current = true;
      if (!restar(campo)) {
        detenerLongPress();
        return;
      }
      intervaloRef.current = window.setInterval(() => {
        if (!restar(campo)) detenerLongPress();
      }, SUBTRACT_INTERVAL);
    }, LONG_PRESS_DELAY);
  };

  const handleClick = (campo: CampoNumerico) => {
    detenerLongPress();
    if (huboLongPressRef.current) {
      huboLongPressRef.current = false;
      return;
    }
    onCambiarEstadistica(campo, +1);
    marcarFeedback(campo, 'suma');
  };

  const claseFeedback = (campo: CampoNumerico) => {
    if (feedback?.campo !== campo) return 'bg-slate-100 border-slate-200';
    return feedback.tipo === 'suma'
      ? 'bg-emerald-200 border-emerald-300'
      : 'bg-rose-200 border-rose-300';
  };

  return (
    <div className="rounded-lg bg-white p-2 shadow-md">
      <SelectDropdown
        label={null}
        name={`jugador-${index}`}
        value={jugadorId}
        options={opcionesJugadores}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onCambiarJugador(e.target.value)}
        placeholder="Elegí un jugador"
        className="mb-3 block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50"
      />

      <div className="flex flex-col gap-2">
        {CONTROLES.map(({ campo, label }) => {
          const valor = estadisticasJugador[campo] ?? 0;
          return (
            <div key={campo} className="flex flex-col items-center">
              <span className="text-xs font-medium text-slate-600">{label}</span>
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => restar(campo)}
                  disabled={valor <= 0}
                  aria-label={`Restar 1 a ${label}`}
                  className="flex h-11 w-8 items-center justify-center rounded-lg border-2 border-slate-200
                             bg-white text-lg font-bold text-slate-500 transition-colors
                             [touch-action:manipulation] disabled:opacity-30
                             hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-brand-500/50"
                >
                  −
                </button>
                <button
                  type="button"
                  onPointerDown={() => iniciarLongPress(campo)}
                  onPointerUp={detenerLongPress}
                  onPointerLeave={detenerLongPress}
                  onPointerCancel={detenerLongPress}
                  onClick={() => handleClick(campo)}
                  aria-label={`${label}: ${valor}. Tocá para sumar, mantené apretado para restar`}
                  className={`flex h-11 min-w-[3rem] flex-1 select-none items-center justify-center
                              rounded-lg border-2 text-xl font-bold text-slate-800
                              transition-colors duration-100 ease-out [touch-action:manipulation]
                              focus-visible:outline-none focus-visible:ring-2
                              focus-visible:ring-brand-500/50 ${claseFeedback(campo)}`}
                >
                  {valor}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <label className="mt-3 flex min-h-[2.75rem] items-center justify-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(estadisticasJugador.survive)}
          onChange={(event) => onCambiarSurvive?.(event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        Sobrevive al set
      </label>
    </div>
  );
};

export default JugadorEstadisticasCard;
