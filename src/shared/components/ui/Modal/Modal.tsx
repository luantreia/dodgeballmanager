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

  /**
   * El ancho máximo es una restricción de escritorio: en un teléfono el modal ocupa la pantalla
   * entera. Por eso todos los tamaños van con prefijo `sm:` — por debajo de 640px no hay ningún
   * `max-w` activo y el contenedor se estira a lo ancho del viewport.
   */
  const sizes: Record<ModalSize, string> = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    '2xl': 'sm:max-w-6xl',
    full: 'sm:max-w-full sm:mx-4'
  };

  /**
   * En mobile el modal es la pantalla: alto completo, sin bordes redondeados y sin márgenes.
   * Antes se dibujaba como un diálogo centrado con 16px de aire alrededor y esquinas redondeadas,
   * que en un monitor está bien pero en un teléfono regala el 10% del alto y dos franjas
   * laterales justo donde hace falta cada pixel — la grilla de captura son seis jugadores con
   * cuatro contadores cada uno.
   *
   * `dvh` y no `vh`: el 100vh de mobile incluye la barra de direcciones, así que el borde
   * inferior (donde vive el botón de guardar) queda debajo del pliegue.
   *
   * El padding de safe-area es obligatorio acá: `index.html` declara `viewport-fit=cover`, o sea
   * que el layout se extiende por debajo del notch y de la barra de gestos. Sin estas dos líneas
   * el encabezado se mete abajo del notch y el pie abajo del home indicator.
   */
  const modalClasses = [
    'relative bg-white dark:bg-gray-800 shadow-xl transform transition-all',
    'flex flex-col',
    'h-[100dvh] w-full rounded-none sm:h-auto sm:w-auto sm:rounded-lg',
    'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0',
    sizes[size],
    className
  ].filter(Boolean).join(' ');

  // `pr-14` reserva el lugar del botón de cerrar, que está posicionado en absoluto sobre esta
  // franja: sin esa reserva un título largo ("Captura de estadísticas por set") se le mete
  // debajo y en mobile queda ilegible justo en el renglón más importante.
  const headerClasses =
    'shrink-0 px-4 py-3 pr-14 border-b border-gray-200 dark:border-gray-700 sm:px-6 sm:py-4';

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

  // Sin padding en mobile: el modal ya ocupa la pantalla entera y cualquier margen sería una
  // franja de backdrop inútil (y tocable por accidente) alrededor del contenido.
  const overlayClasses = [
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4',
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

        {/* El área tocable es de 44px (24 de ícono + 10 de padding a cada lado), el mínimo
            táctil. Antes el botón medía exactamente lo que el ícono —24px— y era el control que
            más se usa en un teléfono: si le errás, cerrás sin querer otra cosa o no cerrás nada.
            El `top` con safe-area lo baja del notch cuando el modal ocupa la pantalla entera. */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-lg
                       text-gray-400 transition-colors [touch-action:manipulation]
                       hover:bg-gray-100 hover:text-gray-600
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50
                       dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300
                       top-[calc(env(safe-area-inset-top)+0.5rem)] sm:top-2"
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
