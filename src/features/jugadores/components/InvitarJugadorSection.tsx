import React, { useEffect, useState } from 'react';
import { Input } from '../../../shared/components/ui';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { buscarJugadoresDisponibles, type JugadorOpcion } from '../services/jugadorEquipoOpcionesService';
import { crearSolicitudEdicion } from '../services/solicitudesEdicionService';

type Props = {
  equipoId: string;
  onSuccess?: () => void;
};

const InvitarJugadorSection: React.FC<Props> = ({ equipoId, onSuccess }) => {
  const { addToast } = useToast();
  const [inviteSeleccionado, setInviteSeleccionado] = useState<JugadorOpcion | null>(null);
  const [opcionesJugadores, setOpcionesJugadores] = useState<JugadorOpcion[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteFechaInicio, setInviteFechaInicio] = useState('');
  const [inviteFechaFin, setInviteFechaFin] = useState('');

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!inviteSeleccionado) {
      setInviteError('Seleccioná un jugador antes de enviar la invitación.');
      addToast({ type: 'info', title: 'Falta seleccionar jugador', message: 'Elegí un jugador para invitar' });
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);
      await crearSolicitudEdicion({
        tipo: 'jugador-equipo-crear',
        entidad: null,
        datosPropuestos: {
          equipoId,
          jugadorId: inviteSeleccionado.id,
          fechaInicio: inviteFechaInicio || undefined,
          fechaFin: inviteFechaFin || undefined,
        },
      });
      onSuccess?.();
      setInviteSeleccionado(null);
      setInviteQuery('');
      setOpcionesJugadores([]);
      setInviteFechaInicio('');
      setInviteFechaFin('');
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'La solicitud fue enviada para aprobación.' });
    } catch (err) {
      console.error(err);
      setInviteError('No pudimos enviar la invitación. Confirmá que el jugador no tenga una solicitud activa.');
      addToast({ type: 'error', title: 'Error al invitar', message: 'No se pudo enviar la invitación' });
    } finally {
      setInviteLoading(false);
    }
  };

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
      <h2 className="text-lg font-semibold text-slate-900">Invitar jugador</h2>
      <p className="mt-1 text-sm text-slate-500">
        Buscá jugadores disponibles y enviáles una invitación para sumarse al equipo.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleInvite}>
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
                    onClick={() => setInviteSeleccionado(jugador)}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Input
              id="fecha-inicio-invitacion"
              label="Fecha de inicio (opcional)"
              type="date"
              value={inviteFechaInicio}
              onChange={(event) => setInviteFechaInicio((event.target as HTMLInputElement).value)}
            />
          </div>
          <div>
            <Input
              id="fecha-fin-invitacion"
              label="Fecha de finalización (opcional)"
              type="date"
              value={inviteFechaFin}
              onChange={(event) => setInviteFechaFin((event.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        {inviteError ? <p className="text-sm text-rose-600">{inviteError}</p> : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={inviteLoading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
          >
            {inviteLoading ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default InvitarJugadorSection;
