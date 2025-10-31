import type { ReactNode } from 'react';
import type {
  EstadisticaManualEquipo,
  EstadisticaManualJugador,
  EstadisticaSetResumen,
} from '../services/estadisticasService';
import { MensajeSinDatos } from './MensajeSinDatos';
import { EstadisticasGeneralesHeader } from './EstadisticasGeneralesHeader';
import { EstadisticasCards } from './EstadisticasCards';
import { DistribucionEquiposChart } from './DistribucionEquiposChart';
import { ComparativaEquiposTable } from './ComparativaEquiposTable';

type ModoEstadisticas = 'automatico' | 'manual';

type EstadisticasGeneralesData = {
  jugadores?: EstadisticaManualJugador[];
  equipos?: EstadisticaManualEquipo[];
  setsInfo?: EstadisticaSetResumen[];
  mensaje?: string;
  tipo?: string;
};

export const renderEstadisticasGenerales = (
  estadisticas: EstadisticasGeneralesData,
  _partido: unknown,
  modoEstadisticasUI: ModoEstadisticas = 'automatico',
  modoVisualizacionUI: ModoEstadisticas = 'automatico',
): ReactNode => {
  void modoVisualizacionUI;

  if (estadisticas.mensaje && estadisticas.tipo === 'sin-datos-manuales') {
    return <MensajeSinDatos estadisticas={estadisticas} />;
  }

  return (
    <div className="space-y-8">
      <EstadisticasGeneralesHeader modoEstadisticasUI={modoEstadisticasUI} />

      <EstadisticasCards estadisticas={estadisticas} />

      <DistribucionEquiposChart estadisticas={estadisticas} modoEstadisticasUI={modoEstadisticasUI} />

      <ComparativaEquiposTable estadisticas={estadisticas} modoEstadisticasUI={modoEstadisticasUI} />
    </div>
  );
};
