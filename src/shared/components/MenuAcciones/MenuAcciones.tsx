import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type AccionMenu = {
  label: string;
  onSelect: () => void;
  /** Marca la acción como destructiva o delicada: se pinta aparte y va al final. */
  tono?: 'normal' | 'cuidado';
};

type Props = {
  acciones: AccionMenu[];
  /** Para lectores de pantalla: «Más acciones de Marvin vs Riestra». */
  etiqueta: string;
};

/**
 * Las acciones secundarias de un ítem, detrás de un botón «⋯».
 *
 * Nace de las tarjetas de partido, que mostraban cuatro botones cada una: con cinco partidos en
 * pantalla eran veinte botones compitiendo entre sí y ninguno destacaba. La regla que aplica el
 * llamador es dejar UNA acción primaria visible —la que corresponde al estado del ítem— y mandar
 * el resto acá.
 *
 * El menú se porta a `document.body` en vez de vivir `absolute` dentro del botón: la tarjeta que
 * lo contiene tiene `overflow-hidden` (para las esquinas redondeadas) y eso recortaba el
 * desplegable casi por completo. Portado afuera, se posiciona con las coordenadas del botón y ya
 * no depende del recorte de ningún ancestro.
 *
 * Ojo con no convertirlo en un cajón de sastre: «⋯» es para acciones sobre este ítem. La
 * configuración de una sección va en su propia rueda, en el encabezado de la sección, porque
 * mezclarlas hace que no se encuentre ninguna de las dos.
 */
const MenuAcciones = ({ acciones, etiqueta }: Props) => {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ top: 0, left: 0 });
  const boton = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);

  const recalcularPosicion = () => {
    const rect = boton.current?.getBoundingClientRect();
    if (!rect) return;
    // Ancla a la derecha del botón, como el `absolute right-0` original: el menú crece hacia la
    // izquierda desde el borde derecho del botón.
    setPosicion({ top: rect.bottom + 4, left: rect.right });
  };

  useLayoutEffect(() => {
    if (!abierto) return;
    recalcularPosicion();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    // Un click en cualquier otro lado cierra. Se escucha en captura para que el menú se cierre
    // aunque el click caiga sobre algo que detiene la propagación. Se chequean ambos refs porque
    // el menú vive en un portal, fuera del DOM del botón.
    const alClick = (e: MouseEvent) => {
      const objetivo = e.target as Node;
      if (boton.current?.contains(objetivo)) return;
      if (menu.current?.contains(objetivo)) return;
      setAbierto(false);
    };
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    // Reposiciona si la página scrollea o cambia de tamaño mientras el menú está abierto, en vez
    // de dejarlo flotando lejos del botón que lo abrió.
    const alScrollOResize = () => recalcularPosicion();

    document.addEventListener('click', alClick, true);
    document.addEventListener('keydown', alTeclado);
    window.addEventListener('scroll', alScrollOResize, true);
    window.addEventListener('resize', alScrollOResize);
    return () => {
      document.removeEventListener('click', alClick, true);
      document.removeEventListener('keydown', alTeclado);
      window.removeEventListener('scroll', alScrollOResize, true);
      window.removeEventListener('resize', alScrollOResize);
    };
  }, [abierto]);

  if (acciones.length === 0) return null;

  const ordenadas = [
    ...acciones.filter((a) => a.tono !== 'cuidado'),
    ...acciones.filter((a) => a.tono === 'cuidado'),
  ];

  return (
    <div className="relative">
      <button
        ref={boton}
        type="button"
        onClick={(e) => {
          // La tarjeta que lo contiene puede ser clickeable entera.
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={etiqueta}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition [touch-action:manipulation] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <span aria-hidden className="text-lg leading-none">⋯</span>
      </button>

      {abierto &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{ top: posicion.top, left: posicion.left, transform: 'translateX(-100%)' }}
            className="fixed z-50 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {ordenadas.map((accion) => (
              <button
                key={accion.label}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierto(false);
                  accion.onSelect();
                }}
                className={`flex min-h-[2.75rem] w-full items-center rounded-lg px-3 text-left text-sm font-medium transition [touch-action:manipulation] ${
                  accion.tono === 'cuidado'
                    ? 'text-amber-700 hover:bg-amber-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {accion.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default MenuAcciones;
