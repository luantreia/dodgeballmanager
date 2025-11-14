import React, { useEffect, useState } from 'react';
import { Input } from '../../../shared/components/ui';
import SolicitudModal from '../../../shared/components/SolicitudModal/SolicitudModal';
import { SolicitudButton } from '../../../shared/components';
import { buscarJugadoresDisponibles, type JugadorOpcion } from '../services/jugadorEquipoOpcionesService';
import { useEquipo } from '../../../app/providers/EquipoContext';

type Props = {
  equipoId: string;
  onSuccess?: () => void;
};

const InvitarJugadorSection: React.FC<Props> = ({ equipoId, onSuccess }) => {
  const [inviteSeleccionado, setInviteSeleccionado] = useState<JugadorOpcion | null>(null);
  const [opcionesJugadores, setOpcionesJugadores] = useState<JugadorOpcion[]>([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [openSolicitudJugadorId, setOpenSolicitudJugadorId] = useState<string | null>(null);
  const { equipoSeleccionado } = useEquipo();

  useEffect(() => {
    const controller = new AbortController();
    const fetchOpciones = async () => {
      try {
        const jugadoresDisponibles = await buscarJugadoresDisponibles(equipoId, inviteQuery);
        if (!controller.signal.aborted) {
          setOpcionesJugadores(jugadoresDisponibles);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err);
        }
      }
    };

    const timeoutId = window.setTimeout(fetchOpciones, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [equipoId, inviteQuery]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Invitar jugador</h2>
          <p className="mt-1 text-sm text-slate-500">
            Buscá jugadores disponibles y abrí la solicitud de invitación desde la lista.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <Input
            id="jugador-search"
            label="Buscar jugador por nombre"
            value={inviteQuery}
            onChange={(event) => setInviteQuery((event.target as HTMLInputElement).value)}
            placeholder="Ej. Juan Pérez"
          />
          {opcionesJugadores.length ? (
            <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              {opcionesJugadores.map((jugador) => {
                const seleccionado = inviteSeleccionado?.id === jugador.id;
                return (
                  <li
                    key={jugador.id}
                    className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${seleccionado ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}
                    onClick={() => {
                      setInviteSeleccionado(jugador);
                      // abrir modal prellenado para crear solicitud de invitación
                      setOpenSolicitudJugadorId(jugador.id);
                    }}
                    role="button"
                  >
                    <p className="font-medium text-slate-900">{jugador.nombre}</p>
                    {jugador.alias ? (
                      <p className="text-xs text-slate-500">Alias: {jugador.alias}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {inviteSeleccionado ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Seleccionado:</p>
            <p>{inviteSeleccionado.nombre}</p>
            {inviteSeleccionado.alias ? <p>Alias: {inviteSeleccionado.alias}</p> : null}
            {inviteSeleccionado.nacionalidad ? <p>País: {inviteSeleccionado.nacionalidad}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Modal para crear solicitud prellenada cuando se selecciona un jugador */}
      <SolicitudModal
        isOpen={!!openSolicitudJugadorId}
        contexto={{ contexto: 'equipo', entidadId: equipoId }}
        onClose={() => {
          setOpenSolicitudJugadorId(null);
          setInviteSeleccionado(null);
        }}
        onSuccess={() => {
          setOpenSolicitudJugadorId(null);
          setInviteSeleccionado(null);
          onSuccess?.();
        }}
        prefillTipo={"jugador-equipo-crear"}
        prefillDatos={{
          jugadorId: openSolicitudJugadorId,
          jugadorNombre: inviteSeleccionado?.nombre,
          jugadorAlias: inviteSeleccionado?.alias,
          equipoId,
          equipoNombre: equipoSeleccionado?.nombre,
        }}
      />
    </section>
  );
};

export default InvitarJugadorSection;
