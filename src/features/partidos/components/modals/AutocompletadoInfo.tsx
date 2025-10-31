import type { FC } from 'react';
import type { TipoAutocompletado } from '../../hooks/useEstadisticasModal';

type AutocompletadoInfoProps = {
  tipoAutocompletado: TipoAutocompletado;
  datosIniciales?: unknown[];
};

/**
 * Componente para mostrar información sobre el autocompletado
 */
const AutocompletadoInfo: FC<AutocompletadoInfoProps> = ({ tipoAutocompletado }) => {
  if (!tipoAutocompletado) return null;

  // Variables para clases dinámicas
  const autocompletadoBgClass = tipoAutocompletado === 'automatico' ? 'bg-blue-50' : 'bg-green-50';
  const autocompletadoBorderClass = tipoAutocompletado === 'automatico' ? 'border-blue-200' : 'border-green-200';
  const autocompletadoTextClass = tipoAutocompletado === 'automatico' ? 'text-blue-800' : 'text-green-800';

  return (
    <div className={`${autocompletadoBgClass} ${autocompletadoBorderClass} rounded-lg p-3 mt-3`}>
      <p className={`${autocompletadoTextClass} text-sm`}>
        💡 <strong>Autocompletado:</strong> Los valores mostrados provienen de estadísticas{' '}
        {tipoAutocompletado === 'automatico'
          ? 'calculadas automáticamente desde sets.'
          : 'capturadas manualmente en sesiones previas.'
        }
        Puedes modificarlos antes de guardar.
      </p>
    </div>
  );
};

export default AutocompletadoInfo;
