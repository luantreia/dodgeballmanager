import type { FC, ChangeEvent } from 'react';
import Button from '../../../../shared/components/ui/Button/Button';

type SetResumen = {
  numeroSet: number;
  estadoSet?: string;
  ganadorSet?: string;
};

type SelectorSetProps = {
  sets: SetResumen[];
  numeroSetSeleccionado: string;
  setNumeroSetSeleccionado: (value: string) => void;
  onAgregarSet: () => void;
  eliminarSet: () => void;
  eliminando: boolean;
  estadisticasSet?: SetResumen | null;
  setGanadorSet: (ganador: string) => void;
  modalidad?: string | null;
  onGuardarSet?: () => void;
};

const SelectorSet: FC<SelectorSetProps> = ({
  sets,
  numeroSetSeleccionado,
  setNumeroSetSeleccionado,
  onAgregarSet,
  eliminarSet,
  eliminando,
  estadisticasSet,
  setGanadorSet,
  modalidad,
  onGuardarSet
}) => {
  const opcionesSets = sets.map(s => ({
    value: s.numeroSet.toString(),
    label: `Set ${s.numeroSet}`
  }));

  const ultimoNumeroSet = sets.length > 0 ? Math.max(...sets.map(s => s.numeroSet)) : 0;
  const canEliminate = numeroSetSeleccionado && Number(numeroSetSeleccionado) === ultimoNumeroSet;

  // Options for SelectorGanadorSet (now internal to SelectorSet)
  const opcionesGanadorSet: Array<{ valor: string; label: string; color: string }> = [
    { valor: 'local', label: 'Equipo Local', color: 'blue' },     // Added color for styling
    { valor: 'visitante', label: 'Equipo Visitante', color: 'red' }, // Added color for styling
    ...(modalidad === 'Cloth' ? [{ valor: 'empate', label: 'Empate', color: 'yellow' }] : []), // Added color
    { valor: 'pendiente', label: 'Pendiente', color: 'gray' }     // Added color
  ];

  return (
    <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Selector de Set */}
        <div className="w-full sm:w-auto flex-grow">
          <select
            id="selector-set"
            name="selector-set"
            value={numeroSetSeleccionado}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setNumeroSetSeleccionado(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm
                       focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="" disabled>-- Seleccione un set --</option>
            {opcionesSets.map(op => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Botones de acción de Set */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Botón Nuevo Set */}
          <Button
            onClick={onAgregarSet}
            variant="primary"
            size="sm"
            className="w-full sm:w-auto whitespace-nowrap"
          >
            Nuevo Set
          </Button>

          {/* Botón para eliminar set */}
          <Button
            onClick={eliminarSet}
            disabled={eliminando || !canEliminate}
            loading={eliminando}
            variant="danger"
            size="sm"
            className="w-full sm:w-auto whitespace-nowrap"
            title={canEliminate ? `Eliminar Set ${numeroSetSeleccionado}` : "Solo se puede eliminar el último set."}
          >
            {eliminando ? 'Eliminando...' : `Eliminar Set ${numeroSetSeleccionado || 'Último Set'}`}
          </Button>
        </div>
      </div>

      {/* Selector de Ganador del Set (now with radio buttons) */}
      {estadisticasSet && (
        <div className="mt-4 pt-4 border-t border-gray-200"> {/* Removed flex and items-center as children handle layout */}
          <span className="block text-sm font-medium text-gray-700 mb-2">Ganador del set:</span>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2"> {/* flex-wrap allows items to wrap on smaller screens */}
            {opcionesGanadorSet.map(op => (
              <label key={op.valor} className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="ganadorSet" // Important: Same name for all radios in the group
                  value={op.valor}
                  checked={(estadisticasSet.ganadorSet || 'pendiente') === op.valor}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setGanadorSet(e.target.value)}
                  className={`form-radio text-${op.color}-600 focus:ring-${op.color}-500 h-4 w-4`}
                  // Added h-4 w-4 for consistent size, form-radio for browser compatibility
                />
                <span className="ml-2 text-gray-800">{op.label}</span>
              </label>
            ))}
          </div>
          {estadisticasSet && onGuardarSet && (
            <div className="mt-6">
              <Button
                onClick={onGuardarSet}
                variant="success"
                size="md"
                className="w-full"
              >
                Guardar Set
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectorSet;