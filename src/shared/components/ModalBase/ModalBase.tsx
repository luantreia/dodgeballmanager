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
  /**
   * Marcá el modal como "tiene cambios sin guardar" y cerrar por backdrop o Escape pide
   * confirmación. En mobile el backdrop se toca sin querer todo el tiempo: sin esto, una
   * planilla entera de estadísticas se pierde con un roce.
   */
  hasUnsavedChanges?: boolean;
  unsavedMessage?: string;
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
  // `dvh` y no `vh`: en mobile el 100vh incluye la barra de direcciones, así que un 90vh
  // real se come el borde inferior del modal justo donde vive el botón de guardar.
  // En mobile el modal ocupa la pantalla entera (lo resuelve `Modal`), así que el 90% queda
  // sólo para escritorio, donde un diálogo pegado a los bordes se ve mal.
  maxHeightClass = 'max-h-[100dvh] sm:max-h-[90dvh]',
  bodyClassName = 'px-4 py-3 sm:px-6 sm:py-4',
  isOpen = true,
  overlayClassName,
  closeOnBackdrop,
  closeOnEscape,
  hasUnsavedChanges = false,
  unsavedMessage = 'Tenés cambios sin guardar. ¿Querés cerrar y descartarlos?',
}) => {
  const handleClose = () => {
    if (hasUnsavedChanges && !window.confirm(unsavedMessage)) return;
    onClose();
  };

  const mergedClassName = [
    'relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/70',
    'dark:bg-slate-900 dark:ring-slate-700/60',
    scrollable ? maxHeightClass : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // `pr-12` reserva la columna del botón de cerrar, que va posicionado en absoluto encima de
  // esta franja. Sin eso, en un teléfono el título se le mete abajo: "Captura de estadísticas
  // por set" a 24px no entra en 375px de ancho y terminaba partido bajo la X.
  const mergedHeaderClassName = [
    'shrink-0 mb-0.5 sm:mb-1 border-b border-slate-200/70 pb-1 pr-12 sm:pb-2 sm:pr-14 dark:border-slate-700/60',
    headerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedContentClassName = [
    'flex-1',
    scrollable ? 'overflow-y-auto pr-0.5 sm:pr-1 custom-scrollbar' : '',
    'scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700',
    contentClassName,
  ]
    .filter(Boolean)
    .join(' ');

  /**
   * El pie no scrollea: es hermano del cuerpo dentro de un flex column, y el cuerpo es el único
   * que crece y desborda. Por eso todo lo que sea "guardar" tiene que vivir acá y no al final
   * del contenido — en la captura de un set, el contenido son doce tarjetas de jugador apiladas
   * y el botón quedaba a varias pantallas de scroll de distancia.
   *
   * `bg-white` explícito: al quedar sobre el contenido que pasa por debajo, sin fondo propio se
   * transparentaba.
   */
  const mergedFooterClassName = [
    'shrink-0 mt-2 sm:mt-4 border-t border-slate-200/70 bg-white pt-2 sm:pt-4',
    'dark:border-slate-700/60 dark:bg-slate-900',
    footerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={size}
      className={mergedClassName}
      showCloseButton={showCloseButton}
      bodyClassName={bodyClassName}
      overlayClassName={overlayClassName}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEscape={closeOnEscape}
    >
      {(title || subtitle) && (
        <div className={mergedHeaderClassName}>
          {/* 24px de título en 375px de pantalla consumen dos renglones para decir "Mi
              planilla". Baja a 18px en mobile y recupera el tamaño en escritorio. */}
          {title && (
            <h2 className="text-lg font-semibold leading-tight text-slate-900 sm:text-2xl dark:text-white">
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
