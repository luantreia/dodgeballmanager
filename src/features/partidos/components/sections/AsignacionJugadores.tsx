import type { FC } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

type EquipoReferencia = string | { _id?: string; nombre?: string } | null | undefined;

type PartidoResumen = {
  equipoLocal?: EquipoReferencia;
  equipoVisitante?: EquipoReferencia;
} | null | undefined;

type JugadorAsignable = {
  _id: string;
  jugador: { _id?: string; nombre?: string } | string;
};

type AsignacionJugadoresProps = {
  partido?: PartidoResumen;
  jugadoresLocal?: JugadorAsignable[];
  jugadoresVisitante?: JugadorAsignable[];
  loadingLocal: boolean;
  loadingVisitante: boolean;
  jugadoresSeleccionadosLocal: Set<string>;
  jugadoresSeleccionadosVisitante: Set<string>;
  toggleJugadorLocal: (jugadorId: string) => void;
  toggleJugadorVisitante: (jugadorId: string) => void;
  asignarJugadores: () => void;
  asignandoJugadores: boolean;
  hayJugadoresAsignados: boolean;
  onClose: () => void;
};

/**
 * Componente para asignar jugadores a equipos en estadísticas
 */
const AsignacionJugadores: FC<AsignacionJugadoresProps> = ({
  partido,
  jugadoresLocal,
  jugadoresVisitante,
  loadingLocal,
  loadingVisitante,
  jugadoresSeleccionadosLocal,
  jugadoresSeleccionadosVisitante,
  toggleJugadorLocal,
  toggleJugadorVisitante,
  asignarJugadores,
  asignandoJugadores,
  hayJugadoresAsignados,
  onClose
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Asignar Jugadores al Partido
        </h3>
        <p className="text-gray-600">
          Selecciona los jugadores que participarán en este partido
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Equipo Local */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
            <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
            {typeof partido?.equipoLocal === 'object' ? partido?.equipoLocal?.nombre : 'Equipo Local'}
          </h4>

          {loadingLocal ? (
            <p className="text-blue-600">Cargando jugadores...</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {jugadoresLocal?.map(jugador => {
                const jugadorId = typeof jugador.jugador === 'string' ? jugador.jugador : jugador.jugador?._id;
                const jugadorNombre = typeof jugador.jugador === 'string' ? jugador.jugador : jugador.jugador?.nombre;
                return (
                  <div key={jugador._id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`local-${jugador._id}`}
                    checked={jugadorId ? jugadoresSeleccionadosLocal.has(jugadorId) : false}
                    onChange={() => jugadorId && toggleJugadorLocal(jugadorId)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor={`local-${jugador._id}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1"
                  >
                    {jugadorNombre || 'Jugador'}
                  </label>
                </div>
              );
              })}
              {jugadoresLocal?.length === 0 && (
                <p className="text-gray-500 text-sm">No hay jugadores disponibles</p>
              )}
            </div>
          )}
        </div>

        {/* Equipo Visitante */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-3 flex items-center">
            <div className="w-4 h-4 bg-red-600 rounded mr-2"></div>
            {typeof partido?.equipoVisitante === 'object' ? partido?.equipoVisitante?.nombre : 'Equipo Visitante'}
          </h4>

          {loadingVisitante ? (
            <p className="text-red-600">Cargando jugadores...</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {jugadoresVisitante?.map(jugador => {
                const jugadorId = typeof jugador.jugador === 'string' ? jugador.jugador : jugador.jugador?._id;
                const jugadorNombre = typeof jugador.jugador === 'string' ? jugador.jugador : jugador.jugador?.nombre;
                return (
                  <div key={jugador._id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`visitante-${jugador._id}`}
                    checked={jugadorId ? jugadoresSeleccionadosVisitante.has(jugadorId) : false}
                    onChange={() => jugadorId && toggleJugadorVisitante(jugadorId)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <label
                    htmlFor={`visitante-${jugador._id}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1"
                  >
                    {jugadorNombre || 'Jugador'}
                  </label>
                </div>
              );
              })}
              {jugadoresVisitante?.length === 0 && (
                <p className="text-gray-500 text-sm">No hay jugadores disponibles</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex justify-between items-center pt-4 border-t">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          disabled={asignandoJugadores}
        >
          Cancelar
        </button>

        <div className="flex space-x-3">
          {hayJugadoresAsignados && (
            <button
              onClick={() => window.location.reload()} // Recargar para volver a captura
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              disabled={asignandoJugadores}
            >
              Modificar Asignación
            </button>
          )}

          <button
            onClick={asignarJugadores}
            disabled={asignandoJugadores || (jugadoresSeleccionadosLocal.size === 0 && jugadoresSeleccionadosVisitante.size === 0)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {asignandoJugadores ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Asignando...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Confirmar Asignación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsignacionJugadores;
