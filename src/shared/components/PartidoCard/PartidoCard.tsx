import type { KeyboardEvent, ReactNode } from 'react';
import type { EstadoPartido, Partido } from '../../utils/types/types';
import { formatDate, formatDateTime } from '../../utils/formatDate';

export interface PartidoCardProps {
  partido: Partido;
  actions?: ReactNode;
  onClick?: () => void;
}

// Un badge por estado real del modelo, ni uno más: las entradas de más ('pendiente',
// 'confirmado', 'proximamente') eran ramas muertas que sugerían estados que el backend nunca
// devuelve. `Record<EstadoPartido, …>` hace que agregar un estado al modelo rompa la
// compilación acá en vez de mostrar un badge en blanco.
const badgeStyles: Record<EstadoPartido, { label: string; className: string }> = {
  programado: {
    label: 'Programado',
    className: 'bg-slate-100 text-slate-600',
  },
  en_juego: {
    label: 'En juego',
    className: 'bg-amber-100 text-amber-700 animate-pulse',
  },
  finalizado: {
    label: 'Finalizado',
    className: 'bg-emerald-100 text-emerald-600',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-red-100 text-red-600',
  },
};

type EquipoResumen = { nombre?: string; escudo?: string } | undefined;

/**
 * Un partido en una lista.
 *
 * Se compactó bastante: antes medía unos 240px de alto y en un teléfono entraban dos partidos y
 * medio por pantalla. El alto se iba en tres cosas que no lo valían — un encabezado de tres
 * renglones apilados (competencia, temporada·fase, fecha), escudos de 48px, y un cuerpo de tres
 * columnas al 33% que partía «Marvin Dodgeball Club» en tres renglones dentro de 125px.
 *
 * Ahora el contexto va en un renglón, los escudos miden 36px y los nombres se truncan en uno
 * solo. Lo único que NO se achicó es la zona de acciones: los 44px del botón son el mínimo
 * táctil y esta tarjeta se toca parado al costado de la cancha.
 */
const PartidoCard = ({ partido, actions, onClick }: PartidoCardProps) => {
  // `fechaISO` es el instante completo del backend; `fecha`+`hora` ya vienen en hora local, así
  // que concatenarlas produce un string sin zona que el navegador interpreta como local. Las
  // dos ramas muestran lo mismo — la segunda es el fallback para datos ya mapeados sin ISO.
  const fechaTexto = partido.fechaISO
    ? formatDateTime(partido.fechaISO)
    : partido.fecha && partido.hora
    ? formatDateTime(`${partido.fecha}T${partido.hora}`)
    : partido.fecha
    ? formatDate(partido.fecha)
    : 'Sin fecha';

  const estado: EstadoPartido = partido.estado ?? 'programado';
  const badge = badgeStyles[estado] ?? badgeStyles.programado;
  const mostrarMarcador =
    estado === 'finalizado' ||
    estado === 'en_juego' ||
    (typeof partido.marcadorLocal === 'number' && typeof partido.marcadorVisitante === 'number');

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  const renderEscudo = (equipo: EquipoResumen, fallback: string) => {
    if (equipo?.escudo) {
      return <img src={equipo.escudo} alt="" className="h-9 w-9 shrink-0 object-contain" />;
    }
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-400">
        {equipo?.nombre?.charAt(0) || fallback}
      </div>
    );
  };

  // Competencia, temporada y fase eran tres renglones; como casi siempre son cortos, encadenados
  // entran en uno y se truncan si no.
  const contexto = [
    partido.competencia?.nombre ?? 'Amistoso',
    partido.temporada?.nombre,
    partido.fase?.nombre,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition ${
        onClick
          ? 'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40'
          : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {contexto}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {renderEscudo(partido.equipoLocal, 'L')}
          <span className="truncate text-sm font-semibold text-slate-900">
            {partido.equipoLocal?.nombre || 'Local'}
          </span>
        </div>

        <div className="shrink-0 px-1 text-center">
          {mostrarMarcador ? (
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {partido.marcadorLocal ?? 0}
              <span className="mx-1 text-slate-300">-</span>
              {partido.marcadorVisitante ?? 0}
            </span>
          ) : (
            <span className="text-sm font-bold text-slate-300">VS</span>
          )}
        </div>

        {/* El visitante se alinea a la derecha para que el marcador quede centrado sin depender
            de que los dos nombres midan lo mismo. */}
        <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2">
          {renderEscudo(partido.equipoVisitante, 'V')}
          <span className="truncate text-right text-sm font-semibold text-slate-900">
            {partido.equipoVisitante?.nombre || partido.rival || 'Visitante'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 text-[11px] text-slate-400">
        <span className="truncate">{fechaTexto}</span>
        {partido.escenario ? <span className="truncate">· {partido.escenario}</span> : null}
      </div>

      {actions && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/30 px-3 py-2">
          {actions}
        </div>
      )}
    </article>
  );
};

export default PartidoCard;
