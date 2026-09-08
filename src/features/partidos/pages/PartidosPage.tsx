import { useCallback, useEffect, useMemo, useState } from 'react';
import PartidoCard from '../../../shared/components/PartidoCard/PartidoCard';
import BarraFiltros from '../../../shared/components/BarraFiltros/BarraFiltros';
import MenuAcciones from '../../../shared/components/MenuAcciones/MenuAcciones';
import EstadoVacio from '../../../shared/components/EstadoVacio/EstadoVacio';
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

type FiltroTipoPartido = 'todos' | 'competencia' | 'amistoso';

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

  const hayFiltros =
    filtroTipo !== 'todos' || Boolean(filtroCompetencia || filtroTemporada || filtroFase);

  const limpiarFiltros = useCallback(() => {
    setFiltroTipo('todos');
    setFiltroCompetencia('');
    setFiltroTemporada('');
    setFiltroFase('');
  }, []);

  /**
   * Lo que dice el chip cuando está cerrado. Sin esto, alguien deja un filtro puesto, lo olvida,
   * ve tres partidos y cree que se perdieron los demás.
   */
  const resumenFiltros = useMemo(() => {
    if (!hayFiltros) return 'Todos los partidos';
    if (filtroTipo === 'amistoso') return 'Sólo amistosos';

    const partes = [
      competencias.find((c) => c.id === filtroCompetencia)?.nombre,
      temporadas.find((t) => t.id === filtroTemporada)?.nombre,
      fases.find((f) => f.id === filtroFase)?.nombre,
    ].filter(Boolean);

    return partes.length > 0 ? partes.join(' · ') : 'Sólo competencia';
  }, [hayFiltros, filtroTipo, filtroCompetencia, filtroTemporada, filtroFase, competencias, temporadas, fases]);

  /**
   * Las acciones de una tarjeta: una primaria visible y el resto en «⋯».
   *
   * Antes cada tarjeta mostraba los cuatro botones —Datos, Solicitar edición, Alineación,
   * Gestionar— y con cinco partidos en pantalla eran veinte botones compitiendo entre sí. El
   * problema no era sólo el ruido: ninguno decía qué corresponde hacer ahora.
   *
   * Cuál es la primaria depende del estado del partido, así que la tarjeta pasa de listar lo
   * posible a sugerir lo que sigue. Antes de jugar un amistoso, la alineación; con el partido en
   * curso o terminado, la carga de estadísticas.
   */

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

      // `fechaISO` es el instante real; `fecha` es sólo el día local y `new Date('2026-09-05')`
      // se parsea como medianoche UTC, que en Argentina cae el día anterior a las 21:00. Sin
      // esto, los partidos nocturnos se clasificaban un día corrido.
      const instante = (partido: Partido) => {
        const valor = partido.fechaISO ?? (partido.fecha ? `${partido.fecha}T${partido.hora ?? '00:00'}` : null);
        if (!valor) return NaN;
        return new Date(valor).getTime();
      };

      partidos.forEach((partido) => {
        const t = instante(partido);

        if (Number.isNaN(t)) {
          futuros.push(partido);
          return;
        }

        const fechaComparacion = new Date(t);
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

      futuros.sort((a, b) => instante(a) - instante(b));
      pasados.sort((a, b) => instante(b) - instante(a));
      pasadosNoFinalizados.sort((a, b) => instante(b) - instante(a));

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

  const esPartidoCompetencia = (partido: Partido) => Boolean(partido.competencia?.id);

  const accionesDe = useCallback(
    (partido: Partido) => {
      const esCompetencia = esPartidoCompetencia(partido);
      const estado = partido.estado ?? 'programado';
      const rival = partido.equipoVisitante?.nombre ?? partido.rival ?? 'el rival';

      const alineacionDisponible = !esCompetencia;
      const primariaEsAlineacion = estado === 'programado' && alineacionDisponible;

      const etiquetaGestionar =
        estado === 'en_juego'
          ? 'Cargar estadísticas'
          : estado === 'finalizado'
          ? 'Estadísticas'
          : 'Gestionar';

      const secundarias = [
        { label: 'Datos del partido', onSelect: () => handleAbrirInformacion(partido.id) },
        {
          label: 'Solicitar edición',
          onSelect: () => handleAbrirSolicitud(partido.id),
          tono: 'cuidado' as const,
        },
      ];

      // La alineación es de la capa partido: en competencia la carga el organizador, así que el
      // acceso vive dentro del modal y depende de los permisos reales sobre ese partido.
      if (alineacionDisponible) {
        secundarias.unshift(
          primariaEsAlineacion
            ? { label: etiquetaGestionar, onSelect: () => handleSeleccionar(partido.id) }
            : { label: 'Alineación', onSelect: () => handleAbrirAlineacion(partido.id) },
        );
      }

      return (
        <>
          <button
            type="button"
            onClick={() =>
              primariaEsAlineacion
                ? handleAbrirAlineacion(partido.id)
                : handleSeleccionar(partido.id)
            }
            className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition [touch-action:manipulation] hover:bg-brand-700 sm:flex-none"
          >
            {primariaEsAlineacion ? (
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
            ) : (
              <Cog6ToothIcon className="h-4 w-4" />
            )}
            {primariaEsAlineacion ? 'Alineación' : etiquetaGestionar}
          </button>

          <MenuAcciones acciones={secundarias} etiqueta={`Más acciones del partido contra ${rival}`} />
        </>
      );
    },
    [handleAbrirInformacion, handleAbrirSolicitud, handleAbrirAlineacion, handleSeleccionar],
  );

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
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Partidos</h1>

        {/*
          Los filtros van plegados detrás del chip. Antes eran cuatro `select` que en un teléfono
          se apilaban en ~280px antes del primer partido, y tres de los cuatro estaban
          deshabilitados salvo que el tipo fuera «competencia»: media pantalla de controles que en
          el caso más común no hacían nada.

          Los encadenados ya no se muestran deshabilitados, aparecen cuando corresponde. Un
          control deshabilitado obliga a descubrir por qué lo está; uno ausente no genera la
          pregunta.
        */}
        <BarraFiltros
          resumen={resumenFiltros}
          activo={hayFiltros}
          acciones={
            <>
              {hayFiltros && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="min-h-[2.75rem] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition [touch-action:manipulation] hover:border-slate-300 hover:text-slate-900"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={handleAbrirCrear}
                className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition [touch-action:manipulation] hover:bg-brand-700"
              >
                + Amistoso
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Tipo
              <select
                value={filtroTipo}
                onChange={(event) => {
                  const next = event.target.value as FiltroTipoPartido;
                  setFiltroTipo(next);
                  if (next !== 'competencia') {
                    setFiltroCompetencia('');
                    setFiltroTemporada('');
                    setFiltroFase('');
                  }
                }}
                className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
              >
                <option value="todos">Todos</option>
                <option value="competencia">Competencia</option>
                <option value="amistoso">Amistosos</option>
              </select>
            </label>

            {filtroTipo === 'competencia' && (
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Competencia
                <select
                  value={filtroCompetencia}
                  onChange={(event) => setFiltroCompetencia(event.target.value)}
                  className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">Todas</option>
                  {competencias.map((competencia) => (
                    <option key={competencia.id} value={competencia.id}>
                      {competencia.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {filtroTipo === 'competencia' && filtroCompetencia && (
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Temporada
                <select
                  value={filtroTemporada}
                  onChange={(event) => setFiltroTemporada(event.target.value)}
                  className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">Todas</option>
                  {temporadas.map((temporada) => (
                    <option key={temporada.id} value={temporada.id}>
                      {temporada.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {filtroTipo === 'competencia' && filtroTemporada && (
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Fase
                <select
                  value={filtroFase}
                  onChange={(event) => setFiltroFase(event.target.value)}
                  className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">Todas</option>
                  {fases.map((fase) => (
                    <option key={fase.id} value={fase.id}>
                      {fase.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </BarraFiltros>
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
        modoSoloLectura={
          partidoInfoId
            ? [...proximos, ...recientes, ...pasadosSinCerrar].some(
                (partido) => partido.id === partidoInfoId && esPartidoCompetencia(partido),
              )
            : false
        }
      />

      <ModalSolicitudEditarPartido
        isOpen={solicitudModalAbierto && Boolean(partidoSolicitudId)}
        partidoId={partidoSolicitudId ?? ''}
        esCompetencia={
          partidoSolicitudId
            ? [...proximos, ...recientes, ...pasadosSinCerrar].some(
                (partido) => partido.id === partidoSolicitudId && esPartidoCompetencia(partido),
              )
            : false
        }
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
                  actions={accionesDe(partido)}
                />
              ))}
            </div>
          ) : (
            <EstadoVacio
              titulo={hayFiltros ? 'Ningún partido pendiente con estos filtros' : 'No tenés partidos en agenda'}
              descripcion={
                hayFiltros
                  ? 'Probá ampliar el filtro para ver el resto de la agenda.'
                  : 'Los partidos de competencia los carga la organización. Un amistoso lo agregás vos.'
              }
              accion={
                hayFiltros ? (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="min-h-[2.75rem] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition [touch-action:manipulation] hover:bg-slate-50"
                  >
                    Limpiar filtros
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAbrirCrear}
                    className="min-h-[2.75rem] rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition [touch-action:manipulation] hover:bg-brand-700"
                  >
                    Agregar un amistoso
                  </button>
                )
              }
            />
          )}
        </div>

        <div className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Resultados recientes</h2>
            <span className="text-xs uppercase tracking-wide text-slate-400">Todos los finalizados</span>
          </header>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : recientes.length ? (
            <div className="space-y-4">
              {recientes.map((partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={partido}
                  variante="resultado"
                  actions={accionesDe(partido)}
                />
              ))}
            </div>
          ) : (
            <EstadoVacio
              titulo="Todavía no hay partidos jugados"
              descripcion="Cuando se cierre el primero vas a poder cargar sus estadísticas y empezar a analizar."
            />
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
            {pasadosSinCerrar.map((partido) => (
              <PartidoCard
                key={partido.id}
                partido={partido}
                actions={accionesDe(partido)}
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
