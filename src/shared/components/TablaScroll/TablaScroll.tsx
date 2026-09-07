import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Contenedor de tablas que se desplazan a lo ancho, con aviso de que hay más contenido.
 *
 * El problema que resuelve es de mobile y es silencioso: una tabla de diez columnas dentro de un
 * `overflow-x-auto` en una pantalla de 375px muestra las tres primeras y no da ninguna señal de
 * que existan las otras siete. En escritorio la barra de scroll horizontal delata que hay más; en
 * un teléfono no hay barra, así que las columnas de la derecha —donde suele estar el número que
 * importa— simplemente no existen para el que mira.
 *
 * La solución es un degradado en el borde por el que todavía queda contenido. Aparece y
 * desaparece según la posición real del scroll, así que también sirve de confirmación cuando se
 * llegó al final. Es puramente visual (`pointer-events-none`): no se interpone con el gesto de
 * arrastrar la tabla.
 */
const TablaScroll = ({ children, className = '' }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [sombras, setSombras] = useState({ izquierda: false, derecha: false });

  const actualizar = useCallback(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const { scrollLeft, scrollWidth, clientWidth } = nodo;
    // Un pixel de tolerancia: con zoom del navegador o anchos fraccionarios, `scrollLeft` no
    // llega nunca al valor exacto y la sombra derecha quedaría encendida para siempre.
    setSombras({
      izquierda: scrollLeft > 1,
      derecha: scrollLeft + clientWidth < scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    actualizar();
    const nodo = ref.current;
    if (!nodo) return;

    // El contenido de la tabla cambia con los filtros sin que haya scroll ni resize de ventana:
    // sin observar el tamaño, pasar de doce filas a dos dejaba la sombra encendida sobre una
    // tabla que ya entraba entera.
    const observer = new ResizeObserver(actualizar);
    observer.observe(nodo);
    const tabla = nodo.firstElementChild;
    if (tabla) observer.observe(tabla);

    return () => observer.disconnect();
  }, [actualizar, children]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={actualizar}
        className={`overflow-x-auto ${className}`}
      >
        {children}
      </div>

      {sombras.izquierda && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent"
        />
      )}
      {sombras.derecha && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent"
        />
      )}
    </div>
  );
};

export default TablaScroll;
