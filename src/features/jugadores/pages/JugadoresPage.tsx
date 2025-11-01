import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import JugadorList from '../components/JugadorList';
import { useEquipo } from '../../../app/providers/EquipoContext';
import {
  actualizarEstadoJugador,
  getContratosNoActivos,
  getJugadoresEquipo,
  getSolicitudesJugadores,
  invitarJugador,
} from '../services/jugadorEquipoService';
import { buscarJugadoresDisponibles, type JugadorOpcion } from '../services/jugadorEquipoOpcionesService';
import { crearSolicitudEdicion } from '../services/solicitudesEdicionService';
import type { Jugador, SolicitudJugador, ContratoJugadorResumen } from '../../../types';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { Select, Input } from '../../../shared/components/ui';

const JugadoresPage = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado } = useEquipo();
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudJugador[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteSeleccionado, setInviteSeleccionado] = useState<JugadorOpcion | null>(null);
  const [opcionesJugadores, setOpcionesJugadores] = useState<JugadorOpcion[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteFechaInicio, setInviteFechaInicio] = useState('');
  const [inviteFechaFin, setInviteFechaFin] = useState('');
  const [editingContratoId, setEditingContratoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fechaInicio: '', fechaFin: '', rol: 'jugador' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [showContratosModal, setShowContratosModal] = useState(false);
  const [contratosNoActivos, setContratosNoActivos] = useState<ContratoJugadorResumen[]>([]);
  const [contratosLoading, setContratosLoading] = useState(false);
  const [contratosError, setContratosError] = useState<string | null>(null);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setJugadores([]);
      setSolicitudes([]);
      return;
    }

    let isCancelled = false;

    const fetchJugadores = async () => {
      try {
        setLoading(true);
        const [activos, pendientes] = await Promise.all([
          getJugadoresEquipo({ equipoId }),
          getSolicitudesJugadores(equipoId),
        ]);

        if (isCancelled) return;

        setJugadores(activos);
        setSolicitudes(pendientes);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          setError('No pudimos cargar la lista de jugadores.');
          addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar la lista de jugadores.' });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchJugadores();

    return () => {
      isCancelled = true;
    };
  }, [equipoSeleccionado?.id]);

  const refreshData = async () => {
    if (!equipoSeleccionado) return;
    const [activos, pendientes] = await Promise.all([
      getJugadoresEquipo({ equipoId: equipoSeleccionado.id }),
      getSolicitudesJugadores(equipoSeleccionado.id),
    ]);
    setJugadores(activos);
    setSolicitudes(pendientes);
  };

  const handleAceptarSolicitud = async (solicitudId: string) => {
    try {
      await actualizarEstadoJugador(solicitudId, { estado: 'aceptado' });
      await refreshData();
      addToast({ type: 'success', title: 'Solicitud aceptada', message: 'El jugador fue agregado al equipo' });
    } catch (err) {
      console.error(err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos aceptar la solicitud' });
    }
  };

  const handleRechazarSolicitud = async (solicitudId: string) => {
    try {
      await actualizarEstadoJugador(solicitudId, { estado: 'rechazado' });
      await refreshData();
      addToast({ type: 'success', title: 'Solicitud rechazada', message: 'Se rechazó la solicitud del jugador' });
    } catch (err) {
      console.error(err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos rechazar la solicitud' });
    }
  };

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
    setEditForm({
      fechaInicio: jugador.fechaInicio ? jugador.fechaInicio.slice(0, 10) : '',
      fechaFin: jugador.fechaFin ? jugador.fechaFin.slice(0, 10) : '',
      rol: jugador.rol ?? jugador.rolEnEquipo ?? 'jugador',
    });
    setEditError(null);
    setEditSuccess(null);
  };

  const handleCloseModal = () => {
    setEditingContratoId(null);
    setEditForm({ fechaInicio: '', fechaFin: '', rol: 'jugador' });
    setEditError(null);
    setEditSuccess(null);
  };

  const handleEditFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuardarEdicion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingContratoId) return;

    const contrato = jugadoresPorContrato.get(editingContratoId);
    if (!contrato) return;

    const fechaInicioOriginal = contrato.fechaInicio ? contrato.fechaInicio.slice(0, 10) : '';
    const fechaFinOriginal = contrato.fechaFin ? contrato.fechaFin.slice(0, 10) : '';
    const rolOriginal = contrato.rol ?? contrato.rolEnEquipo ?? 'jugador';
    const estadoOriginalBackend = contrato.estado === 'baja' ? 'baja' : 'aceptado';
    const estadoDeseado = editForm.fechaFin ? 'baja' : 'aceptado';

    const cambios: Record<string, string | null> = {};
    if (editForm.fechaInicio !== fechaInicioOriginal) {
      cambios.desde = editForm.fechaInicio || null;
    }
    if (editForm.fechaFin !== fechaFinOriginal) {
      cambios.hasta = editForm.fechaFin || null;
    }
    if (editForm.rol !== rolOriginal) {
      cambios.rol = editForm.rol;
    }
    if (estadoDeseado !== estadoOriginalBackend) {
      cambios.estado = estadoDeseado;
    }

    if (Object.keys(cambios).length === 0) {
      setEditError('No realizaste cambios en el contrato.');
      return;
    }

    try {
      setEditLoading(true);
      setEditError(null);
      await crearSolicitudEdicion({
        tipo: 'contratoJugadorEquipo',
        entidad: editingContratoId,
        datosPropuestos: cambios,
      });
      setEditSuccess('Solicitud enviada para revisión.');
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'Se envió la solicitud de edición del contrato' });
      await refreshData();
    } catch (err) {
      console.error(err);
      setEditError('No pudimos crear la solicitud. Intenta nuevamente.');
      addToast({ type: 'error', title: 'Error', message: 'No pudimos crear la solicitud de edición' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleVerContratosNoActivos = async () => {
    if (!equipoSeleccionado) return;
    try {
      setContratosLoading(true);
      setContratosError(null);
      const contratos = await getContratosNoActivos(equipoSeleccionado.id);
      setContratosNoActivos(contratos);
      setShowContratosModal(true);
    } catch (err) {
      console.error(err);
      setContratosError('No pudimos cargar los contratos inactivos. Intenta nuevamente.');
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar los contratos inactivos' });
      setShowContratosModal(true);
    } finally {
      setContratosLoading(false);
    }
  };

  const handleCloseContratosModal = () => {
    setShowContratosModal(false);
    setContratosError(null);
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!equipoSeleccionado) return;

    if (!inviteSeleccionado) {
      setInviteError('Seleccioná un jugador antes de enviar la invitación.');
      addToast({ type: 'info', title: 'Falta seleccionar jugador', message: 'Elegí un jugador para invitar' });
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);
      await invitarJugador({
        equipoId: equipoSeleccionado.id,
        jugadorId: inviteSeleccionado.id,
        fechaInicio: inviteFechaInicio || undefined,
        fechaFin: inviteFechaFin || undefined,
      });
      await refreshData();
      setInviteSeleccionado(null);
      setInviteQuery('');
      setOpcionesJugadores([]);
      setInviteFechaInicio('');
      setInviteFechaFin('');
      addToast({ type: 'success', title: 'Invitación enviada', message: 'El jugador fue invitado correctamente' });
    } catch (err) {
      console.error(err);
      setInviteError('No pudimos enviar la invitación. Confirmá que el jugador no tenga una solicitud activa.');
      addToast({ type: 'error', title: 'Error al invitar', message: 'No se pudo enviar la invitación' });
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    if (!equipoSeleccionado) {
      setOpcionesJugadores([]);
      return;
    }

    const controller = new AbortController();
    const fetchOpciones = async () => {
      try {
        const jugadoresDisponibles = await buscarJugadoresDisponibles(equipoSeleccionado.id, inviteQuery);
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
  }, [equipoSeleccionado, inviteQuery]);

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Necesitamos saber qué equipo gestionar para mostrar sus jugadores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Gestión de jugadores</h1>
        <p className="text-sm text-slate-500">
          Aprueba solicitudes, envía invitaciones y actualiza contratos.
        </p>
      </header>

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

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando jugadores…</p>
      ) : (
        <JugadorList
          jugadores={jugadores}
          solicitudesPendientes={solicitudes}
          onAceptarSolicitud={handleAceptarSolicitud}
          onRechazarSolicitud={handleRechazarSolicitud}
          onEditarJugador={handleEditarJugador}
          onVerContratosNoActivos={handleVerContratosNoActivos}
        />
      )}

      {editingContratoId ? (
        <ModalBase isOpen onClose={handleCloseModal} title="Editar fechas del contrato" size="md">
          <p className="mt-1 text-sm text-slate-500">
            Ingresá las fechas y enviaremos una solicitud de edición para que sea aprobada.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleGuardarEdicion}>
            <Select
              id="rol"
              name="rol"
              label="Rol en el equipo"
              value={editForm.rol}
              onChange={handleEditFormChange as any}
              options={[
                { value: 'jugador', label: 'Jugador' },
                { value: 'entrenador', label: 'Entrenador' },
              ]}
            />

            <div>
              <label htmlFor="fechaInicio" className="block text-sm font-medium text-slate-700">
                Fecha de inicio
              </label>
              <input
                id="fechaInicio"
                name="fechaInicio"
                type="date"
                value={editForm.fechaInicio}
                onChange={handleEditFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label htmlFor="fechaFin" className="block text-sm font-medium text-slate-700">
                Fecha de finalización
              </label>
              <input
                id="fechaFin"
                name="fechaFin"
                type="date"
                value={editForm.fechaFin}
                onChange={handleEditFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {editError ? <p className="text-sm text-rose-600">{editError}</p> : null}
            {editSuccess ? <p className="text-sm text-emerald-600">{editSuccess}</p> : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
              >
                {editLoading ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </ModalBase>
      ) : null}

      {showContratosModal ? (
        <ModalBase isOpen onClose={handleCloseContratosModal} title="Contratos no activos" size="xl">
          <p className="mt-1 text-sm text-slate-500">
            Contratos marcados como baja, rechazados o pendientes para este equipo.
          </p>

          {contratosLoading ? (
            <p className="mt-4 text-sm text-slate-500">Cargando contratos…</p>
          ) : contratosError ? (
            <p className="mt-4 text-sm text-rose-600">{contratosError}</p>
          ) : contratosNoActivos.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No hay contratos no activos registrados.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Jugador</th>
                    <th className="px-4 py-2 text-left">Rol</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-left">Origen</th>
                    <th className="px-4 py-2 text-left">Inicio</th>
                    <th className="px-4 py-2 text-left">Fin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {contratosNoActivos.map((contrato) => (
                    <tr key={contrato.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{contrato.jugadorNombre}</td>
                      <td className="px-4 py-2">{contrato.rol ?? '—'}</td>
                      <td className="px-4 py-2 capitalize">{contrato.estado}</td>
                      <td className="px-4 py-2 capitalize">{contrato.origen ?? '—'}</td>
                      <td className="px-4 py-2">{contrato.fechaInicio ? contrato.fechaInicio.slice(0, 10) : '—'}</td>
                      <td className="px-4 py-2">{contrato.fechaFin ? contrato.fechaFin.slice(0, 10) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalBase>
      ) : null}
    </div>
  );
};

export default JugadoresPage;
