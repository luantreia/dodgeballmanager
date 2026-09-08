import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ModalBase from '../ModalBase/ModalBase';
import PartidoCard from '../PartidoCard/PartidoCard';
import type { Partido } from '../../utils/types/types';

export type Escala = 'semanal' | 'mensual' | 'anual';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const PUNTO_ESTADO: Record<string, string> = {
  programado: 'bg-slate-400',
  en_juego: 'bg-amber-500',
  finalizado: 'bg-emerald-500',
  cancelado: 'bg-red-400',
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` a partir de los componentes LOCALES de una fecha. */
const claveDeFecha = (fecha: Date) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;

/**
 * En qué casilla del calendario cae un partido.
 *
 * Se lee de `fechaISO`, que es el instante real, y se convierte a día LOCAL. Es la trampa que
 * este repositorio ya pisó varias veces: `new Date('2026-09-05')` se parsea como medianoche UTC,
 * que en Argentina es el 4 a las 21:00, así que agrupar por UTC corre un día entero los partidos
 * nocturnos — justo los de dodgeball. Si no hay ISO se cae al string `fecha`, que ya viene como
 * día local y se usa tal cual.
 */
const claveDePartido = (partido: Partido): string => {
  if (partido.fechaISO) {
    const d = new Date(partido.fechaISO);
    if (!Number.isNaN(d.getTime())) return claveDeFecha(d);
  }
  return partido.fecha ? String(partido.fecha).slice(0, 10) : '';
};

const instante = (partido: Partido): number => {
  const valor = partido.fechaISO ?? (partido.fecha ? `${partido.fecha}T${partido.hora ?? '00:00'}` : null);
  if (!valor) return 0;
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const hoy = () => {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
};

const sumarDias = (fecha: Date, dias: number) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
const sumarMeses = (fecha: Date, meses: number) =>
  new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1);
const sumarAnios = (fecha: Date, anios: number) =>
  new Date(fecha.getFullYear() + anios, fecha.getMonth(), 1);

/** `getDay()` devuelve 0=domingo; acá la semana arranca el lunes. */
const indiceLunes = (diaJs: number) => (diaJs + 6) % 7;

const diasDeLaSemana = (ancla: Date): Date[] => {
  const inicio = sumarDias(ancla, -indiceLunes(ancla.getDay()));
  return Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
};

const diasDeLaGrillaMensual = (ancla: Date): Date[] => {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const inicio = sumarDias(primero, -indiceLunes(primero.getDay()));
  return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
};

const etiquetaPorDefecto = (p: Partido): string =>
  `${p.equipoLocal?.nombre ?? 'Local'} vs ${p.equipoVisitante?.nombre ?? p.rival ?? 'Visitante'}`;

const MAX_CHIPS_MENSUAL = 2;
const MAX_CHIPS_SEMANAL = 3;

export interface PartidoCalendarProps {
  partidos: Partido[];
  escalaInicial?: Escala;
  etiquetaFn?: (p: Partido) => string;
  /** Las mismas acciones que en la lista, para que el calendario no sea una vista de segunda. */
  accionesFn?: (p: Partido) => ReactNode;
  onPartidoClick?: (p: Partido) => void;
}

/**
 * El calendario de partidos, en tres escalas.
 *
 * Es el mismo componente que ya existe en Overtime-Admin y Overtime-Public, traído acá con dos
 * cambios: agrupa por día local en vez de UTC (ver `claveDePartido`), y el detalle de un día usa
 * la `PartidoCard` de esta app en lugar de una tarjeta propia — así una tarjeta de partido se ve
 * y se opera igual en la lista y en el calendario.
 *
 * La vista mensual es la que abre por defecto porque es la que contesta la pregunta habitual del
 * DT: cómo viene el mes. La semanal sirve para la semana en curso y la anual para ubicarse en la
 * temporada.
 */
const PartidoCalendar = ({
  partidos,
  escalaInicial = 'mensual',
  etiquetaFn = etiquetaPorDefecto,
  accionesFn,
  onPartidoClick,
}: PartidoCalendarProps) => {
  const [escala, setEscala] = useState<Escala>(escalaInicial);
  const [cursor, setCursor] = useState<Date>(hoy);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const partidosPorDia = useMemo(() => {
    const mapa = new Map<string, Partido[]>();
    partidos.forEach((p) => {
      const clave = claveDePartido(p);
      if (!clave) return;
      const lista = mapa.get(clave);
      if (lista) lista.push(p);
      else mapa.set(clave, [p]);
    });
    mapa.forEach((lista) => lista.sort((a, b) => instante(a) - instante(b)));
    return mapa;
  }, [partidos]);

  const claveHoy = useMemo(() => claveDeFecha(hoy()), []);

  const navegar = (delta: 1 | -1) => {
    if (escala === 'semanal') setCursor((c) => sumarDias(c, delta * 7));
    else if (escala === 'mensual') setCursor((c) => sumarMeses(c, delta));
    else setCursor((c) => sumarAnios(c, delta));
  };

  const renderCelda = (
    fecha: Date,
    opts: { compacta?: boolean; fueraDeMes?: boolean; maxChips: number },
  ) => {
    const clave = claveDeFecha(fecha);
    const items = partidosPorDia.get(clave) ?? [];
    const esHoy = clave === claveHoy;
    const visibles = items.slice(0, opts.maxChips);
    const sobrantes = items.length - visibles.length;

    return (
      <button
        key={clave}
        type="button"
        disabled={items.length === 0}
        onClick={() => setDiaSeleccionado(clave)}
        aria-label={
          items.length === 0
            ? `${fecha.getDate()} de ${MESES[fecha.getMonth()]}, sin partidos`
            : `${fecha.getDate()} de ${MESES[fecha.getMonth()]}, ${items.length} ${items.length === 1 ? 'partido' : 'partidos'}`
        }
        className={`flex flex-col items-stretch rounded-lg border p-1.5 text-left transition-colors [touch-action:manipulation] ${
          opts.compacta ? 'min-h-[2.75rem]' : 'min-h-[4rem] sm:min-h-[5.5rem]'
        } ${
          opts.fueraDeMes ? 'border-transparent bg-slate-50/50 opacity-40' : 'border-slate-100 bg-white'
        } ${items.length > 0 ? 'cursor-pointer hover:border-brand-300 hover:shadow-sm' : 'cursor-default'} ${
          esHoy ? 'ring-1 ring-inset ring-brand-400' : ''
        }`}
      >
        <span className={`text-[11px] font-semibold ${esHoy ? 'text-brand-600' : 'text-slate-500'}`}>
          {fecha.getDate()}
        </span>

        {/* En la escala anual y en mobile no entra el nombre de nadie: un punto por partido dice
            lo único que importa a ese tamaño, que ese día se juega. */}
        {opts.compacta ? (
          items.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-0.5">
              {items.slice(0, 4).map((p, i) => (
                <span
                  key={p.id ?? i}
                  className={`h-1.5 w-1.5 rounded-full ${PUNTO_ESTADO[p.estado ?? 'programado']}`}
                />
              ))}
            </span>
          )
        ) : (
          <>
            <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
              {items.slice(0, 4).map((p, i) => (
                <span
                  key={p.id ?? i}
                  className={`h-1.5 w-1.5 rounded-full ${PUNTO_ESTADO[p.estado ?? 'programado']}`}
                />
              ))}
            </span>
            <div className="mt-1 hidden space-y-0.5 sm:block">
              {visibles.map((p, i) => (
                <span
                  key={p.id ?? i}
                  className="flex items-center gap-1 truncate text-[10px] font-medium text-slate-600"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO_ESTADO[p.estado ?? 'programado']}`}
                  />
                  <span className="truncate">{etiquetaFn(p)}</span>
                </span>
              ))}
              {sobrantes > 0 && (
                <span className="block text-[10px] font-semibold text-brand-600">+{sobrantes} más</span>
              )}
            </div>
          </>
        )}
      </button>
    );
  };

  const semana = diasDeLaSemana(cursor);
  const delDia = diaSeleccionado ? partidosPorDia.get(diaSeleccionado) ?? [] : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {(['semanal', 'mensual', 'anual'] as Escala[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEscala(e)}
              aria-pressed={escala === e}
              className={`min-h-[2.25rem] rounded-md px-3 text-xs font-semibold capitalize transition-all [touch-action:manipulation] ${
                escala === e ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navegar(-1)}
            aria-label="Período anterior"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition [touch-action:manipulation] hover:bg-slate-50"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(hoy())}
            className="h-11 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition [touch-action:manipulation] hover:bg-slate-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => navegar(1)}
            aria-label="Período siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition [touch-action:manipulation] hover:bg-slate-50"
          >
            ›
          </button>
        </div>
      </div>

      {escala === 'semanal' && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-600">
            Semana del {semana[0].getDate()} de {MESES[semana[0].getMonth()]}
          </h3>
          <div className="grid grid-cols-7 gap-1">
            {semana.map((fecha, i) => (
              <div key={i} className="space-y-1">
                <div className="text-center text-[10px] font-bold uppercase text-slate-400">{DIAS[i]}</div>
                {renderCelda(fecha, { maxChips: MAX_CHIPS_SEMANAL })}
              </div>
            ))}
          </div>
        </div>
      )}

      {escala === 'mensual' && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-600">
            {MESES[cursor.getMonth()]} {cursor.getFullYear()}
          </h3>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center">
            {DIAS.map((d) => (
              <div key={d} className="text-[10px] font-bold uppercase text-slate-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {diasDeLaGrillaMensual(cursor).map((fecha) =>
              renderCelda(fecha, {
                fueraDeMes: fecha.getMonth() !== cursor.getMonth(),
                maxChips: MAX_CHIPS_MENSUAL,
              }),
            )}
          </div>
        </div>
      )}

      {escala === 'anual' && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-600">{cursor.getFullYear()}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MESES.map((mes, i) => {
              const ancla = new Date(cursor.getFullYear(), i, 1);
              return (
                <div key={mes} className="rounded-xl border border-slate-100 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(ancla);
                      setEscala('mensual');
                    }}
                    className="mb-1 min-h-[2rem] text-xs font-bold text-slate-700 transition hover:text-brand-600"
                  >
                    {mes}
                  </button>
                  <div className="grid grid-cols-7 gap-0.5">
                    {diasDeLaGrillaMensual(ancla).map((fecha) =>
                      renderCelda(fecha, {
                        compacta: true,
                        fueraDeMes: fecha.getMonth() !== i,
                        maxChips: 0,
                      }),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {diaSeleccionado && (
        <ModalBase
          isOpen
          onClose={() => setDiaSeleccionado(null)}
          title={`Partidos del ${diaSeleccionado.split('-').reverse().join('/')}`}
          size="lg"
        >
          <div className="space-y-3 py-2">
            {delDia.map((p) => (
              <PartidoCard
                key={p.id}
                partido={p}
                actions={accionesFn?.(p)}
                onClick={onPartidoClick ? () => onPartidoClick(p) : undefined}
              />
            ))}
          </div>
        </ModalBase>
      )}
    </div>
  );
};

export default PartidoCalendar;
