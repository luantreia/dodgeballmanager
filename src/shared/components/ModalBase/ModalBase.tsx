import React, { type ReactNode } from 'react';
import { Modal } from '../ui';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalBaseProps {
  children: ReactNode;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  scrollable?: boolean;
  maxHeightClass?: string;
  bodyClassName?: string;
  isOpen?: boolean;
  overlayClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

/**
 * Contenedor de modales con estilos modernos para vistas administrativas.
 * Envuelve al componente `Modal` de la librería UI compartida.
 */
const ModalBase: React.FC<ModalBaseProps> = ({
  children,
  onClose,
  title,
  subtitle,
  size = 'lg',
  showCloseButton = true,
  footer,
  footerClassName = '',
  headerClassName = '',
  className = '',
  contentClassName = '',
  scrollable = true,
  maxHeightClass = 'max-h-[90vh]',
  bodyClassName = 'p-0',
  isOpen = true,
  overlayClassName,
  closeOnBackdrop,
  closeOnEscape,
}) => {
  const mergedClassName = [
    'relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/70',
    'dark:bg-slate-900 dark:ring-slate-700/60',
    scrollable ? maxHeightClass : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedHeaderClassName = [
    'mb-6 border-b border-slate-200/70 pb-4 dark:border-slate-700/60',
    headerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedContentClassName = [
    'flex-1',
    scrollable ? 'overflow-y-auto pr-1 custom-scrollbar' : '',
    'scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700',
    contentClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedFooterClassName = [
    'mt-6 border-t border-slate-200/70 pt-4 dark:border-slate-700/60',
    footerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      className={mergedClassName}
      showCloseButton={showCloseButton}
      bodyClassName={bodyClassName}
      overlayClassName={overlayClassName}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEscape={closeOnEscape}
      title={title}
      subtitle={subtitle}
    >
      {(title || subtitle) && (
        <div className={mergedHeaderClassName}>
          {title && (
            <h2 className="text-2xl font-semibold leading-tight text-slate-900 dark:text-white">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300/80">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className={mergedContentClassName}>{children}</div>

      {footer && <div className={mergedFooterClassName}>{footer}</div>}
    </Modal>
  );
};

export default ModalBase;
