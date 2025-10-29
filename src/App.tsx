import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Equipo from './pages/Equipo';
import Jugadores from './pages/Jugadores';
import Competencias from './pages/Competencias';
import Partidos from './pages/Partidos';
import Estadisticas from './pages/Estadisticas';
import Notificaciones from './pages/Notificaciones';
import Perfil from './pages/Perfil';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import TeamSelector from './components/TeamSelector';
import { useAuth } from './context/AuthContext';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/equipo', label: 'Equipo' },
  { to: '/jugadores', label: 'Jugadores' },
  { to: '/competencias', label: 'Competencias' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/notificaciones', label: 'Notificaciones' },
  { to: '/perfil', label: 'Perfil' },
];

const App = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold text-white shadow shadow-brand-500/40">
              OT
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Overtime Manager</p>
              <p className="text-xs text-slate-500">Panel de entrenadores</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-wrap gap-2 text-sm font-medium text-slate-600">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors ${
                    isActive ? 'bg-brand-100 text-brand-700' : 'hover:bg-slate-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <TeamSelector />
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                type="button"
              >
                Cerrar sesión
              </button>
            ) : (
              <NavLink
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
              >
                Iniciar sesión
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/equipo"
            element={
              <ProtectedRoute>
                <Equipo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jugadores"
            element={
              <ProtectedRoute>
                <Jugadores />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competencias"
            element={
              <ProtectedRoute>
                <Competencias />
              </ProtectedRoute>
            }
          />
          <Route
            path="/partidos"
            element={
              <ProtectedRoute>
                <Partidos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estadisticas"
            element={
              <ProtectedRoute>
                <Estadisticas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <ProtectedRoute>
                <Notificaciones />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Overtime Dodgeball</span>
          <span>Gestión diaria para managers y staff</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
