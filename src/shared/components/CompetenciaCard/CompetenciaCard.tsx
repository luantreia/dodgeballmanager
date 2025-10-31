import type { ReactNode } from 'react';
import type { EquipoCompetencia } from '../../../types';

export interface CompetenciaCardProps {
  participacion: EquipoCompetencia;
  acciones?: ReactNode;
}

const estadoColor: Record<EquipoCompetencia['estado'], string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  aceptado: 'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-rose-100 text-rose-700',
};

const CompetenciaCard = ({ participacion, acciones }: CompetenciaCardProps) => (
  <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
    <header className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Competencia</p>
        <h3 className="text-lg font-semibold text-slate-900">{participacion.competencia.nombre}</h3>
        {participacion.competencia.faseActual ? (
          <p className="text-sm text-slate-500">Fase: {participacion.competencia.faseActual}</p>
        ) : null}
        {participacion.competencia.posicionActual ? (
          <p className="text-xs text-slate-500">Posición actual: #{participacion.competencia.posicionActual}</p>
        ) : null}
      </div>
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${estadoColor[participacion.estado]}`}>
        {participacion.estado}
      </span>
    </header>

    {participacion.fixtureUrl ? (
      <a
        href={participacion.fixtureUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        Ver fixture
      </a>
    ) : null}

    {acciones ? <div className="mt-auto flex flex-wrap gap-2">{acciones}</div> : null}
  </article>
);

export default CompetenciaCard;
