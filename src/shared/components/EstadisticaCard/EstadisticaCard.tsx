import type { ReactNode } from 'react';

export interface EstadisticaCardProps {
  titulo: string;
  valor: string | number;
  descripcion?: string;
  icono?: ReactNode;
  tono?: 'brand' | 'emerald' | 'amber' | 'slate';
}

const toneMap: Record<NonNullable<EstadisticaCardProps['tono']>, string> = {
  brand: 'bg-brand-50 text-brand-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-50 text-slate-600',
};

const EstadisticaCard = ({ titulo, valor, descripcion, icono, tono = 'slate' }: EstadisticaCardProps) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
    <div className="flex items-center gap-3">
      {icono ? <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneMap[tono]}`}>{icono}</div> : null}
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{titulo}</p>
        <p className="text-2xl font-semibold text-slate-900">{valor}</p>
      </div>
    </div>
    {descripcion ? <p className="text-sm text-slate-500">{descripcion}</p> : null}
  </div>
);

export default EstadisticaCard;
