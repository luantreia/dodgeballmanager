import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';

type Props = {
  valor: number;
  etiquetaAria: string;
  etiquetaRestar: string;
  onCambiar: (delta: number) => void;
  /** 'vertical': label arriba, número, "−" abajo (tarjetas mobile). 'horizontal': "−" y número
   * lado a lado en una sola línea (fila de tabla, donde sobra ancho pero no alto). */
  disposicion?: 'vertical' | 'horizontal';
};

const LONG_PRESS_DELAY = 500;
const SUBTRACT_INTERVAL = 400;
const FEEDBACK_DURATION = 300;

/**
 * Un contador individual (throws/hits/outs/catches), extraído de la tarjeta de captura para
 * poder usarse también en la tabla de horizontal/desktop sin duplicar la lógica de long-press.
 * Cada instancia maneja sus propios timers — antes vivían una sola vez por tarjeta compartidos
 * entre los 4 campos, lo cual ya alcanzaba porque un dedo no puede mantener presionados dos a la
 * vez, pero como componente aparte cada uno los tiene igual, sin cambiar el comportamiento.
 */
const ContadorEstadistica: FC<Props> = ({ valor, etiquetaAria, etiquetaRestar, onCambiar, disposicion = 'vertical' }) => {
  const timerRef = useRef<number | null>(null);
  const intervaloRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  /**
   * Ref y no estado: el `click` se dispara inmediatamente después del `pointerup`, y cuando esto
   * era `useState` el handler de click leía el valor ya reseteado y sumaba +1. O sea que toda
   * sesión de resta terminaba sumando uno: restabas 3 y quedabas en -2.
   */
  const huboLongPressRef = useRef(false);
  const valorRef = useRef(valor);
  valorRef.current = valor;

  const [feedback, setFeedback] = useState<'suma' | 'resta' | null>(null);

  const marcarFeedback = (tipo: 'suma' | 'resta') => {
    setFeedback(tipo);
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

  // Sin esto, desmontar el modal (o cambiar de vista tarjeta/tabla) a mitad de un long-press
  // deja el intervalo corriendo.
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (intervaloRef.current !== null) window.clearInterval(intervaloRef.current);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const restar = () => {
    if (valorRef.current <= 0) return false;
    onCambiar(-1);
    marcarFeedback('resta');
    return true;
  };

  const iniciarLongPress = () => {
    detenerLongPress();
    huboLongPressRef.current = false;

    timerRef.current = window.setTimeout(() => {
      huboLongPressRef.current = true;
      if (!restar()) {
        detenerLongPress();
        return;
      }
      intervaloRef.current = window.setInterval(() => {
        if (!restar()) detenerLongPress();
      }, SUBTRACT_INTERVAL);
    }, LONG_PRESS_DELAY);
  };

  const handleClick = () => {
    detenerLongPress();
    if (huboLongPressRef.current) {
      huboLongPressRef.current = false;
      return;
    }
    onCambiar(+1);
    marcarFeedback('suma');
  };

  const claseFeedback =
    feedback === 'suma'
      ? 'bg-emerald-200 border-emerald-300'
      : feedback === 'resta'
      ? 'bg-rose-200 border-rose-300'
      : 'bg-slate-100 border-slate-200';

  const botonNumero = (
    <button
      type="button"
      onPointerDown={iniciarLongPress}
      onPointerUp={detenerLongPress}
      onPointerLeave={detenerLongPress}
      onPointerCancel={detenerLongPress}
      onClick={handleClick}
      aria-label={etiquetaAria}
      className={`flex select-none items-center justify-center rounded-md border-2 font-bold text-slate-800
                  transition-colors duration-100 ease-out [touch-action:manipulation]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
                    disposicion === 'horizontal' ? 'h-8 w-9 text-sm' : 'h-9 w-full text-sm'
                  } ${claseFeedback}`}
    >
      {valor}
    </button>
  );

  const botonRestar = (
    <button
      type="button"
      onClick={restar}
      disabled={valor <= 0}
      aria-label={etiquetaRestar}
      className={`flex items-center justify-center rounded-md border border-slate-200 bg-white font-bold
                  leading-none text-slate-500 transition-colors [touch-action:manipulation]
                  disabled:opacity-30 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-brand-500/50 ${
                    disposicion === 'horizontal' ? 'h-8 w-6 text-xs' : 'h-5 w-full text-xs'
                  }`}
    >
      −
    </button>
  );

  if (disposicion === 'horizontal') {
    return (
      <div className="flex items-center gap-0.5">
        {botonRestar}
        {botonNumero}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {botonNumero}
      {botonRestar}
    </div>
  );
};

export default ContadorEstadistica;
