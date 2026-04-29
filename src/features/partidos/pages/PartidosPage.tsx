import { useCallback, useEffect, useState } from 'react';
import PartidoCard from '../../../shared/components/PartidoCard/PartidoCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { getPartido, getPartidos, getTemporadasByCompetencia, getFasesByTemporada } from '../services/partidoService';
import type { Partido } from '../../../shared/utils/types/types';
import { ModalPartidoAdmin, ModalSolicitudEditarPartido } from '../components';
import { useToken } from '../../../app/providers/AuthContext';
import { ModalCrearPartido } from '../components/modals/ModalCrearPartidoAmistoso';
import ModalAlineacionPartido from '../components/modals/ModalAlineacionPartido';
import ModalInformacionPartido from '../components/modals/ModalInformacionPartido';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { AdjustmentsHorizontalIcon, PencilSquareIcon, EnvelopeIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { getParticipaciones } from '../../competencias/services/equipoCompetenciaService';

type FiltroTipoPartido = 'todos' | 'liga' | 'amistoso';

const PartidosPage = () => {
  const token = useToken();
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();
  const [proximos, setProximos] = useState<Partido[]>([]);
  const [recientes, setRecientes] = useState<Partido[]>([]);
  const [pasadosSinCerrar, setPasadosSinCerrar] = useState<Partido[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipoPartido>('todos');
  const [filtroCompetencia, setFiltroCompetencia] = useState('');
  const [filtroTemporada, setFiltroTemporada] = useState('');
  const [filtroFase, setFiltroFase] = useState('');
  const [competencias, setCompetencias] = useState<Array<{ id: string; nombre: string }>>([]);
  const [temporadas, setTemporadas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [fases, setFases] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false);
  const [partidoAdminId, setPartidoAdminId] = useState<string | null>(null);
  const [alineacionModalAbierto, setAlineacionModalAbierto] = useState(false);
  const [partidoAlineacionId, setPartidoAlineacionId] = useState<string | null>(null);
  const [infoModalAbierto, setInfoModalAbierto] = useState(false);
  const [partidoInfoId, setPartidoInfoId] = useState<string | null>(null);
  const [solicitudModalAbierto, setSolicitudModalAbierto] = useState(false);
  const [partidoSolicitudId, setPartidoSolicitudId] = useState<string | null>(null);

  const refreshPartidos = useCallback(async () => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) return;
    try {
      setLoading(true);
      const partidos = await getPartidos({
        equipoId,
        tipo: filtroTipo,
        competenciaId: filtroCompetencia || undefined,
        temporadaId: filtroTemporada || undefined,
        faseId: filtroFase || undefined,
      });
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const futuros: Partido[] = [];
      const pasados: Partido[] = [];
      const pasadosNoFinalizados: Partido[] = [];

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
          if (partido.estado === 'finalizado') {
            pasados.push(partido);
          } else {
            pasadosNoFinalizados.push(partido);
          }
        }
      });

      futuros.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      pasados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      pasadosNoFinalizados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setProximos(futuros);
      setRecientes(pasados);
      setPasadosSinCerrar(pasadosNoFinalizados);
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar los partidos del equipo.' });
    } finally {
      setLoading(false);
    }
  }, [equipoSeleccionado?.id, addToast, filtroTipo, filtroCompetencia, filtroTemporada, filtroFase]);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setProximos([]);
      setRecientes([]);
      setPasadosSinCerrar([]);
      return;
    }

    void refreshPartidos();
  }, [equipoSeleccionado?.id, refreshPartidos]);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setCompetencias([]);
      return;
    }

    const cargar = async () => {
      try {
        const participaciones = await getParticipaciones({ equipoId });
        const mapa = new Map<string, { id: string; nombre: string }>();
        participaciones.forEach((item) => {
          if (item.competencia?.id) {
            mapa.set(item.competencia.id, { id: item.competencia.id, nombre: item.competencia.nombre });
          }
        });
        setCompetencias(Array.from(mapa.values()));
      } catch {
        setCompetencias([]);
      }
    };

    void cargar();
  }, [equipoSeleccionado?.id]);

  useEffect(() => {
    if (!filtroCompetencia) {
      setTemporadas([]);
      setFiltroTemporada('');
      return;
    }

    const cargar = async () => {
      try {
        const data = await getTemporadasByCompetencia(filtroCompetencia);
        setTemporadas(data.map((temp) => ({ id: temp._id, nombre: temp.nombre ?? 'Temporada' })));
      } catch {
        setTemporadas([]);
      }
    };

    setFiltroTemporada('');
    setFiltroFase('');
    void cargar();
  }, [filtroCompetencia]);

  useEffect(() => {
    if (!filtroTemporada) {
      setFases([]);
      setFiltroFase('');
      return;
    }

    const cargar = async () => {
      try {
        const data = await getFasesByTemporada(filtroTemporada);
        setFases(data.map((fase) => ({ id: fase._id, nombre: fase.nombre ?? 'Fase' })));
      } catch {
        setFases([]);
      }
    };

    setFiltroFase('');
    void cargar();
  }, [filtroTemporada]);

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

  const handleAbrirSolicitud = (partidoId: string) => {
    setPartidoSolicitudId(partidoId);
    setSolicitudModalAbierto(true);
  };

  const handleCerrarSolicitud = () => {
    setSolicitudModalAbierto(false);
    setPartidoSolicitudId(null);
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
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Tipo
            <select
              value={filtroTipo}
              onChange={(event) => {
                const next = event.target.value as FiltroTipoPartido;
                setFiltroTipo(next);
                if (next !== 'liga') {
                  setFiltroCompetencia('');
                  setFiltroTemporada('');
                  setFiltroFase('');
                }
              }}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
            >
              <option value="todos">Todos</option>
              <option value="liga">Liga</option>
              <option value="amistoso">Amistosos</option>
            </select>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Competencia
            <select
              value={filtroCompetencia}
              onChange={(event) => setFiltroCompetencia(event.target.value)}
              disabled={filtroTipo !== 'liga'}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Todas</option>
              {competencias.map((competencia) => (
                <option key={competencia.id} value={competencia.id}>
                  {competencia.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Temporada
            <select
              value={filtroTemporada}
              onChange={(event) => setFiltroTemporada(event.target.value)}
              disabled={filtroTipo !== 'liga' || !filtroCompetencia}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Todas</option>
              {temporadas.map((temporada) => (
                <option key={temporada.id} value={temporada.id}>
                  {temporada.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Fase
            <select
              value={filtroFase}
              onChange={(event) => setFiltroFase(event.target.value)}
              disabled={filtroTipo !== 'liga' || !filtroTemporada}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Todas</option>
              {fases.map((fase) => (
                <option key={fase.id} value={fase.id}>
                  {fase.nombre}
                </option>
              ))}
            </select>
          </label>
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

      <ModalSolicitudEditarPartido
        isOpen={solicitudModalAbierto && Boolean(partidoSolicitudId)}
        partidoId={partidoSolicitudId ?? ''}
        onClose={handleCerrarSolicitud}
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
                        <AdjustmentsHorizontalIcon className="h-4 w-4" />
                        Alineación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbrirInformacion(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        Datos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbrirSolicitud(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                      >
                        <EnvelopeIcon className="h-4 w-4" />
                        Solicitar edición
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionar(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                      >
                        <Cog6ToothIcon className="h-4 w-4" />
                        Gestionar
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
                        <AdjustmentsHorizontalIcon className="h-4 w-4" />
                        Alineación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbrirInformacion(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        Datos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbrirSolicitud(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                      >
                        <EnvelopeIcon className="h-4 w-4" />
                        Solicitar edición
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionar(partido.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                      >
                        <Cog6ToothIcon className="h-4 w-4" />
                        Gestionar
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

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Partidos pasados sin cierre</h2>
          <span className="text-xs uppercase tracking-wide text-slate-400">Revisión pendiente</span>
        </header>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 1 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : pasadosSinCerrar.length ? (
          <div className="space-y-4">
            {pasadosSinCerrar.slice(0, 10).map((partido) => (
              <PartidoCard
                key={partido.id}
                partido={partido}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => handleAbrirInformacion(partido.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      Datos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbrirSolicitud(partido.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      Solicitar edición
                    </button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            No hay partidos anteriores pendientes de cierre.
          </p>
        )}
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
