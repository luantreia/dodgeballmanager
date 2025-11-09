import React from 'react';
import { useEquipo } from '../../../app/providers/EquipoContext';
import EquipoSolicitudesEdicion from '../../jugadores/components/EquipoSolicitudesEdicion';

const NotificacionesPage = () => {
  const { equipoSeleccionado } = useEquipo();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Notificaciones</h1>
        <p className="text-sm text-slate-500">
          Revisá las solicitudes de ingreso pendientes y su estado.
        </p>
      </header>

      {!equipoSeleccionado ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
          Seleccioná un equipo para ver sus solicitudes.
        </p>
      ) : (
        <div className="space-y-8">
          <EquipoSolicitudesEdicion equipoId={equipoSeleccionado.id} />
        </div>
      )}
    </div>
  );
};

export default NotificacionesPage;
