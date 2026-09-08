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

export type EstadoGuardadoFila = 'pendiente' | 'guardando' | 'guardado' | 'error';

export type JugadorEstadisticasCardProps = {
  index: number;
  jugadorId: string;
  opcionesJugadores: OpcionJugador[];
  onCambiarJugador: (jugadorId: string) => void;
  onCambiarEstadistica: (campo: CampoNumerico, delta: number) => void;
  onCambiarSurvive?: (value: boolean) => void;
  estadisticasJugador?: Partial<EstadisticasJugador>;
  /** Autoguardado de esta fila: para que el que carga sepa si ya quedó grabado o si conviene
   * esperar/reintentar antes de irse. `undefined` es "sin ediciones todavía en esta fila". */
  estadoGuardado?: EstadoGuardadoFila;
  /** Sólo tiene sentido si el slot ya tiene un jugador asignado — swap de números con otro slot. */
  onIntercambiar?: () => void;
};

const ETIQUETA_ESTADO: Record<EstadoGuardadoFila, { texto: string; clase: string }> = {
  pendiente: { texto: 'Sin guardar', clase: 'text-slate-400' },
  guardando: { texto: 'Guardando…', clase: 'text-amber-600' },
  guardado: { texto: 'Guardado', clase: 'text-emerald-600' },
  error: { texto: 'No se guardó — tocá algo de esta fila para reintentar', clase: 'text-rose-600' },
};

const CONTROLES: Array<{ campo: CampoNumerico; label: string; abrev: string }> = [
  { campo: 'throws', label: 'Throws', abrev: 'Tir' },
  { campo: 'hits', label: 'Hits', abrev: 'Hit' },
  { campo: 'outs', label: 'Outs', abrev: 'Out' },
  { campo: 'catches', label: 'Catches', abrev: 'Cat' },
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
 * - Los cuatro contadores van en una sola fila (`grid-cols-4`), no apilados: con seis
 *   jugadores en pantalla, cuatro filas por tarjeta eran ~270px de alto cada una y ni con
 *   scroll entraban los seis sin perder de vista al primero mientras se carga el sexto. En una
 *   fila el botón principal baja a ~40px de ancho — por debajo del ideal de 44px, pero sigue
 *   siendo un número de un dígito, no hace falta más para acertarle con el pulgar.
 */
const JugadorEstadisticasCard: FC<JugadorEstadisticasCardProps> = ({
  index,
  jugadorId,
  opcionesJugadores,
  onCambiarJugador,
  onCambiarEstadistica,
  onCambiarSurvive,
  estadisticasJugador = { throws: 0, hits: 0, outs: 0, catches: 0 },
  estadoGuardado,
  onIntercambiar,
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
    <div className="rounded-lg bg-white p-1.5 shadow-md">
      {estadoGuardado && (
        <p className={`text-right text-[9px] font-medium leading-tight ${ETIQUETA_ESTADO[estadoGuardado].clase}`}>
          {ETIQUETA_ESTADO[estadoGuardado].texto}
        </p>
      )}
      <div className="mb-1.5 flex items-center gap-1">
        <SelectDropdown
          label={null}
          name={`jugador-${index}`}
          value={jugadorId}
          options={opcionesJugadores}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onCambiarJugador(e.target.value)}
          placeholder="Elegí un jugador"
          className="block h-10 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50"
        />
        {/* Swap de números con otro slot — para cuando dos jugadores quedaron anotados al
            revés y no hace falta perder ninguna de las dos capturas para corregirlo. */}
        {jugadorId && onIntercambiar && (
          <button
            type="button"
            onClick={onIntercambiar}
            title="Intercambiar los números con otro jugador"
            aria-label="Intercambiar los números con otro jugador"
            className="flex h-10 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-base text-slate-500 transition [touch-action:manipulation] hover:border-slate-300 hover:bg-slate-50"
          >
            ⇄
          </button>
        )}
        {/* Antes era una fila propia ("Sobrevive al set" + checkbox, ~44px) debajo de los
            contadores. Como ícono al lado del select, cabe en la misma fila sin gastar el alto
            de una fila entera — necesario para que las seis tarjetas entren juntas en pantalla. */}
        <button
          type="button"
          onClick={() => onCambiarSurvive?.(!estadisticasJugador.survive)}
          title="Sobrevive al set"
          aria-label={`Sobrevive al set: ${estadisticasJugador.survive ? 'sí' : 'no'}`}
          aria-pressed={Boolean(estadisticasJugador.survive)}
          className={`flex h-10 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition [touch-action:manipulation] ${
            estadisticasJugador.survive
              ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
              : 'border-slate-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          S
        </button>
      </div>

      {/* Los cuatro contadores en una sola fila, no apilados — ver el comentario del
          componente sobre por qué. */}
      <div className="grid grid-cols-4 gap-1">
        {CONTROLES.map(({ campo, label, abrev }) => {
          const valor = estadisticasJugador[campo] ?? 0;
          return (
            <div key={campo} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-medium uppercase text-slate-500">{abrev}</span>
              <button
                type="button"
                onPointerDown={() => iniciarLongPress(campo)}
                onPointerUp={detenerLongPress}
                onPointerLeave={detenerLongPress}
                onPointerCancel={detenerLongPress}
                onClick={() => handleClick(campo)}
                aria-label={`${label}: ${valor}. Tocá para sumar, mantené apretado para restar`}
                className={`flex h-10 w-full select-none items-center justify-center rounded-md border-2
                            text-base font-bold text-slate-800 transition-colors duration-100 ease-out
                            [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2
                            focus-visible:ring-brand-500/50 ${claseFeedback(campo)}`}
              >
                {valor}
              </button>
              <button
                type="button"
                onClick={() => restar(campo)}
                disabled={valor <= 0}
                aria-label={`Restar 1 a ${label}`}
                className="flex h-6 w-full items-center justify-center rounded-md border border-slate-200
                           bg-white text-xs font-bold text-slate-500 transition-colors
                           [touch-action:manipulation] disabled:opacity-30
                           hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-brand-500/50"
              >
                −
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JugadorEstadisticasCard;
