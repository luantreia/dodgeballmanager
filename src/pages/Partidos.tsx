import { useCallback, useEffect, useMemo, useState } from 'react';
import PartidoCard from '../components/PartidoCard';
import { useEquipo } from '../context/EquipoContext';
import {
  actualizarPartido,
  crearPartidoAmistoso,
  getAlineacion,
  getPartido,
  getPartidos,
  guardarAlineacion,
} from '../api/partido';
import { obtenerOpcionesEquipos, type EquipoOpcion } from '../api/equipo';
import type { JugadorPartido, Partido } from '../types';

const PartidosPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const [seleccionado, setSeleccionado] = useState<Partido | null>(null);
  const [proximos, setProximos] = useState<Partido[]>([]);
  const [recientes, setRecientes] = useState<Partido[]>([]);
  const [alineacion, setAlineacion] = useState<JugadorPartido[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [crearForm, setCrearForm] = useState({ rival: '', fecha: '', hora: '', escenario: '', rivalId: '' });
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);
  const [equiposOpciones, setEquiposOpciones] = useState<EquipoOpcion[]>([]);
  const [equiposLoading, setEquiposLoading] = useState(false);
  const [rivalSeleccionado, setRivalSeleccionado] = useState<EquipoOpcion | null>(null);

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
      setFeedback(null);
    } catch (error) {
      console.error(error);
      setFeedback('No pudimos cargar los partidos del equipo.');
    } finally {
      setLoading(false);
    }
  }, [equipoSeleccionado?.id]);

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setProximos([]);
      setRecientes([]);
      setSeleccionado(null);
      setFeedback(null);
      return;
    }

    void refreshPartidos();
  }, [equipoSeleccionado?.id, refreshPartidos]);

  const handleAbrirCrear = () => {
    setCrearForm({ rival: '', fecha: '', hora: '', escenario: '', rivalId: '' });
    setCrearError(null);
    setShowCrearModal(true);
    setRivalSeleccionado(null);
  };

  const handleCerrarCrear = () => {
    setShowCrearModal(false);
  };

  const handleCrearChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCrearForm((prev) => ({ ...prev, [name]: value, ...(name === 'rival' ? { rivalId: '' } : {}) }));
    if (name === 'rival') {
      setRivalSeleccionado(null);
    }
  };

  useEffect(() => {
    if (!showCrearModal) return;
    const controller = new AbortController();

    const buscar = async () => {
      try {
        setEquiposLoading(true);
        const termino = crearForm.rival?.trim?.() ?? '';
        const opciones = await obtenerOpcionesEquipos(termino, equipoSeleccionado?.id);
        if (!controller.signal.aborted) {
          setEquiposOpciones(opciones);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEquiposLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(buscar, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [crearForm.rival, showCrearModal, equipoSeleccionado?.id]);

  const handleSeleccionarRival = (equipo: EquipoOpcion) => {
    setCrearForm((prev) => ({ ...prev, rival: equipo.nombre, rivalId: equipo.id }));
    setRivalSeleccionado(equipo);
  };

  const handleCrearPartido = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!equipoSeleccionado) return;
    if (!crearForm.rivalId || !crearForm.fecha) {
      setCrearError('Seleccioná un equipo rival y la fecha del partido.');
      return;
    }

    try {
      setCrearLoading(true);
      setCrearError(null);
      await crearPartidoAmistoso({
        equipoId: equipoSeleccionado.id,
        rival: crearForm.rival.trim(),
        fecha: crearForm.fecha,
        hora: crearForm.hora || undefined,
        escenario: crearForm.escenario || undefined,
        rivalId: crearForm.rivalId,
      });

      await refreshPartidos();
      setShowCrearModal(false);
    } catch (error) {
      console.error(error);
      setCrearError('No pudimos crear el partido. Intenta nuevamente.');
    } finally {
      setCrearLoading(false);
    }
  };

  const handleSeleccionar = async (partidoId: string) => {
    try {
      setDetalleLoading(true);
      const [detalle, jugadores] = await Promise.all([
        getPartido(partidoId),
        getAlineacion(partidoId),
      ]);
      setSeleccionado(detalle);
      setAlineacion(jugadores);
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleActualizarEstado = async (estado: Partido['estado']) => {
    if (!seleccionado) return;
    await actualizarPartido(seleccionado.id, { estado });
    setSeleccionado({ ...seleccionado, estado });
  };

  const titulares = useMemo(
    () => alineacion.filter((item) => item.rol === 'titular'),
    [alineacion]
  );
  const suplentes = useMemo(
    () => alineacion.filter((item) => item.rol === 'suplente'),
    [alineacion]
  );

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

      {feedback ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{feedback}</div>
      ) : null}

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
                <button
                  key={partido.id}
                  type="button"
                  onClick={() => handleSeleccionar(partido.id)}
                  className="w-full text-left"
                >
                  <PartidoCard partido={partido} />
                </button>
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
                <PartidoCard key={partido.id} partido={partido} variante="resultado" />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No hay resultados registrados.
            </p>
          )}
        </div>
      </section>

      {seleccionado ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Detalle del partido</p>
              <h2 className="text-xl font-semibold text-slate-900">vs {seleccionado.rival}</h2>
              <p className="text-sm text-slate-500">Estado: {seleccionado.estado}</p>
            </div>
            <div className="flex gap-2">
              {(['confirmado', 'finalizado', 'cancelado'] as Partido['estado'][]).map((estado) => (
                <button
                  key={estado}
                  type="button"
                  onClick={() => handleActualizarEstado(estado)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Marcar {estado}
                </button>
              ))}
            </div>
          </header>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase text-slate-500">Titulares</h3>
              {detalleLoading ? (
                <p className="mt-2 text-xs text-slate-500">Cargando alineación…</p>
              ) : titulares.length ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {titulares.map((item) => (
                    <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      {item.jugador.nombre}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Aún no asignaste titulares.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase text-slate-500">Suplentes</h3>
              {detalleLoading ? (
                <p className="mt-2 text-xs text-slate-500">Cargando alineación…</p>
              ) : suplentes.length ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {suplentes.map((item) => (
                    <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      {item.jugador.nombre}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Aún no asignaste suplentes.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {showCrearModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <header className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Nuevo partido amistoso</h2>
                <p className="text-sm text-slate-500">Completá los datos básicos para agendarlo.</p>
              </div>
              <button
                type="button"
                onClick={handleCerrarCrear}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cerrar
              </button>
            </header>

            <form className="space-y-4" onSubmit={handleCrearPartido}>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="crear-rival">
                  Rival
                </label>
                <input
                  id="crear-rival"
                  name="rival"
                  type="text"
                  value={crearForm.rival}
                  onChange={handleCrearChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Buscar equipo por nombre"
                  required
                />
                {equiposLoading ? (
                  <p className="mt-2 text-xs text-slate-400">Buscando equipos…</p>
                ) : null}
                {!equiposLoading && equiposOpciones.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No encontramos equipos. Probá con otro nombre.</p>
                ) : null}
                {equiposOpciones.length ? (
                  <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {equiposOpciones.map((equipo) => {
                      const seleccionado = rivalSeleccionado?.id === equipo.id;
                      return (
                        <li
                          key={equipo.id}
                          className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${seleccionado ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}
                          onClick={() => handleSeleccionarRival(equipo)}
                          role="button"
                        >
                          <p className="font-medium text-slate-900">{equipo.nombre}</p>
                          {equipo.pais ? (
                            <p className="text-xs text-slate-500">{equipo.pais}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              {rivalSeleccionado ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">Rival seleccionado:</p>
                  <p>{rivalSeleccionado.nombre}</p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="crear-fecha">
                    Fecha
                  </label>
                  <input
                    id="crear-fecha"
                    name="fecha"
                    type="date"
                    value={crearForm.fecha}
                    onChange={handleCrearChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="crear-hora">
                    Hora
                  </label>
                  <input
                    id="crear-hora"
                    name="hora"
                    type="time"
                    value={crearForm.hora}
                    onChange={handleCrearChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="crear-escenario">
                  Escenario
                </label>
                <input
                  id="crear-escenario"
                  name="escenario"
                  type="text"
                  value={crearForm.escenario}
                  onChange={handleCrearChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Cancha o lugar (opcional)"
                />
              </div>

              {crearError ? <p className="text-sm text-rose-600">{crearError}</p> : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCerrarCrear}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearLoading}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
                >
                  {crearLoading ? 'Creando…' : 'Crear partido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PartidosPage;
