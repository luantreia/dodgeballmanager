import type { ChangeEvent, FC } from 'react';
import SelectDropdown from '../../../../shared/components/ui/FormComponents/SelectDropdown';
import ContadorEstadistica from './ContadorEstadistica';

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

/**
 * Contador de estadísticas de un jugador en un set, en formato tarjeta — para pantallas
 * angostas (`sm:hidden` en `ListaJugadores`; en horizontal/desktop se usa la tabla,
 * `TablaJugadoresEstadisticas`, que muestra los mismos controles en filas). Es la pantalla que
 * el DT usa parado al costado de la cancha, con una mano y el partido en curso, así que las
 * decisiones de acá son todas a favor del pulgar:
 *
 * - Tocar el número suma; mantenerlo apretado resta en cadena (lógica en `ContadorEstadistica`).
 *   Además hay un botón "−" explícito: la resta por long-press no se descubre sola y sin el
 *   botón no había forma de corregir un error con el teclado ni con un lector de pantalla.
 * - Los cuatro contadores van en una sola fila (`grid-cols-4`), no apilados: con seis jugadores
 *   en pantalla, cuatro filas por tarjeta eran ~270px de alto cada una y ni con scroll entraban
 *   los seis sin perder de vista al primero mientras se carga el sexto. En una fila el botón
 *   principal baja a ~36-40px de ancho — por debajo del ideal de 44px, pero sigue siendo un
 *   número de un dígito, no hace falta más para acertarle con el pulgar. El "−" y el toggle de
 *   "Sobrevive" bajan más todavía (~20-36px): son correcciones ocasionales, no la acción
 *   principal, así que ceden espacio antes que el número y el selector de jugador.
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
  return (
    <div className="rounded-lg bg-white p-1 shadow-md">
      {estadoGuardado && (
        <p className={`text-right text-[9px] font-medium leading-tight ${ETIQUETA_ESTADO[estadoGuardado].clase}`}>
          {ETIQUETA_ESTADO[estadoGuardado].texto}
        </p>
      )}
      <div className="mb-1 flex items-center gap-1">
        <SelectDropdown
          label={null}
          name={`jugador-${index}`}
          value={jugadorId}
          options={opcionesJugadores}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onCambiarJugador(e.target.value)}
          placeholder="Jugador"
          className="block h-9 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring focus:ring-brand-200 focus:ring-opacity-50"
        />
        {/* Swap de números con otro slot — para cuando dos jugadores quedaron anotados al
            revés y no hace falta perder ninguna de las dos capturas para corregirlo. */}
        {jugadorId && onIntercambiar && (
          <button
            type="button"
            onClick={onIntercambiar}
            title="Intercambiar los números con otro jugador"
            aria-label="Intercambiar los números con otro jugador"
            className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-sm text-slate-500 transition [touch-action:manipulation] hover:border-slate-300 hover:bg-slate-50"
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
          className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition [touch-action:manipulation] ${
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
              <span className="text-[9px] font-medium uppercase leading-none text-slate-500">{abrev}</span>
              <ContadorEstadistica
                valor={valor}
                disposicion="vertical"
                etiquetaAria={`${label}: ${valor}. Tocá para sumar, mantené apretado para restar`}
                etiquetaRestar={`Restar 1 a ${label}`}
                onCambiar={(delta) => onCambiarEstadistica(campo, delta)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JugadorEstadisticasCard;
