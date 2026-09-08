import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthContext';
import { usePendientesDelEquipo } from '../../shared/features/solicitudes/hooks/usePendientesDelEquipo';

/**
 * Las cuatro secciones del día a día del DT, más un panel con el resto.
 *
 * Son las que se abren estando en el club o al costado de la cancha: ver cómo viene la semana,
 * entrar a un partido a cargar estadísticas, mirar el plantel y analizar. Jugadores,
 * competencias, entrenamientos, avisos y perfil viven en «Más»: se usan sentado.
 */
const TABS_PRINCIPALES = [
  { to: '/dashboard', label: 'Inicio', icon: '🏠' },
  { to: '/partidos', label: 'Partidos', icon: '📋' },
  { to: '/equipo', label: 'Equipo', icon: '🛡️' },
  { to: '/estadisticas', label: 'Stats', icon: '📊' },
];

const ENLACES_MAS = [
  { to: '/jugadores', label: 'Jugadores', icon: '👥' },
  { to: '/competencias', label: 'Competencias', icon: '🏆' },
  { to: '/entrenamientos', label: 'Entrenamientos', icon: '🏃' },
  { to: '/notificaciones', label: 'Notificaciones', icon: '🔔' },
  { to: '/perfil', label: 'Perfil', icon: '👤' },
];

/**
 * Navegación principal en mobile: barra fija abajo, al alcance del pulgar.
 *
 * Es el mismo patrón que `MobileTabBar` en Overtime-Organizaciones, traído acá donde la
 * navegación seguía siendo un menú hamburguesa: nueve enlaces detrás de un botón de 40px en la
 * esquina superior derecha, que es justo la zona más lejana del pulgar en un teléfono sostenido
 * con una mano. Con la barra, los cuatro destinos de todos los días quedan a un toque.
 *
 * Se oculta desde `lg`, que es donde el `Navbar` muestra su propia fila de enlaces: los dos
 * nunca se ven a la vez.
 *
 * El `pb-[env(safe-area-inset-bottom)]` no es opcional: `index.html` declara
 * `viewport-fit=cover`, así que sin él la fila de etiquetas queda debajo de la barra de gestos.
 */
export default function MobileTabBar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [masAbierto, setMasAbierto] = useState(false);
  const pendientes = usePendientesDelEquipo();

  // Con el panel abierto el fondo no debe scrollear por detrás. Se libera siempre al
  // desmontar, incluso si el panel quedó abierto durante una navegación.
  useEffect(() => {
    if (!masAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [masAbierto]);

  useEffect(() => {
    if (!masAbierto) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMasAbierto(false);
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [masAbierto]);

  if (!isAuthenticated) return null;

  const claseTab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold [touch-action:manipulation] ${
      isActive ? 'text-brand-600' : 'text-slate-400'
    }`;

  return (
    <>
      {masAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={() => setMasAbierto(false)}
        />
      )}

      {masAbierto && (
        <div className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg lg:hidden">
          {ENLACES_MAS.map((enlace) => (
            <NavLink
              key={enlace.to}
              to={enlace.to}
              onClick={() => setMasAbierto(false)}
              className="flex min-h-[2.75rem] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 [touch-action:manipulation] hover:bg-slate-50"
            >
              <span aria-hidden className="text-base">{enlace.icon}</span>
              {enlace.label}
              {enlace.to === '/notificaciones' && pendientes > 0 && (
                <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendientes}
                </span>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => {
              setMasAbierto(false);
              logout();
              navigate('/login');
            }}
            className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-600 [touch-action:manipulation] hover:bg-rose-50"
          >
            <span aria-hidden className="text-base">🚪</span>
            Cerrar sesión
          </button>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navegación principal"
      >
        {TABS_PRINCIPALES.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={claseTab}>
            <span aria-hidden className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setMasAbierto((v) => !v)}
          aria-expanded={masAbierto}
          className={`relative flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold [touch-action:manipulation] ${
            masAbierto ? 'text-brand-600' : 'text-slate-400'
          }`}
        >
          <span aria-hidden className="text-lg leading-none">⋯</span>
          Más
          {/* Notificaciones vive dentro del panel, así que sin esta marca un pendiente nuevo no
              se vería hasta abrirlo. Es un punto y no el número: el conteo exacto está adentro,
              al lado de la sección, y acá sólo hace falta saber que hay algo. */}
          {pendientes > 0 && !masAbierto && (
            <span
              aria-label={`${pendientes} solicitudes pendientes`}
              className="absolute right-[calc(50%-1.1rem)] top-1.5 h-2 w-2 rounded-full bg-brand-600"
            />
          )}
        </button>
      </nav>
    </>
  );
}
