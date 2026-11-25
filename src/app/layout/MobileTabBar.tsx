import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MobileTabBar as KitMobileTabBar } from 'overtime-kit';
import { useAuth } from '../providers/AuthContext';
import { usePendientesDelEquipo } from '../../shared/features/solicitudes/hooks/usePendientesDelEquipo';

/**
 * Las cuatro secciones del día a día del DT, más un panel con el resto. La barra en sí vive en
 * overtime-kit; acá sólo se eligen los destinos.
 *
 * Quedaron cuatro y no nueve porque tres secciones dejaron de ser destinos: el plantel es una
 * pestaña de Equipo, las competencias una pestaña de Partidos —una competencia le importa al DT
 * como el contenedor de sus partidos— y los pendientes viven arriba del dashboard (por eso se
 * marcan en «Más» con `pendientesMas` aunque no sean un enlace del panel).
 * Entrenamientos y perfil siguen siendo destinos, pero van en «Más»: se abren sentado.
 */
export default function MobileTabBar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pendientes = usePendientesDelEquipo();

  if (!isAuthenticated) return null;

  return (
    <KitMobileTabBar
      LinkComponent={Link}
      currentPath={pathname}
      tabs={[
        { to: '/dashboard', label: 'Inicio', icon: '🏠' },
        { to: '/partidos', label: 'Partidos', icon: '📋' },
        { to: '/equipo', label: 'Equipo', icon: '🛡️' },
        { to: '/estadisticas', label: 'Stats', icon: '📊' },
      ]}
      more={[
        { to: '/entrenamientos', label: 'Entrenamientos', icon: '🏃' },
        { to: '/perfil', label: 'Perfil', icon: '👤' },
      ]}
      pendientesMas={pendientes}
      onLogout={() => {
        logout();
        navigate('/login');
      }}
    />
  );
}
