import { useEffect, useState } from 'react';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getContratosNoActivos, getJugadoresEquipo } from '../services/jugadorEquipoService';
import type { Jugador, ContratoJugadorResumen } from '../../../shared/utils/types/types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import InvitarJugadorSection from '../components/InvitarJugadorSection';
import CrearJugadorSection from '../components/CrearJugadorSection';
import SolicitudesPendientesSection from '../components/SolicitudesPendientesSection';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import JugadoresListSection from './JugadoresListSection';
import SeccionRatings from './SeccionRatings';

/**
 * El plantel del equipo: solicitudes pendientes, contratos vigentes y ratings.
 *
 * Era la página `/jugadores`, con su propio título «Gestión de jugadores». Se fusionó como
 * pestaña dentro de Equipo: ningún DT distingue «gestión del equipo» de «gestión de jugadores»,
 * es todo su gente, y dos destinos de navegación para lo mismo obligaban a recordar en cuál
 * estaba cada cosa.
 *
 * Invitar y crear jugador salieron del cuerpo de la página a un modal. Eran dos formularios
 * completos ARRIBA del plantel: lo que hacés cada tanto tapando lo que mirás siempre.
 */
const SeccionPlantel = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado } = useEquipo();
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContratosModal, setShowContratosModal] = useState(false);
  const [contratosNoActivos, setContratosNoActivos] = useState<ContratoJugadorResumen[]>([]);
  const [contratosLoading, setContratosLoading] = useState(false);
  const [contratosError, setContratosError] = useState<string | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);

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
  }, [equipoSeleccionado?.id, addToast]);

  const refreshData = async () => {
    if (!equipoSeleccionado) return;
    const activos = await getJugadoresEquipo({ equipoId: equipoSeleccionado.id });
    setJugadores(activos);
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
      setContratosError('No pudimos cargar los contratos inactivos. Intentá de nuevo.');
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

  if (!equipoSeleccionado) return null;

  return (
    <div className="space-y-6">
      {/* Las solicitudes van primero: son lo único de esta pantalla que espera una decisión. */}
      <SolicitudesPendientesSection equipoId={equipoSeleccionado.id} onRefresh={refreshData} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {jugadores.length} {jugadores.length === 1 ? 'jugador con contrato vigente' : 'jugadores con contrato vigente'}
        </p>
        <button
          type="button"
          onClick={() => setAgregarAbierto(true)}
          className="min-h-[2.75rem] rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition [touch-action:manipulation] hover:bg-brand-700"
        >
          + Agregar jugador
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando jugadores…</p>
      ) : (
        <JugadoresListSection
          jugadores={jugadores}
          equipoId={equipoSeleccionado.id}
          onVerContratosNoActivos={handleVerContratosNoActivos}
          onSolicitudSuccess={refreshData}
        />
      )}

      {/* Debajo del plantel y no arriba: el rating es contexto sobre los jugadores que ya
          conocés, no la razon por la que entras a esta pantalla. */}
      <SeccionRatings equipoId={equipoSeleccionado.id} />

      {agregarAbierto ? (
        <ModalBase
          isOpen
          onClose={() => setAgregarAbierto(false)}
          title="Agregar jugador"
          subtitle="Invitá a alguien que ya tiene cuenta, o creá la ficha de un jugador que todavía no la tiene."
          size="lg"
        >
          <div className="space-y-6 py-2">
            <InvitarJugadorSection
              equipoId={equipoSeleccionado.id}
              onSuccess={() => {
                void refreshData();
                setAgregarAbierto(false);
              }}
            />
            <CrearJugadorSection
              equipoId={equipoSeleccionado.id}
              onSuccess={() => {
                void refreshData();
                setAgregarAbierto(false);
              }}
            />
          </div>
        </ModalBase>
      ) : null}

      {showContratosModal ? (
        <ModalBase isOpen onClose={handleCloseContratosModal} title="Contratos vencidos y bajas" size="xl">
          <p className="mt-1 text-sm text-slate-500">
            Contratos marcados como baja, rechazados o pendientes para este equipo.
          </p>

          {contratosLoading ? (
            <p className="mt-4 text-sm text-slate-500">Cargando contratos…</p>
          ) : contratosError ? (
            <p className="mt-4 text-sm text-rose-600">{contratosError}</p>
          ) : contratosNoActivos.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Todos los contratos del equipo están vigentes.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
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
            </div>
          )}
        </ModalBase>
      ) : null}
    </div>
  );
};

export default SeccionPlantel;
