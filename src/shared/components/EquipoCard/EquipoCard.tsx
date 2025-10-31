import type { ReactNode } from 'react';
import type { Equipo } from '../../../types';

export interface EquipoCardProps {
  equipo: Equipo;
  actions?: ReactNode;
}

const EquipoCard = ({ equipo, actions }: EquipoCardProps) => (
  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-600">
        {equipo.nombre.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{equipo.nombre}</h3>
        {equipo.descripcion ? (
          <p className="text-sm text-slate-500">{equipo.descripcion}</p>
        ) : null}
      </div>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
    {equipo.staff?.length ? (
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Staff</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {equipo.staff.map((miembro) => (
            <li key={miembro}>• {miembro}</li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
);

export default EquipoCard;
