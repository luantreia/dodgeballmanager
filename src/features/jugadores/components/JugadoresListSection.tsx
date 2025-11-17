import React, { useMemo, useState } from 'react';
import type { Jugador } from '../../../shared/utils/types/types';
import SolicitudModal from '../../../shared/components/SolicitudModal/SolicitudModal';

interface JugadoresListSectionProps {
  jugadores: Jugador[];
  equipoId: string;
  onVerContratosNoActivos?: () => void;
  onSolicitudSuccess?: () => void;
}

const estadoColorMap: Record<Jugador['estado'], string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  pendiente: 'bg-amber-100 text-amber-700',
  baja: 'bg-rose-100 text-rose-700',
};

const JugadoresListSection: React.FC<JugadoresListSectionProps> = ({
  jugadores,
  equipoId,
  onVerContratosNoActivos,
  onSolicitudSuccess,
}) => {
  const [editingContratoId, setEditingContratoId] = useState<string | null>(null);

  const jugadoresPorContrato = useMemo(() => {
    const map = new Map<string, Jugador>();
    jugadores.forEach((jugador) => {
      if (jugador.contratoId) {
        map.set(jugador.contratoId, jugador);
      }
    });
    return map;
  }, [jugadores]);

  const handleEditarJugador = (contratoId: string) => {
    const jugador = jugadoresPorContrato.get(contratoId);
    if (!jugador) return;
    setEditingContratoId(contratoId);
  };

  const handleCloseModal = () => {
    setEditingContratoId(null);
  };

  const handleModalSuccess = () => {
    handleCloseModal();
    onSolicitudSuccess?.();
  };

  const editingJugador = editingContratoId ? jugadoresPorContrato.get(editingContratoId) : null;

  return (
    <>
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
                      <button
                        type="button"
                        onClick={() => jugador.contratoId && handleEditarJugador(jugador.contratoId)}
                        disabled={!jugador.contratoId}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Editar
                      </button>
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
      </div>

      {/* Modal para editar contrato */}
      {editingJugador ? (
        <SolicitudModal
          isOpen={!!editingContratoId}
          contexto={{ contexto: 'equipo', entidadId: equipoId }}
          onClose={handleCloseModal}
          onSuccess={handleModalSuccess}
          prefillTipo={'jugador-equipo-editar'}
          prefillDatos={{
            contratoId: editingContratoId!,
            jugadorId: editingJugador.id,
            jugadorNombre: editingJugador.nombre,
            jugadorAlias: (editingJugador as any).alias,
            equipoId,
            equipoNombre: (editingJugador as any).equipoNombre,
            rol: editingJugador.rol ?? editingJugador.rolEnEquipo ?? 'jugador',
            numeroCamiseta: editingJugador.numeroCamiseta ?? undefined,
            desde: editingJugador.fechaInicio ? editingJugador.fechaInicio.slice(0, 10) : undefined,
            hasta: editingJugador.fechaFin ? editingJugador.fechaFin.slice(0, 10) : undefined,
            estado: editingJugador.estado ?? 'activo',
            foto: (editingJugador as any).foto,
          }}
        />
      ) : null}
    </>
  );
};

export default JugadoresListSection;
