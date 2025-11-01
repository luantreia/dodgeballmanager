import type { KeyboardEvent, ReactNode } from 'react';
import type { Partido } from '../../../types';
import { formatDate, formatDateTime } from '../../../utils/formatDate';

export interface PartidoCardProps {
  partido: Partido;
  variante?: 'proximo' | 'resultado';
  actions?: ReactNode;
  onClick?: () => void;
}

const badgeStyles = {
  proximo: {
    label: 'Próximo',
    className: 'bg-sky-100 text-sky-700',
  },
  resultado: {
    label: 'Reciente',
    className: 'bg-emerald-100 text-emerald-600',
  },
} as const;

const PartidoCard = ({ partido, variante = 'proximo', actions, onClick }: PartidoCardProps) => {
  const fechaTexto = partido.hora
    ? formatDateTime(`${partido.fecha}T${partido.hora}`)
    : formatDate(partido.fecha);

  const badge = badgeStyles[variante];

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition ${
        onClick ? 'cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {partido.competencia?.nombre ?? 'Partido amistoso'}
          </p>
          <h3 className="text-lg font-semibold text-slate-900">vs {partido.rival}</h3>
          <p className="text-sm text-slate-500">{fechaTexto}</p>
          {partido.escenario ? (
            <p className="text-xs text-slate-400">{partido.escenario}</p>
          ) : null}
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </header>

      {variante === 'resultado' && partido.resultado ? (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-700">Resultado</p>
          <p className="text-2xl font-bold text-slate-900">
            {partido.resultado.puntosEquipo} - {partido.resultado.puntosRival}
          </p>
        </div>
      ) : null}

      {actions ? <div className="mt-auto flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
};

export default PartidoCard;
