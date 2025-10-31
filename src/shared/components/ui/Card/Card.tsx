// src/components/ui/Card/Card.tsx
import type { HTMLAttributes, ReactNode } from 'react';

type CardVariant = 'default' | 'outlined' | 'filled' | 'success' | 'warning' | 'danger';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  variant?: CardVariant;
  padding?: CardPadding;
  shadow?: CardShadow;
}

/**
 * Componente Card reutilizable para mostrar contenido en tarjetas
 */
const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  variant = 'default',
  padding = 'md',
  shadow = 'md',
  ...props
}) => {
  const variants: Record<CardVariant, string> = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
    outlined: 'bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700',
    filled: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700',
    success: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700',
    danger: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
  };

  const paddings: Record<CardPadding, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const shadows: Record<CardShadow, string> = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl'
  };

  const cardClasses = [
    'rounded-lg transition-all duration-200',
    variants[variant],
    paddings[padding],
    shadows[shadow],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses} {...props}>
      {(title || subtitle || actions) && (
        <div className={`border-b border-gray-200 dark:border-gray-700 pb-3 mb-3 ${headerClassName}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {title && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
};

export default Card;
