import React, { useState } from 'react';
import { ISolicitudContexto, SolicitudEdicionTipo } from '../../../types/solicitudesEdicion';
import SolicitudModal from '../SolicitudModal/SolicitudModal';

interface SolicitudButtonProps {
  contexto: ISolicitudContexto;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'icon';
  onSuccess?: () => void;
  icon?: React.ReactNode;
  prefillTipo?: SolicitudEdicionTipo;
  prefillDatos?: Record<string, any>;
}

/**
 * Botón para abrir el modal de solicitud de edición
 */
export const SolicitudButton: React.FC<SolicitudButtonProps> = ({
  contexto,
  label = 'Solicitar Cambio',
  className,
  variant = 'primary',
  onSuccess,
  icon,
  prefillTipo,
  prefillDatos,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const variantClasses = {
    primary:
      'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition',
    secondary:
      'px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 transition',
    danger:
      'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition',
    icon: 'p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition',
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={className || variantClasses[variant]}
        title={label}
      >
        {icon ? (
          <span className="flex items-center gap-2">
            {icon}
            {variant !== 'icon' && label}
          </span>
        ) : (
          label
        )}
      </button>

      <SolicitudModal
        isOpen={isModalOpen}
        contexto={contexto}
        onClose={() => setIsModalOpen(false)}
        onSuccess={onSuccess}
        prefillTipo={prefillTipo}
        prefillDatos={prefillDatos}
      />
    </>
  );
};

export default SolicitudButton;
