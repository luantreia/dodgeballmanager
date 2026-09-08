import { useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
  /**
   * Qué hay filtrado ahora mismo, en palabras: «12 partidos», «Liga 2026 · Foam».
   *
   * Es obligatorio y es la parte importante del componente. El bug clásico de los filtros
   * plegables es que alguien deja uno puesto, lo olvida, ve pocos datos y cree que se perdieron.
   * Un chip que no dice su estado convierte un filtro en una pérdida de datos aparente.
   */
  resumen: string;
  /** `true` cuando hay algún filtro aplicado: pinta el chip para que se note de lejos. */
  activo?: boolean;
  /** Acciones que van a la derecha de la barra y no se pliegan. */
  acciones?: ReactNode;
  /** Los controles de filtrado, que se muestran al desplegar. */
  children: ReactNode;
};

/**
 * Barra de filtros plegada detrás de un chip que resume el estado.
 *
 * Existe porque en varias pantallas los filtros eran lo primero que aparecía y ocupaban media
 * pantalla de teléfono antes del primer dato — en Partidos eran cuatro `select` apilados, tres de
 * ellos deshabilitados en el caso más común. La página tiene que abrir con la respuesta, no con
 * los controles.
 *
 * Un solo componente para todas las pantallas y no una implementación por página: si cada una
 * resuelve su propio plegado, terminan comportándose distinto y el usuario tiene que aprender
 * dos veces la misma cosa.
 */
const BarraFiltros = ({ resumen, activo = false, acciones, children }: Props) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className={`flex min-h-[2.75rem] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition [touch-action:manipulation] ${
            activo
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span aria-hidden>⚙</span>
          {resumen}
          <span aria-hidden className={`text-[9px] transition-transform ${abierto ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>

        {acciones && <div className="ml-auto flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>

      {abierto && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-3">{children}</div>
      )}
    </div>
  );
};

export default BarraFiltros;
