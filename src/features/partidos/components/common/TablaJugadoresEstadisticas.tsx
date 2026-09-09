import type { ChangeEvent, FC } from 'react';
import SelectDropdown from '../../../../shared/components/ui/FormComponents/SelectDropdown';
import ContadorEstadistica from './ContadorEstadistica';
import type { EstadisticasJugador, EstadoGuardadoFila } from './JugadorEstadisticasCard';

type CampoNumerico = 'throws' | 'hits' | 'outs' | 'catches';

export type FilaTablaJugador = {
  index: number;
  jugadorId: string;
  opcionesJugadores: Array<{ value: string; label: string }>;
  estadisticas: Partial<EstadisticasJugador>;
  estadoGuardado?: EstadoGuardadoFila;
};

type Props = {
  filas: FilaTablaJugador[];
  onAsignarJugador: (index: number, jugadorId: string) => void;
  onCambiarEstadistica: (index: number, campo: CampoNumerico, delta: number) => void;
  onCambiarSurvive?: (index: number, value: boolean) => void;
  onSolicitarIntercambio?: (index: number) => void;
};

const ETIQUETA_ESTADO: Record<EstadoGuardadoFila, { texto: string; clase: string }> = {
  pendiente: { texto: 'Sin guardar', clase: 'text-slate-400' },
  guardando: { texto: 'Guardando…', clase: 'text-amber-600' },
  guardado: { texto: 'Guardado', clase: 'text-emerald-600' },
  error: { texto: 'Error', clase: 'text-rose-600' },
};

const COLUMNAS: Array<{ campo: CampoNumerico; abrev: string; label: string }> = [
  { campo: 'throws', abrev: 'Tir', label: 'Throws' },
  { campo: 'hits', abrev: 'Hit', label: 'Hits' },
  { campo: 'outs', abrev: 'Out', label: 'Outs' },
  { campo: 'catches', abrev: 'Cat', label: 'Catches' },
];

/**
 * Misma captura que `JugadorEstadisticasCard`, como tabla — un jugador por fila en vez de un
 * jugador por tarjeta. Nace de que en horizontal (o en un monitor) sobra ancho pero las tarjetas
 * igual apilan sus contadores como si no lo tuviera: cada tarjeta repite las etiquetas
 * TIR/HIT/OUT/CAT, y seis tarjetas en fila siguen midiendo lo mismo de alto que en vertical. En
 * una tabla las etiquetas van UNA vez en el encabezado y cada jugador es una sola fila baja, así
 * que las seis entran juntas sin perder el ancho ganado. Sólo visible en `sm:` para arriba
 * (`ListaJugadores` la intercambia con la grilla de tarjetas); usa los mismos handlers y el
 * mismo `ContadorEstadistica` que las tarjetas, sin duplicar la lógica de long-press.
 */
const TablaJugadoresEstadisticas: FC<Props> = ({
  filas,
  onAsignarJugador,
  onCambiarEstadistica,
  onCambiarSurvive,
  onSolicitarIntercambio,
}) => {
  return (
    // Sin borde exterior propio: la tabla ya vive dentro del modal, y sumarle una caja más
    // encima de las filas (que ya se separan con `divide-y`) y de cada contador (que ya tiene su
    // propio borde) es lo que apilaba "cajas dentro de cajas". El encabezado se distingue por
    // tipografía (mayúsculas chicas) y una línea fina, no por un bloque de color.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <th className="w-full px-2 py-1.5 text-left">Jugador</th>
            <th className="px-1 py-1.5" />
            <th className="px-1 py-1.5">Sob.</th>
            {COLUMNAS.map((c) => (
              <th key={c.campo} className="px-1 py-1.5 text-center">
                {c.abrev}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((fila) => (
            <tr key={fila.index}>
              <td className="px-2 py-1">
                <div className="flex items-center gap-1">
                  <SelectDropdown
                    label={null}
                    name={`jugador-tabla-${fila.index}`}
                    value={fila.jugadorId}
                    options={fila.opcionesJugadores}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => onAsignarJugador(fila.index, e.target.value)}
                    placeholder="Jugador"
                    className="block h-8 min-w-[9rem] rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50"
                  />
                  {fila.estadoGuardado && (
                    <span className={`shrink-0 text-[10px] font-medium ${ETIQUETA_ESTADO[fila.estadoGuardado].clase}`}>
                      {ETIQUETA_ESTADO[fila.estadoGuardado].texto}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-1 py-1">
                {fila.jugadorId && onSolicitarIntercambio && (
                  <button
                    type="button"
                    onClick={() => onSolicitarIntercambio(fila.index)}
                    title="Intercambiar los números con otro jugador"
                    aria-label="Intercambiar los números con otro jugador"
                    className="flex h-8 w-7 items-center justify-center rounded-md border border-slate-200 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    ⇄
                  </button>
                )}
              </td>
              <td className="px-1 py-1 text-center">
                <button
                  type="button"
                  onClick={() => onCambiarSurvive?.(fila.index, !fila.estadisticas.survive)}
                  title="Sobrevive al set"
                  aria-label={`Sobrevive al set: ${fila.estadisticas.survive ? 'sí' : 'no'}`}
                  aria-pressed={Boolean(fila.estadisticas.survive)}
                  className={`flex h-8 w-7 items-center justify-center rounded-md border text-xs font-bold transition ${
                    fila.estadisticas.survive
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                      : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  S
                </button>
              </td>
              {COLUMNAS.map(({ campo, label }) => (
                <td key={campo} className="px-1 py-1">
                  <ContadorEstadistica
                    valor={fila.estadisticas[campo] ?? 0}
                    disposicion="horizontal"
                    etiquetaAria={`${label}: ${fila.estadisticas[campo] ?? 0}. Tocá para sumar, mantené apretado para restar`}
                    etiquetaRestar={`Restar 1 a ${label}`}
                    onCambiar={(delta) => onCambiarEstadistica(fila.index, campo, delta)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablaJugadoresEstadisticas;
