// src/components/ui/Modal/Modal.tsx
import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  overlayClassName?: string;
  showCloseButton?: boolean;
  bodyClassName?: string;
}

/**
 * Cuántos modales hay abiertos a la vez. El scroll del body se bloquea al abrir el primero y
 * se libera recién al cerrar el último: sin esto, cerrar un modal anidado (p. ej. la captura
 * de estadísticas que se abre desde el modal de administración del partido) devolvía el scroll
 * al fondo mientras seguía habiendo un modal arriba.
 */
let modalesAbiertos = 0;

/**
 * Componente Modal reutilizable mejorado
 */
const Modal = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
  overlayClassName = '',
  showCloseButton = true,
  bodyClassName = 'px-6 py-4',
  ...props
}: ModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (!isOpen) return;

    modalesAbiertos += 1;
    // El nivel de este modal en la pila. El listener de Escape vive en `document`, así que con
    // dos modales abiertos —una confirmación de borrado sobre el modal que la abrió— los dos
    // recibían la tecla y se cerraban juntos: cancelabas la confirmación y perdías también la
    // pantalla de atrás. Sólo reacciona el de más arriba.
    const miNivel = modalesAbiertos;

    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape' && miNivel === modalesAbiertos) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      modalesAbiertos = Math.max(0, modalesAbiertos - 1);
      if (modalesAbiertos === 0) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const node = containerRef.current;
    if (!node) return;
    // Focus primer elemento focuseable o el contenedor
    const focusable = node.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusable ?? node).focus?.();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (active === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    node.addEventListener('keydown', handleTab);
    return () => node.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes: Record<ModalSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-full mx-4'
  };

  const modalClasses = [
    'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all',
    'flex flex-col',
    sizes[size],
    className
  ].filter(Boolean).join(' ');

  const headerClasses = 'px-6 py-4 border-b border-gray-200 dark:border-gray-700';

  // `flex min-h-0 flex-1 flex-col` no es decorativo: sin el `min-h-0` este div se niega a
  // encogerse por debajo de su contenido, el `overflow-hidden` del contenedor lo recorta y el
  // `overflow-y-auto` de adentro nunca llega a activarse. Resultado: en un modal más alto que
  // el viewport el footer —y con él el botón de guardar— queda inalcanzable, sobre todo en
  // mobile. Tampoco va padding acá: lo define `bodyClassName` para que se pueda anular.
  const bodyClasses = [
    'flex min-h-0 flex-1 flex-col',
    'overflow-x-hidden',
    bodyClassName
  ].filter(Boolean).join(' ');

  const overlayClasses = [
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
    overlayClassName
  ].filter(Boolean).join(' ');

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className={overlayClasses} onClick={handleBackdropClick}>
      <div
        className={modalClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `modal-${titleId}-title` : undefined}
        aria-describedby={subtitle ? `modal-${titleId}-subtitle` : undefined}
        tabIndex={-1}
        ref={containerRef}
        {...props}
      >
        {(title || subtitle) && (
          <div className={headerClasses}>
            {title && (
              <h3 id={`modal-${titleId}-title`} className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p id={`modal-${titleId}-subtitle`} className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className={bodyClasses}>
          {children}
        </div>

        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
