import { useCallback, useEffect, useState } from 'react';
import PartidoCard from '../../../shared/components/PartidoCard/PartidoCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getPartido, getPartidos } from '../services/partidoService';
import type { Partido } from '../../../types';
import { ModalPartidoAdmin } from '../components';
import { useToken } from '../../../app/providers/AuthContext';
import { ModalCrearPartido } from '../components/modals/ModalCrearPartidoAmistoso';
import ModalAlineacionPartido from '../components/modals/ModalAlineacionPartido';
import ModalInformacionPartido from '../components/modals/ModalInformacionPartido';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

const PartidosPage = () => {
  const token = useToken();
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();
  const [proximos, setProximos] = useState<Partido[]>([]);
  const [recientes, setRecientes] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false);
  const [partidoAdminId, setPartidoAdminId] = useState<string | null>(null);
  const [alineacionModalAbierto, setAlineacionModalAbierto] = useState(false);
  const [partidoAlineacionId, setPartidoAlineacionId] = useState<string | null>(null);
  const [infoModalAbierto, setInfoModalAbierto] = useState(false);
  const [partidoInfoId, setPartidoInfoId] = useState<string | null>(null);

  const refreshPartidos = useCallback(async () => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) return;
    try {
      setLoading(true);
      const partidos = await getPartidos({ equipoId });
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const futuros: Partido[] = [];
      const pasados: Partido[] = [];

      partidos.forEach((partido) => {
        const fechaPartido = partido.fecha ? new Date(partido.fecha) : null;

        if (!fechaPartido || Number.isNaN(fechaPartido.getTime())) {
          futuros.push(partido);
          return;
        }

        const fechaComparacion = new Date(fechaPartido);
        fechaComparacion.setHours(0, 0, 0, 0);

        if (fechaComparacion.getTime() >= hoy.getTime()) {
          futuros.push(partido);
        } else {
          pasados.push(partido);
        }
      });

      futuros.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      pasados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setProximos(futuros);
      setRecientes(pasados);
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar los partidos del equipo.' });
    } finally {
      setLoading(false);
    }
  }, [equipoSeleccionado?.id, addToast]);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setProximos([]);
      setRecientes([]);
      return;
    }

    void refreshPartidos();
  }, [equipoSeleccionado?.id, refreshPartidos]);

  const handleAbrirCrear = () => {
    setShowCrearModal(true);
  };

  const handleCerrarCrear = () => {
    setShowCrearModal(false);
  };

  const handleSeleccionar = async (partidoId: string) => {
    try {
      await getPartido(partidoId);
      setPartidoAdminId(partidoId);
      setModalAdminAbierto(true);
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar el detalle del partido' });
    }
  };

  const handleAbrirAlineacion = (partidoId: string) => {
    setPartidoAlineacionId(partidoId);
    setAlineacionModalAbierto(true);
  };

  const handleCerrarAlineacion = () => {
    setAlineacionModalAbierto(false);
    setPartidoAlineacionId(null);
  };

  const handleAbrirInformacion = (partidoId: string) => {
    setPartidoInfoId(partidoId);
    setInfoModalAbierto(true);
  };

  const handleCerrarInformacion = () => {
    setInfoModalAbierto(false);
    setPartidoInfoId(null);
  };

  // onSaved no-op: actualizará vista dentro del modal

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Elegí un equipo para revisar sus partidos programados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Partidos</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Programación y resultados del equipo.</p>
          <button
            type="button"
            onClick={handleAbrirCrear}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Agregar amistoso
          </button>
        </div>
      </header>

      {modalAdminAbierto && partidoAdminId ? (
        <ModalPartidoAdmin
          partidoId={partidoAdminId}
          token={token ?? ''}
          onClose={() => {
            setModalAdminAbierto(false);
            setPartidoAdminId(null);
          }}
          onPartidoEliminado={() => {
            setModalAdminAbierto(false);
            setPartidoAdminId(null);
            void refreshPartidos();
          }}
          equipoId={equipoSeleccionado?.id}
        />
      ) : null}

      <ModalAlineacionPartido
        partidoId={partidoAlineacionId ?? ''}
        equipoId={equipoSeleccionado?.id}
        isOpen={alineacionModalAbierto && Boolean(partidoAlineacionId)}
        onClose={handleCerrarAlineacion}
        onSaved={() => {
          handleCerrarAlineacion();
        }}
      />

      <ModalInformacionPartido
        partidoId={partidoInfoId}
        isOpen={infoModalAbierto && Boolean(partidoInfoId)}
        onClose={handleCerrarInformacion}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Próximos partidos</h2>
            <span className="text-xs uppercase tracking-wide text-slate-400">En agenda</span>
          </header>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : proximos.length ? (
            <div className="space-y-4">
              {proximos.map((partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={partido}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => handleAbrirAlineacion(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        🏐 Alineación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbrirInformacion(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        🖊️ Datos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionar(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                      >
                        📊 Estadísticas
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No hay partidos pendientes.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Resultados recientes</h2>
            <span className="text-xs uppercase tracking-wide text-slate-400">Hasta 10 más recientes</span>
          </header>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : recientes.length ? (
            <div className="space-y-4">
              {recientes.slice(0, 10).map((partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={partido}
                  variante="resultado"
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => handleAbrirAlineacion(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        🏐 Alineación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbrirInformacion(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        🖊️ Datos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionar(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                      >
                        📊 Estadísticas
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No hay resultados registrados.
            </p>
          )}
        </div>
      </section>
      
      <ModalCrearPartido
        isOpen={showCrearModal}
        equipoId={equipoSeleccionado?.id}
        onClose={handleCerrarCrear}
        onSuccess={refreshPartidos}
      />
    </div>
  );
};

export default PartidosPage;
