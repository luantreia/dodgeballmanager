// src/components/ui/Spinner/Spinner.tsx
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Componente Spinner reutilizable con múltiples variantes
 */
type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'white';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  message?: ReactNode;
  className?: string;
  showMessage?: boolean;
}

const Spinner = ({
  size = 'md',
  variant = 'primary',
  className = '',
  message = 'Cargando...',
  showMessage = true,
  ...props
}: SpinnerProps) => {
  const sizes: Record<SpinnerSize, string> = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const variants: Record<SpinnerVariant, string> = {
    primary: 'text-blue-600 border-blue-200',
    secondary: 'text-gray-600 border-gray-200',
    success: 'text-green-600 border-green-200',
    danger: 'text-red-600 border-red-200',
    warning: 'text-yellow-600 border-yellow-200',
    white: 'text-white border-white/30'
  };

  const containerClasses = [
    'flex flex-col items-center justify-center',
    className
  ].filter(Boolean).join(' ');

  const spinnerClasses = [
    'animate-spin rounded-full border-2',
    variants[variant],
    sizes[size]
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} role="status" {...props}>
      <div
        className={spinnerClasses}
        aria-label="Cargando"
      >
        <span className="sr-only">Cargando...</span>
      </div>
      {showMessage && message && (
        <p className={`mt-2 text-sm text-gray-600 dark:text-gray-400`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default Spinner;
