import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEquipo } from '../providers/EquipoContext';

interface RequireEquipoProps {
  children: ReactNode;
}

/**
 * Las secciones de gestión no tienen sentido sin un equipo: si el usuario todavía
 * no administra ninguno, lo mandamos al onboarding en vez de dejarlo en pantallas
 * vacías sin ninguna acción posible.
 */
const RequireEquipo = ({ children }: RequireEquipoProps) => {
  const { equipos, loading } = useEquipo();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-transparent" />
      </div>
    );
  }

  if (equipos.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default RequireEquipo;
