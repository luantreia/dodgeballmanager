import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import EquipoPage from './features/equipo/pages/EquipoPage';
import JugadoresPage from './features/jugadores/pages/JugadoresPage';
import CompetenciasPage from './features/competencias/pages/CompetenciasPage';
import PartidosPage from './features/partidos/pages/PartidosPage';
import EstadisticasPage from './features/estadisticas/pages/EstadisticasPage';
import NotificacionesPage from './features/notificaciones/pages/NotificacionesPage';
import PerfilPage from './features/perfil/pages/PerfilPage';
import LoginPage from './features/auth/pages/LoginPage';
import RegistroPage from './features/auth/pages/RegistroPage';
import OlvidePasswordPage from './features/auth/pages/OlvidePasswordPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';
import VerificarEmailPage from './features/auth/pages/VerificarEmailPage';
import EmailVerificacionBanner from './shared/components/EmailVerificacionBanner';
import OnboardingPage from './features/onboarding/pages/OnboardingPage';
import ProtectedRoute from './app/routes/ProtectedRoute';
import RequireEquipo from './app/routes/RequireEquipo';
import Navbar from './app/layout/Navbar';
import IndicadorSinConexion from './shared/components/IndicadorSinConexion';
import { ErrorBoundary } from './shared/components/ui';

/**
 * Rutas que se muestran a pantalla completa, sin navbar ni footer. Antes el login y el registro
 * se renderizaban dentro del `<main>` con su propio `min-h-screen`: quedaban con la barra de
 * navegación arriba (incluido un botón "Iniciar sesión" que llevaba a la misma pantalla) y el
 * footer abajo, y en mobile eso sumaba una pantalla entera de scroll de más.
 */
const RUTAS_SIN_CHROME = [
  '/login',
  '/registro',
  '/olvide-password',
  '/reset-password',
  '/verificar-email',
];

const App = () => {
  const { pathname } = useLocation();
  const pantallaCompleta = RUTAS_SIN_CHROME.some((ruta) => pathname.startsWith(ruta));

  const rutas = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/olvide-password" element={<OlvidePasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/verificar-email/:token" element={<VerificarEmailPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <DashboardPage />
            </RequireEquipo>
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipo"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <EquipoPage />
            </RequireEquipo>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jugadores"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <JugadoresPage />
            </RequireEquipo>
          </ProtectedRoute>
        }
      />
      <Route
        path="/competencias"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <CompetenciasPage />
            </RequireEquipo>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partidos"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <PartidosPage />
            </RequireEquipo>
          </ProtectedRoute>
        }
      />
      <Route
        path="/estadisticas"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <EstadisticasPage />
            </RequireEquipo>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute>
            <NotificacionesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <PerfilPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  // El ErrorBoundary existía en `shared/components/ui` pero no estaba montado en ningún lado, así
  // que cualquier excepción de render dejaba la pantalla en blanco sin forma de recuperarse más
  // que cerrando la pestaña. Va adentro del layout para que el navbar sobreviva al error y el
  // usuario pueda irse a otra sección.
  if (pantallaCompleta) {
    return (
      <ErrorBoundary>
        <IndicadorSinConexion />
        {rutas}
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <EmailVerificacionBanner />
      <IndicadorSinConexion />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <ErrorBoundary>{rutas}</ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Overtime Dodgeball</span>
          <span>Gestión diaria para directores técnicos, entrenadores y staff</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
