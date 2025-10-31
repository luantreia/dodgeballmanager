import type { FC } from 'react';

type SetResumen = {
  numeroSet: number;
  estadoSet?: string;
  ganadorSet?: string;
  equipoLocal?: { nombre?: string } | null;
  equipoVisitante?: { nombre?: string } | null;
};

type EstadisticasSet = {
  ganadorSet?: string;
  estadoSet?: string;
  equipoLocal?: { nombre?: string } | null;
  equipoVisitante?: { nombre?: string } | null;
};

type SetManagerProps = {
  setsLocales: SetResumen[];
  numeroSetSeleccionado: string;
  setNumeroSetSeleccionado: (value: string) => void;
  estadisticasSet?: EstadisticasSet | null;
  onAgregarSet: () => void;
  onEliminarSet: () => void;
  eliminando: boolean;
  setGanadorSet: (ganador: string) => void;
  guardar: (autoCerrar?: boolean) => void;
};

export const SetManager: FC<SetManagerProps> = ({
  setsLocales,
  numeroSetSeleccionado,
  setNumeroSetSeleccionado,
  estadisticasSet,
  onAgregarSet,
  onEliminarSet,
  eliminando,
  setGanadorSet,
  guardar
}) => {
  const handleChangeGanador = (ganador: string) => {
    setGanadorSet(ganador);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Sets del Partido</h3>
        <button
          onClick={onAgregarSet}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          + Nuevo Set
        </button>
      </div>

      {/* Selector de set */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Set a editar:
        </label>
        <select
          value={numeroSetSeleccionado}
          onChange={(e) => setNumeroSetSeleccionado(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Seleccione un set --</option>
          {setsLocales.map(set => (
            <option key={set.numeroSet} value={set.numeroSet}>
              Set {set.numeroSet} - {set.estadoSet === 'finalizado' ? 'Finalizado' : 'En Juego'}
            </option>
          ))}
        </select>
      </div>

      {estadisticasSet && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ganador del set:
              </label>
              <select
                value={estadisticasSet.ganadorSet || 'pendiente'}
                onChange={(e) => handleChangeGanador(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pendiente">Pendiente</option>
                <option value="local">{estadisticasSet.equipoLocal?.nombre || 'Equipo Local'}</option>
                <option value="visitante">{estadisticasSet.equipoVisitante?.nombre || 'Equipo Visitante'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado:
              </label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                estadisticasSet.estadoSet === 'finalizado'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {estadisticasSet.estadoSet === 'finalizado' ? 'Finalizado' : 'En Juego'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => guardar(false)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Guardar Set
              </button>
              <button
                onClick={onEliminarSet}
                disabled={eliminando}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar Set'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
