import { NavLink } from 'react-router-dom';
import { useAuth } from '../providers/AuthContext';
import TeamSelector from '../../features/equipo/components/TeamSelector';
import { SolicitudNotification } from '../../shared/components';
import { usePendientesDelEquipo } from '../../shared/features/solicitudes/hooks/usePendientesDelEquipo';
// removed feature flag usage

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/equipo', label: 'Equipo' },
  { to: '/jugadores', label: 'Jugadores' },
  { to: '/competencias', label: 'Competencias' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/entrenamientos', label: 'Entrenamientos' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/notificaciones', label: 'Notificaciones' },
  { to: '/perfil', label: 'Perfil' },
];

/**
 * La barra superior.
 *
 * Sus enlaces son sólo de escritorio (`lg:flex`). En mobile la navegación la lleva
 * `MobileTabBar`, la barra fija de abajo: antes acá había un menú hamburguesa con los nueve
 * enlaces detrás de un botón en la esquina superior derecha, que es la zona más lejana del
 * pulgar en un teléfono sostenido con una mano. Los dos nunca conviven — se cambian en el mismo
 * breakpoint.
 *
 * Lo que sí queda visible en mobile es el selector de equipo y la campanita: son contexto y
 * aviso, no navegación, y esconderlos detrás de un menú era lo que obligaba a abrirlo.
 */
export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const pendientes = usePendientesDelEquipo();
  // feature flags removed

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-brand-100 text-brand-700' : 'hover:bg-slate-100'}`;

  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
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
            <NavLink key={l.to} to={l.to} className={navLinkClass}>
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

        {/* Selector de equipo y campanita quedan visibles en todos los anchos: son el contexto
            de todo lo demás. «Cerrar sesión» no, porque en mobile vive en el panel «Más» de la
            barra de abajo y acá sólo robaría el lugar del selector. */}
        <div className="flex items-center gap-2 sm:gap-3">
          <TeamSelector />
          <SolicitudNotification />
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 lg:block"
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
      </div>
    </header>
  );
}
