import { useEffect, useMemo, useState } from 'react';
import JugadorList from '../components/JugadorList';
import { useEquipo } from '../../../app/providers/EquipoContext';
import {
  getContratosNoActivos,
  getJugadoresEquipo,
} from '../services/jugadorEquipoService';
import type { Jugador, ContratoJugadorResumen } from '../../../types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import InvitarJugadorSection from '../components/InvitarJugadorSection';
import ModalEditarContratoJugador from '../components/ModalEditarContratoJugador';
import EquipoSolicitudesEdicion from '../components/EquipoSolicitudesEdicion';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';

const JugadoresPage = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado } = useEquipo();
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  // solicitudes pendientes ahora se gestionan en EquipoSolicitudesEdicion
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingContratoId, setEditingContratoId] = useState<string | null>(null);
  const [showContratosModal, setShowContratosModal] = useState(false);
  const [contratosNoActivos, setContratosNoActivos] = useState<ContratoJugadorResumen[]>([]);
  const [contratosLoading, setContratosLoading] = useState(false);
  const [contratosError, setContratosError] = useState<string | null>(null);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setJugadores([]);
      return;
    }

    let isCancelled = false;

    const fetchJugadores = async () => {
      try {
        setLoading(true);
        const activos = await getJugadoresEquipo({ equipoId });

        if (isCancelled) return;

        setJugadores(activos);
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
    const activos = await getJugadoresEquipo({ equipoId: equipoSeleccionado.id });
    setJugadores(activos);
  };

  // Aceptar/Rechazar solicitudes ahora se hace en EquipoSolicitudesEdicion

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

  // Sección de invitación movida a componente (InvitarJugadorSection)

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

      {/* Solicitudes del equipo gestionadas desde la sección de jugadores */}
      {equipoSeleccionado ? (
        <EquipoSolicitudesEdicion equipoId={equipoSeleccionado.id} />
      ) : null}

      <InvitarJugadorSection equipoId={equipoSeleccionado.id} onSuccess={refreshData} />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando jugadores…</p>
      ) : (
        <JugadorList
          jugadores={jugadores}
          onEditarJugador={handleEditarJugador}
          onVerContratosNoActivos={handleVerContratosNoActivos}
        />
      )}

      {editingContratoId ? (() => {
        const contrato = jugadoresPorContrato.get(editingContratoId);
        if (!contrato) return null;
        const estadoB: 'baja' | 'aceptado' = contrato.estado === 'baja' ? 'baja' : 'aceptado';
        const initial = {
          fechaInicio: contrato.fechaInicio ? contrato.fechaInicio.slice(0, 10) : undefined,
          fechaFin: contrato.fechaFin ? contrato.fechaFin.slice(0, 10) : undefined,
          rol: contrato.rol ?? contrato.rolEnEquipo ?? 'jugador',
          estadoBackend: estadoB,
        };
        return (
          <ModalEditarContratoJugador
            isOpen
            onClose={handleCloseModal}
            contratoId={editingContratoId}
            initial={initial}
            onSaved={refreshData}
          />
        );
      })() : null}

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
