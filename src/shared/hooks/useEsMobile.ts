import { useEffect, useState } from 'react';

/** El mismo corte que `sm` en Tailwind, para que JS y CSS no discrepen. */
const CONSULTA = '(max-width: 639px)';

/**
 * Si la pantalla está por debajo del breakpoint `sm`.
 *
 * Existe sólo para lo que no se puede resolver con clases: recharts recibe medidas como props
 * de JavaScript (el ancho del eje de categorías, el alto del gráfico), y una clase de Tailwind
 * no puede cambiarlas. Todo lo demás debe resolverse con `sm:` en el marcado, que no necesita
 * hidratación ni provoca un re-render.
 *
 * Arranca en `false` y se corrige en el primer efecto: durante ese render el gráfico se dibuja
 * con las medidas de escritorio, lo que en un teléfono es un parpadeo de un frame y nunca un
 * layout roto.
 */
export const useEsMobile = (): boolean => {
  const [esMobile, setEsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(CONSULTA);
    const actualizar = () => setEsMobile(mql.matches);

    actualizar();
    mql.addEventListener('change', actualizar);
    return () => mql.removeEventListener('change', actualizar);
  }, []);

  return esMobile;
};

export default useEsMobile;
