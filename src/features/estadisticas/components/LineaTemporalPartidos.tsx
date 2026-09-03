import { useMemo } from 'react';
import type { PartidoTimeline } from '../services/timelineService';

type Props = {
  partidos: PartidoTimeline[];
  onAbrir: (partido: PartidoTimeline) => void;
};

/**
 * Cómo se ve un partido en la línea según los datos que tiene. Es el eje que pidió el DT:
 * de un vistazo, qué está cargado, qué está verificado y qué es captura propia.
 */
type Marca = { punto: string; anillo: string; etiqueta: string; texto: string };

export const marcaDe = (partido: PartidoTimeline): Marca => {
  const { oficial, planilla, fuenteEfectiva } = partido.datos;

  if (fuenteEfectiva === 'sin_datos') {
    return {
      punto: 'bg-white border-slate-300',
      anillo: 'ring-slate-100',
      etiqueta: 'Sin estadísticas',
      texto: 'bg-slate-100 text-slate-600',
    };
  }
  if (fuenteEfectiva === 'planilla') {
    return {
      punto: 'bg-sky-500 border-sky-500',
      anillo: 'ring-sky-100',
      etiqueta: oficial.existe ? 'Usando mi planilla' : 'Solo mi planilla',
      texto: 'bg-sky-100 text-sky-800',
    };
  }
  if (oficial.verificada) {
    return {
      punto: 'bg-emerald-500 border-emerald-500',
      anillo: 'ring-emerald-100',
      etiqueta: planilla ? 'Oficial verificada' : 'Verificada',
      texto: 'bg-emerald-100 text-emerald-800',
    };
  }
  return {
    punto: 'bg-amber-500 border-amber-500',
    anillo: 'ring-amber-100',
    etiqueta: 'Oficial sin verificar',
    texto: 'bg-amber-100 text-amber-800',
  };
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * La línea es vertical y agrupada por mes, no un eje horizontal con scroll.
 *
 * Un eje horizontal obliga a arrastrar para leer y comprime los períodos densos justo donde
 * más hay para ver; en un celular sostenido con una mano es peor todavía. Vertical se lee con
 * el pulgar, cada partido tiene lugar para su marcador y sus badges, y los meses sin partidos
 * simplemente no aparecen — que es información, no un hueco.
 */
const LineaTemporalPartidos = ({ partidos, onAbrir }: Props) => {
  const grupos = useMemo(() => {
    const mapa = new Map<string, { titulo: string; partidos: PartidoTimeline[] }>();

    for (const partido of partidos) {
      const fecha = new Date(partido.fecha);
      if (Number.isNaN(fecha.getTime())) continue;
      // Componentes locales: el backend guarda UTC y un partido nocturno de Argentina cae en
      // el mes siguiente si se lee la fecha en UTC.
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth()).padStart(2, '0')}`;
      const grupo = mapa.get(clave);
      if (grupo) grupo.partidos.push(partido);
      else mapa.set(clave, { titulo: `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`, partidos: [partido] });
    }

    return [...mapa.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([clave, grupo]) => ({ clave, ...grupo }));
  }, [partidos]);

  if (partidos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Ningún partido coincide con estos filtros. Probá quitando alguno.
      </div>
    );
  }

  return (
    // Región con nombre: además de la accesibilidad, separa la línea del panel de filtros,
    // donde los mismos nombres de rival vuelven a aparecer como chips.
    <div className="space-y-6" role="region" aria-label="Línea temporal de partidos">
      {grupos.map((grupo) => (
        <section key={grupo.clave}>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            {grupo.titulo}
            <span className="ml-2 font-medium normal-case tracking-normal text-slate-400">
              · {grupo.partidos.length} {grupo.partidos.length === 1 ? 'partido' : 'partidos'}
            </span>
          </h4>

          {/* La línea vertical es el borde izquierdo del contenedor. */}
          <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
            {grupo.partidos.map((partido) => {
              const marca = marcaDe(partido);
              const fecha = new Date(partido.fecha);
              const ganó = partido.marcadorEquipo > partido.marcadorRival;
              const empate = partido.marcadorEquipo === partido.marcadorRival;
              const hayMarcador = partido.estado === 'finalizado' || partido.estado === 'en_juego';

              return (
                <li key={partido._id} className="relative">
                  {/* El punto se apoya sobre la línea, por eso el -left que compensa el pl-4. */}
                  <span
                    aria-hidden
                    className={`absolute -left-[1.3rem] top-4 h-3 w-3 rounded-full border-2 ring-4 ${marca.punto} ${marca.anillo}`}
                  />

                  <button
                    type="button"
                    onClick={() => onAbrir(partido)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 [touch-action:manipulation]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          <span className="text-slate-400">{partido.esLocal ? 'vs' : '@'}</span>{' '}
                          {partido.rival?.nombre ?? 'Rival'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                          {' · '}
                          {partido.competencia?.nombre ?? 'Amistoso'}
                          {partido.fase ? ` · ${partido.fase.nombre}` : ''}
                        </p>
                      </div>

                      {hayMarcador && (
                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-sm font-bold tabular-nums ${
                            empate
                              ? 'bg-slate-100 text-slate-700'
                              : ganó
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {partido.marcadorEquipo}–{partido.marcadorRival}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${marca.texto}`}>
                        {marca.etiqueta}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {partido.modalidad}
                      </span>
                      {/* Sólo cuando hay dos fuentes: es el caso en que se puede elegir cuál manda. */}
                      {partido.datos.oficial.existe && partido.datos.planilla && (
                        <span className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          2 fuentes
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default LineaTemporalPartidos;
