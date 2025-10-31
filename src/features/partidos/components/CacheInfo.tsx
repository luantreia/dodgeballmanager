// src/components/estadisticas/CacheInfo.js
import type { FC } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

type CacheInfoProps = {
  className?: string;
};

/**
 * Componente informativo sobre el comportamiento del cache durante capturas
 */
const CacheInfo: FC<CacheInfoProps> = ({ className = '' }) => {
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <InformationCircleIcon className="w-5 h-5 mt-0.5" />
        <div className="text-sm">
          <h4 className="font-medium mb-2">
            💾 Información sobre Cache de Datos
          </h4>
          <div className="space-y-1">
            <p>
              • <strong>Datos frescos:</strong> Se mantienen disponibles por 15 minutos sin recargar
            </p>
            <p>
              • <strong>Datos guardados:</strong> Tus cambios se envían inmediatamente al servidor
            </p>
            <p>
              • <strong>Sin pérdida de trabajo:</strong> Los datos sin guardar permanecen en el formulario
            </p>
            <p>
              • <strong>Recuperación automática:</strong> Si pierdes conexión, puedes continuar capturando
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheInfo;
