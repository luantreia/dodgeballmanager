import React from 'react';
import { PartidoDetallado } from '../../services/partidoService';

type ConfiguracionAvanzadaSectionProps = {
  partido: PartidoDetallado;
  onCambiarModoVisualizacion: (modo: 'automatico' | 'manual') => void;
  onEliminarPartido: () => void;
};

export const ConfiguracionAvanzadaSection: React.FC<ConfiguracionAvanzadaSectionProps> = ({
  partido,
  onCambiarModoVisualizacion,
  onEliminarPartido,
}) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer text-red-800 font-medium hover:text-red-900 transition-colors">
          <span className="flex items-center gap-2">
            ⚙️ Configuración Avanzada
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" />
            </svg>
          </span>
        </summary>

        <div className="mt-4 pt-4 border-t border-red-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="text-blue-800 font-semibold mb-3">👁️ Configuración de Visualización</h4>
            <p className="text-blue-700 text-sm mb-4">
              Controla qué estadísticas ven los usuarios comunes del partido.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-700">Mostrar al público:</span>
              <select
                value={(partido.modoVisualizacion as 'automatico' | 'manual') || 'automatico'}
                onChange={(e) => onCambiarModoVisualizacion(e.target.value as 'automatico' | 'manual')}
                className="px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="automatico">📊 Estadísticas por Set (calculadas)</option>
                <option value="manual">✏️ Estadísticas Totales (ingresadas)</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-red-200 rounded-lg p-4">
            <h4 className="text-red-800 font-semibold mb-3">⚠️ Acciones Irreversibles</h4>
            <p className="text-red-700 text-sm mb-4">
              Estas acciones eliminarán permanentemente datos del partido. No se pueden deshacer.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onEliminarPartido}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                title="Eliminar este partido permanentemente"
              >
                🗑️ Eliminar Partido
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};