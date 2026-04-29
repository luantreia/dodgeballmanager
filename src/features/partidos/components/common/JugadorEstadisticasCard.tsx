import { useRef, useState } from 'react';
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

const JugadorEstadisticasCard: FC<JugadorEstadisticasCardProps> = ({
  index,
  jugadorId,
  opcionesJugadores,
  onCambiarJugador,
  onCambiarEstadistica,
  onCambiarSurvive,
  estadisticasJugador = { throws: 0, hits: 0, outs: 0, catches: 0 },
}) => {
  const controles: Array<{ campo: CampoNumerico; label: string }> = [
    { campo: 'throws', label: 'Throws' },
    { campo: 'hits', label: 'Hits' },
    { campo: 'outs', label: 'Outs' },
    { campo: 'catches', label: 'Catches' },
  ];

  const longPressTimer = useRef<number | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [feedbackColor, setFeedbackColor] = useState('');

  const LONG_PRESS_DELAY = 500;
  const SUBTRACT_INTERVAL = 400;
  const FEEDBACK_DURATION = 300;

  const feedbackTimer = useRef<number | null>(null);

  const handleMouseDown = (campo: CampoNumerico) => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
    }

    longPressTimer.current = window.setTimeout(() => {
      setIsLongPressing(true);
      if ((estadisticasJugador[campo] ?? 0) > 0) {
        onCambiarEstadistica(campo, -1);
        setFeedbackColor('red');
        if (feedbackTimer.current !== null) {
          window.clearTimeout(feedbackTimer.current);
        }
        feedbackTimer.current = window.setTimeout(() => setFeedbackColor(''), FEEDBACK_DURATION);
      }

      longPressTimer.current = window.setInterval(() => {
        if ((estadisticasJugador[campo] ?? 0) > 0) {
          onCambiarEstadistica(campo, -1);
          setFeedbackColor('red');
          if (feedbackTimer.current !== null) {
            window.clearTimeout(feedbackTimer.current);
          }
          feedbackTimer.current = window.setTimeout(() => setFeedbackColor(''), FEEDBACK_DURATION);
        } else {
          if (longPressTimer.current !== null) {
            window.clearInterval(longPressTimer.current);
            longPressTimer.current = null;
          }
          setIsLongPressing(false);
          setFeedbackColor('');
        }
      }, SUBTRACT_INTERVAL);
    }, LONG_PRESS_DELAY);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current !== null) {
      window.clearInterval(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  };

  const handleClick = (campo: CampoNumerico) => {
    if (!isLongPressing) {
      onCambiarEstadistica(campo, +1);
      setFeedbackColor('green');
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
      }
      feedbackTimer.current = window.setTimeout(() => setFeedbackColor(''), FEEDBACK_DURATION);
    }
    handleMouseUp();
  };

  const getFeedbackClass = () => {
    if (feedbackColor === 'green') {
      return 'bg-green-300';
    }
    if (feedbackColor === 'red') {
      return 'bg-red-300';
    }
    return 'bg-gray-100';
  };

  return (
    <div className="bg-white p-2 rounded-lg shadow-md mb-0">
      <SelectDropdown
        label={null}
        name={`jugador-${index}`}
        value={jugadorId}
        options={opcionesJugadores}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onCambiarJugador(e.target.value)}
        placeholder="Seleccione jugador"
        className="mb-4 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
      />

      <div className="grid grid-cols-1 gap-0">
        {controles.map(({ campo, label }) => {
          const valor = estadisticasJugador[campo] ?? 0;
          return (
            <div key={campo} className="flex flex-col items-center">
              <span className="text-gray-700 font-medium mb-0">{label}</span>
              <div
                onMouseDown={() => handleMouseDown(campo)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={() => handleClick(campo)}
                onTouchStart={() => handleMouseDown(campo)}
                onTouchEnd={handleMouseUp}
                onTouchCancel={handleMouseUp}
                className={`flex items-center justify-center cursor-pointer select-none
                            text-xl font-bold text-gray-800
                            w-12 h-8 rounded-lg border-2 border-gray-200
                            transition-colors duration-100 ease-out
                            ${getFeedbackClass()}
                            ${valor <= 0 && isLongPressing ? 'opacity-50 cursor-not-allowed' : ''}
                            hover:shadow-md
                            `}
              >
                <span>{valor}</span>
              </div>
            </div>
          );
        })}
      </div>

      <label className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(estadisticasJugador.survive)}
          onChange={(event) => onCambiarSurvive?.(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
        />
        Sobrevive al set
      </label>
    </div>
  );
};

export default JugadorEstadisticasCard;
