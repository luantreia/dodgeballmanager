import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthContext';
import TeamSelector from '../../features/equipo/components/TeamSelector';
import { SolicitudNotification } from '../../shared/components';
import { getSolicitudesEdicion } from '../../features/solicitudes/services/solicitudesEdicionService';
import { useEquipo } from '../providers/EquipoContext';
// removed feature flag usage

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
  const { equipoSeleccionado } = useEquipo();
  const [open, setOpen] = useState(false);
  const [pendientes, setPendientes] = useState<number>(0);
  // feature flags removed

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      try {
        const resp = await getSolicitudesEdicion({ estado: 'pendiente' as any });
        const eqId = equipoSeleccionado?.id;
        const count = eqId ? (resp.solicitudes || []).filter((s: any) => {
          const dp = s?.datosPropuestos || {};
          return s?.entidad === eqId || dp?.equipoId === eqId || dp?.equipo === eqId || JSON.stringify(dp).includes(eqId);
        }).length : 0;
        if (mounted) setPendientes(count);
      } catch {
        if (mounted) setPendientes(0);
      }
    };
    void cargar();
    const id = window.setInterval(cargar, 30000);
    return () => { mounted = false; window.clearInterval(id); };
  }, [equipoSeleccionado?.id]);

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
              <span className="inline-flex items-center gap-2">
                {l.label}
                {l.to === '/notificaciones' && pendientes > 0 ? (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {pendientes}
                  </span>
                ) : null}
              </span>
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
                <span className="inline-flex items-center gap-2">
                  {l.label}
                  {l.to === '/notificaciones' && pendientes > 0 ? (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {pendientes}
                    </span>
                  ) : null}
                </span>
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
