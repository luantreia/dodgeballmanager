// src/components/ui/Spinner/LoadingSpinner.tsx
import type { HTMLAttributes, ReactNode } from 'react';

type LoadingSpinnerSize = 'small' | 'medium' | 'large';
type LoadingSpinnerColor = 'blue' | 'gray' | 'white';

export interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: LoadingSpinnerSize;
  color?: LoadingSpinnerColor;
  message?: ReactNode;
}

/**
 * Componente LoadingSpinner mejorado con más opciones
 * @deprecated Usar el componente Spinner más moderno
 */
const LoadingSpinner = ({
  size = 'medium',
  color = 'blue',
  message = 'Cargando...',
  className = '',
  ...props
}: LoadingSpinnerProps) => {
  const sizeClasses: Record<LoadingSpinnerSize, string> = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const colorClasses: Record<LoadingSpinnerColor, string> = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`} {...props}>
      <div
        className={`animate-spin rounded-full border-2 border-gray-300 border-t-2 ${colorClasses[color]} ${sizeClasses[size]}`}
        role="status"
        aria-label="Cargando"
      >
        <span className="sr-only">Cargando...</span>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${colorClasses[color]}`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
