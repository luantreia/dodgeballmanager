import type { FC } from 'react';
import type { TipoAutocompletado } from './useEstadisticasModal';

type ModalHeaderProps = {
  tipoAutocompletado: TipoAutocompletado;
  datosIniciales?: unknown[];
};

/**
 * Componente para el encabezado del modal de estadísticas
 */
const ModalHeader: FC<ModalHeaderProps> = ({ tipoAutocompletado, datosIniciales = [] }) => {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-800">
        {tipoAutocompletado === 'automatico'
          ? '📝 Capturar Estadísticas (Autocompletadas - Automáticas)'
          : tipoAutocompletado === 'manual-previo'
            ? '📝 Capturar Estadísticas (Autocompletadas - Manuales Previos)'
            : '📝 Capturar Estadísticas Generales'
        }
      </h2>
      <p className="text-gray-600 mt-2">
        {tipoAutocompletado === 'automatico'
          ? `Se autocompletaron ${datosIniciales.length} estadísticas de datos automáticos (sets). Modifica los valores según necesites.`
          : tipoAutocompletado === 'manual-previo'
            ? 'Se autocompletaron estadísticas de capturas manuales previas. Modifica los valores según necesites.'
            : 'Ingresa las estadísticas directamente para todo el partido'
        }
      </p>
    </div>
  );
};

export default ModalHeader;
