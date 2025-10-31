import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../providers/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900/90 text-white">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-800 px-8 py-6 shadow-lg shadow-slate-950/40">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-400 border-t-transparent" />
          <p className="text-sm font-medium">Cargando sesión…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
