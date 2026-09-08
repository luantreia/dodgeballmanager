import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import EmailVerificacionBanner from './shared/components/EmailVerificacionBanner';
import ProtectedRoute from './app/routes/ProtectedRoute';
import RequireEquipo from './app/routes/RequireEquipo';
import Navbar from './app/layout/Navbar';
import MobileTabBar from './app/layout/MobileTabBar';
import IndicadorSinConexion from './shared/components/IndicadorSinConexion';
import { ErrorBoundary } from './shared/components/ui';

/**
 * Cada página en su propio chunk.
 *
 * Con todo en un bundle único, entrar a ver el plantel descargaba también Recharts, que sólo
 * usa la pantalla de estadísticas. En una red de gimnasio eso son segundos de pantalla en
 * blanco por algo que el DT no va a mirar. Cada ruta ahora pesa lo suyo y nada más.
 */
const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage'));
const EquipoPage = lazy(() => import('./features/equipo/pages/EquipoPage'));
const PartidosPage = lazy(() => import('./features/partidos/pages/PartidosPage'));
const EntrenamientosPage = lazy(() => import('./features/entrenamientos/pages/EntrenamientosPage'));
const EstadisticasPage = lazy(() => import('./features/estadisticas/pages/EstadisticasPage'));
const NotificacionesPage = lazy(() => import('./features/notificaciones/pages/NotificacionesPage'));
const PerfilPage = lazy(() => import('./features/perfil/pages/PerfilPage'));
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
const RegistroPage = lazy(() => import('./features/auth/pages/RegistroPage'));
const OlvidePasswordPage = lazy(() => import('./features/auth/pages/OlvidePasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage'));
const VerificarEmailPage = lazy(() => import('./features/auth/pages/VerificarEmailPage'));
const OnboardingPage = lazy(() => import('./features/onboarding/pages/OnboardingPage'));

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

/** Placeholder mientras baja el chunk de la ruta. Ocupa alto para que no salte el layout. */
const CargandoRuta = () => (
  <div className="flex flex-1 items-center justify-center py-16" role="status" aria-live="polite">
    <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-transparent" />
    <span className="sr-only">Cargando…</span>
  </div>
);

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
      {/* El plantel es ahora una pestaña de Equipo. La ruta sobrevive como redirección porque
          puede estar guardada en un favorito o compartida en un chat. */}
      <Route path="/jugadores" element={<Navigate to="/equipo" replace />} />
      {/* Competencias volvió a ser pestaña de Partidos. La ruta sobrevive como redirección. */}
      <Route path="/competencias" element={<Navigate to="/partidos" replace />} />
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
        path="/entrenamientos"
        element={
          <ProtectedRoute>
            <RequireEquipo>
              <EntrenamientosPage />
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
        <Suspense fallback={<CargandoRuta />}>{rutas}</Suspense>
      </ErrorBoundary>
    );
  }

  return (
    // El padding inferior deja pasar la barra de pestañas fija de mobile: sin él tapa el final
    // del contenido y el pie de página. Suma el safe-area porque la barra también lo hace.
    <div className="flex min-h-screen flex-col bg-slate-50 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Navbar />
      <EmailVerificacionBanner />
      <IndicadorSinConexion />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <ErrorBoundary>
          <Suspense fallback={<CargandoRuta />}>{rutas}</Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Overtime Dodgeball</span>
          <span>Gestión diaria para directores técnicos, entrenadores y staff</span>
        </div>
      </footer>

      <MobileTabBar />
    </div>
  );
};

export default App;
