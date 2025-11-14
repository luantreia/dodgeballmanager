import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthContext';
import TeamSelector from '../../features/equipo/components/TeamSelector';
import { SolicitudNotification } from '../../shared/components';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/equipo', label: 'Equipo' },
  { to: '/jugadores', label: 'Jugadores' },
  { to: '/competencias', label: 'Competencias' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/notificaciones', label: 'Notificaciones' },
  { to: '/perfil', label: 'Perfil' },
];

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-brand-100 text-brand-700' : 'hover:bg-slate-100'}`;

  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold text-white shadow shadow-brand-500/40">
            DT
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">Overtime DT</p>
            <p className="text-xs text-slate-500">Panel de entrenadores</p>
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-2 text-sm font-medium text-slate-600 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <TeamSelector />
          <SolicitudNotification />
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              type="button"
            >
              Cerrar sesión
            </button>
          ) : (
            <NavLink to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700">
              Iniciar sesión
            </NavLink>
          )}
        </div>

        <button
          className="inline-flex items-center rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5h14a1 1 0 100-2H3a1 1 0 000 2zm14 4H3a1 1 0 000 2h14a1 1 0 100-2zm0 6H3a1 1 0 000 2h14a1 1 0 100-2z" clipRule="evenodd"/></svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-2">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navLinkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3">
              <TeamSelector />
              {isAuthenticated ? (
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                  type="button"
                >
                  Cerrar sesión
                </button>
              ) : (
                <NavLink to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700" onClick={() => setOpen(false)}>
                  Iniciar sesión
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
