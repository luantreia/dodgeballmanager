import { Routes, Route, Navigate } from 'react-router-dom';
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
import { FeatureFlagsProvider } from './shared/config/featureFlags';

const App = () => {
  return (
    <FeatureFlagsProvider>
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <EmailVerificacionBanner />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
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
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Overtime Dodgeball</span>
          <span>Gestión diaria para Directores Tecnicos, entrenadores y staff</span>
        </div>
      </footer>
    </div>
    </FeatureFlagsProvider>
  );
};

export default App;
