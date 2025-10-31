import type { Jugador, SolicitudJugador } from '../../../types';

export interface JugadorListProps {
  jugadores: Jugador[];
  solicitudesPendientes?: SolicitudJugador[];
  onAceptarSolicitud?: (solicitudId: string) => void;
  onRechazarSolicitud?: (solicitudId: string) => void;
  onEditarJugador?: (jugadorId: string) => void;
  onVerContratosNoActivos?: () => void;
}

const estadoColorMap: Record<Jugador['estado'], string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  pendiente: 'bg-amber-100 text-amber-700',
  baja: 'bg-rose-100 text-rose-700',
};

const JugadorList = ({
  jugadores,
  solicitudesPendientes = [],
  onAceptarSolicitud,
  onRechazarSolicitud,
  onEditarJugador,
  onVerContratosNoActivos,
}: JugadorListProps) => (
  <div className="space-y-6">
    <section>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Jugadores activos</h3>
          <p className="text-sm text-slate-500">{jugadores.length} jugadores</p>
        </div>
        {onVerContratosNoActivos ? (
          <button
            type="button"
            onClick={onVerContratosNoActivos}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Ver contratos no activos
          </button>
        ) : null}
      </header>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Rol</th>
              <th className="px-6 py-3">Número</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3">Contrato</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {jugadores.map((jugador) => (
              <tr key={jugador.id} className="hover:bg-slate-50/60">
                <td className="px-6 py-4 font-medium text-slate-900">{jugador.nombre}</td>
                <td className="px-6 py-4 text-slate-600">{jugador.rolEnEquipo ?? jugador.posicion}</td>
                <td className="px-6 py-4">#{jugador.numeroCamiseta ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${estadoColorMap[jugador.estado]}`}>
                    {jugador.estado}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col text-xs text-slate-500">
                    <span>Inicio: {jugador.fechaInicio ?? '—'}</span>
                    <span>Fin: {jugador.fechaFin ?? '—'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {onEditarJugador ? (
                    <button
                      type="button"
                      onClick={() => jugador.contratoId && onEditarJugador(jugador.contratoId)}
                      disabled={!jugador.contratoId}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Editar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jugadores.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Aún no hay jugadores activos cargados para este equipo.
        </p>
      ) : null}
    </section>

    {solicitudesPendientes.length ? (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-amber-800">Solicitudes pendientes</h3>
          <p className="text-sm text-amber-700">
            Gestioná las últimas solicitudes de jugadores que quieren sumarse.
          </p>
        </header>
        <ul className="space-y-4">
          {solicitudesPendientes.map((solicitud) => (
            <li key={solicitud.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{solicitud.jugador.nombre}</p>
                <p className="text-xs text-slate-500">
                  Posición: {solicitud.jugador.posicion} • Estado: {solicitud.estado}
                </p>
                {solicitud.mensaje ? (
                  <p className="mt-1 text-xs text-slate-500">“{solicitud.mensaje}”</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {onRechazarSolicitud ? (
                  <button
                    type="button"
                    onClick={() => onRechazarSolicitud(solicitud.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                  >
                    {solicitud.origen === 'equipo' ? 'Cancelar' : 'Rechazar'}
                  </button>
                ) : null}
                {onAceptarSolicitud && solicitud.origen !== 'equipo' ? (
                  <button
                    type="button"
                    onClick={() => onAceptarSolicitud(solicitud.id)}
                    className="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800"
                  >
                    Aceptar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    ) : null}
  </div>
);

export default JugadorList;
