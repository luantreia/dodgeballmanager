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
import ProtectedRoute from './app/routes/ProtectedRoute';
import Navbar from './app/layout/Navbar';

const App = () => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/equipo"
            element={
              <ProtectedRoute>
                <EquipoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jugadores"
            element={
              <ProtectedRoute>
                <JugadoresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competencias"
            element={
              <ProtectedRoute>
                <CompetenciasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/partidos"
            element={
              <ProtectedRoute>
                <PartidosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estadisticas"
            element={
              <ProtectedRoute>
                <EstadisticasPage />
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
  );
};

export default App;
