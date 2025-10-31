import type { FC } from 'react';
import EstadisticasGeneralesPartido from '../../../estadisticas/components/EstadisticasGeneralesPartido';
import type { Partido } from '../../../../types';

type ModoEstadisticas = 'manual' | 'automatico';

type PartidoConModos = Partido & {
  _id?: string;
  modoEstadisticas?: ModoEstadisticas;
  modoVisualizacion?: ModoEstadisticas;
};

type SeccionEstadisticasGeneralesProps = {
  partido: PartidoConModos | null;
  partidoId: string;
  onRefresh?: (refetch: () => Promise<void>) => void;
  onCambiarModoEstadisticas: (partidoId: string, nuevoModo: ModoEstadisticas) => Promise<void>;
  onAbrirCaptura?: () => void;
};

export const SeccionEstadisticasGenerales: FC<SeccionEstadisticasGeneralesProps> = ({
  partido,
  partidoId,
  onRefresh,
  onCambiarModoEstadisticas,
  onAbrirCaptura,
}) => {
  const esManual = partido?.modoEstadisticas === 'manual';
  const descripcion = esManual
    ? 'Modo Manual: Estadísticas totales del partido (ingresadas directamente)'
    : 'Modo Automático: Estadísticas detalladas por set individual';

  const partidoAdaptado = partido
    ? ({
        _id: partido._id ?? partido.id ?? partidoId,
        ...partido,
      } as const)
    : undefined;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold text-blue-800">📊 Estadísticas Generales</h4>
          <p className="text-sm text-blue-700">{descripcion}</p>
        </div>

        {onAbrirCaptura && (
          <button
            type="button"
            onClick={onAbrirCaptura}
            className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Capturar estadísticas
          </button>
        )}
      </div>
      <EstadisticasGeneralesPartido
        key={`generales-${partido?.modoEstadisticas}-${partido?.modoVisualizacion}`}
        partidoId={partidoId}
        partido={partidoAdaptado}
        onRefresh={onRefresh}
        onCambiarModoEstadisticas={onCambiarModoEstadisticas}
      />
    </div>
  );
};
