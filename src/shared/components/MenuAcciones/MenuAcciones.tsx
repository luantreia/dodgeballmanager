import { useEffect, useRef, useState } from 'react';

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
 * Ojo con no convertirlo en un cajón de sastre: «⋯» es para acciones sobre este ítem. La
 * configuración de una sección va en su propia rueda, en el encabezado de la sección, porque
 * mezclarlas hace que no se encuentre ninguna de las dos.
 */
const MenuAcciones = ({ acciones, etiqueta }: Props) => {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!abierto) return;

    // Un click en cualquier otro lado cierra. Se escucha en captura para que el menú se cierre
    // aunque el click caiga sobre algo que detiene la propagación.
    const alClick = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('click', alClick, true);
    document.addEventListener('keydown', alTeclado);
    return () => {
      document.removeEventListener('click', alClick, true);
      document.removeEventListener('keydown', alTeclado);
    };
  }, [abierto]);

  if (acciones.length === 0) return null;

  const ordenadas = [
    ...acciones.filter((a) => a.tono !== 'cuidado'),
    ...acciones.filter((a) => a.tono === 'cuidado'),
  ];

  return (
    <div className="relative" ref={contenedor}>
      <button
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

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
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
        </div>
      )}
    </div>
  );
};

export default MenuAcciones;
