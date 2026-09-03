import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import ConfirmModal from '../../../shared/components/ConfirmModal/ConfirmModal';
import {
  crearTipoTest,
  eliminarTipoTest,
  getEvolucion,
  guardarResultados,
  listarResultados,
  listarTiposTest,
  TESTS_SUGERIDOS,
  type EvolucionJugador,
  type TipoTest,
  type TipoTestMejorEs,
} from '../services/testService';
import { getResumenAsistencia, type ResumenJugador } from '../services/entrenamientoService';

type Props = { equipoId: string };

const hoyISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatear = (valor: number, decimales: number) => valor.toFixed(decimales);

const ETIQUETA_DIRECCION: Record<TipoTestMejorEs, string> = {
  mayor: 'Más alto es mejor',
  menor: 'Más bajo es mejor',
  neutro: 'Sin juicio de valor',
};

/**
 * Tests de evaluación: catálogo, carga de una jornada y evolución.
 *
 * Los tests son una entidad aparte de los entrenamientos y no un campo suyo, porque lo valioso
 * no es el día en que se midió sino la serie: "pasó de 38 a 44 cm en tres meses". Se toman cada
 * tanto y no siempre a todo el plantel, así que colgarlos de la sesión partiría esa serie.
 */
const SeccionTests = ({ equipoId }: Props) => {
  const { addToast } = useToast();

  const [tipos, setTipos] = useState<TipoTest[]>([]);
  const [evolucion, setEvolucion] = useState<EvolucionJugador[]>([]);
  const [plantel, setPlantel] = useState<ResumenJugador[]>([]);
  const [cargando, setCargando] = useState(true);

  const [tipoElegido, setTipoElegido] = useState('');
  const [fecha, setFecha] = useState(hoyISO);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaUnidad, setNuevaUnidad] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState<TipoTestMejorEs>('mayor');
  const [aArchivar, setAArchivar] = useState<TipoTest | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // El plantel sale del resumen de asistencia, que ya devuelve los jugadores con contrato
      // vigente: una fuente sola para "quiénes son mi equipo hoy".
      const [t, e, resumen] = await Promise.all([
        listarTiposTest(equipoId),
        getEvolucion(equipoId).catch(() => []),
        getResumenAsistencia(equipoId).catch(() => ({ totalEntrenamientos: 0, jugadores: [] })),
      ]);
      setTipos(t);
      setEvolucion(e);
      setPlantel(resumen.jugadores);
      setTipoElegido((prev) => prev || t[0]?._id || '');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos cargar los tests',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setCargando(false);
    }
  }, [equipoId, addToast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Al cambiar de test o de fecha se precargan los valores ya medidos ese día: la pantalla
  // sirve para cargar y para corregir, y sin esto corregir sería volver a tipear todo.
  useEffect(() => {
    if (!tipoElegido || !fecha) {
      setValores({});
      return;
    }
    let cancelado = false;
    listarResultados(equipoId, { tipoTest: tipoElegido })
      .then((resultados) => {
        if (cancelado) return;
        const delDia: Record<string, string> = {};
        for (const r of resultados) {
          if (r.fecha === fecha) delDia[r.jugadorId] = String(r.valor);
        }
        setValores(delDia);
      })
      .catch(() => !cancelado && setValores({}));
    return () => {
      cancelado = true;
    };
  }, [equipoId, tipoElegido, fecha]);

  const tipoActual = useMemo(() => tipos.find((t) => t._id === tipoElegido) ?? null, [tipos, tipoElegido]);

  const agregarTipo = async (datos: {
    nombre: string;
    unidad?: string;
    mejorEs?: TipoTestMejorEs;
    decimales?: number;
    descripcion?: string;
  }) => {
    try {
      const creado = await crearTipoTest({ equipo: equipoId, ...datos });
      setNuevoNombre('');
      setNuevaUnidad('');
      await cargar();
      setTipoElegido(creado._id);
      addToast({ type: 'success', title: 'Test agregado', message: `Ya podés cargar mediciones de ${creado.nombre}.` });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos agregar el test',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  };

  const guardar = async () => {
    if (!tipoElegido || !fecha) return;
    setGuardando(true);
    try {
      const resultado = await guardarResultados({
        equipo: equipoId,
        tipoTest: tipoElegido,
        fecha,
        resultados: plantel.map((j) => ({
          jugadorId: j.jugadorId,
          valor: valores[j.jugadorId]?.trim() ? Number(valores[j.jugadorId]) : '',
        })),
      });
      await cargar();
      addToast({
        type: 'success',
        title: 'Mediciones guardadas',
        message: `${resultado.guardadas} cargada${resultado.guardadas === 1 ? '' : 's'}${
          resultado.borradas > 0 ? ` · ${resultado.borradas} borrada${resultado.borradas === 1 ? '' : 's'}` : ''
        }.`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos guardar',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setGuardando(false);
    }
  };

  const archivar = async (tipo: TipoTest) => {
    try {
      const resp = await eliminarTipoTest(tipo._id);
      await cargar();
      addToast({
        type: 'success',
        title: resp?.archivado ? 'Test archivado' : 'Test eliminado',
        message:
          resp?.mensaje ??
          'Se eliminó el test del catálogo.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos eliminarlo',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  };

  const porTest = useMemo(() => {
    const mapa = new Map<string, EvolucionJugador[]>();
    for (const e of evolucion) {
      const lista = mapa.get(e.tipoTest) ?? [];
      lista.push(e);
      mapa.set(e.tipoTest, lista);
    }
    return [...mapa.entries()];
  }, [evolucion]);

  const sugerenciasPendientes = TESTS_SUGERIDOS.filter(
    (s) => !tipos.some((t) => t.nombre.toLowerCase() === s.nombre.toLowerCase()),
  );

  if (cargando) return <p className="text-sm text-slate-500">Cargando tests…</p>;

  return (
    <div className="space-y-8">
      {/* ---------- catálogo ---------- */}
      <section aria-label="Catálogo de tests" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <header className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">Qué mide tu equipo</h2>
          <p className="text-xs text-slate-500">
            El catálogo es tuyo: cada equipo mide cosas distintas. Podés arrancar de las
            sugerencias o crear el tuyo.
          </p>
        </header>

        {tipos.length > 0 && (
          <ul className="mb-3 divide-y divide-slate-100">
            {tipos.map((t) => (
              <li key={t._id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
                  {t.nombre}
                  {t.unidad ? <span className="font-normal text-slate-500"> · {t.unidad}</span> : null}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {ETIQUETA_DIRECCION[t.mejorEs]}
                </span>
                <button
                  type="button"
                  onClick={() => setAArchivar(t)}
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {sugerenciasPendientes.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Sugeridos:</p>
            <div className="flex flex-wrap gap-1.5">
              {sugerenciasPendientes.map((s) => (
                <button
                  key={s.nombre}
                  type="button"
                  onClick={() => void agregarTipo(s)}
                  title={s.descripcion}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 [touch-action:manipulation]"
                >
                  + {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="grid gap-2 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nuevoNombre.trim()) return;
            void agregarTipo({ nombre: nuevoNombre, unidad: nuevaUnidad, mejorEs: nuevaDireccion });
          }}
        >
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre del test"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="text"
            value={nuevaUnidad}
            onChange={(e) => setNuevaUnidad(e.target.value)}
            placeholder="Unidad (s, cm…)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={nuevaDireccion}
            onChange={(e) => setNuevaDireccion(e.target.value as TipoTestMejorEs)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="mayor">Más alto es mejor</option>
            <option value="menor">Más bajo es mejor</option>
            <option value="neutro">Sin juicio</option>
          </select>
          <button
            type="submit"
            disabled={!nuevoNombre.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 sm:col-span-4"
          >
            Agregar test
          </button>
        </form>
      </section>

      {/* ---------- carga de una jornada ---------- */}
      {tipos.length > 0 && (
        <section aria-label="Cargar mediciones" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <header className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">Cargar mediciones</h2>
            <p className="text-xs text-slate-500">
              Un test, una fecha, todo el plantel. Dejá vacío a quien no se midió — vacío no es
              cero.
            </p>
          </header>

          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Test
              <select
                value={tipoElegido}
                onChange={(e) => setTipoElegido(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {tipos.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.nombre}
                    {t.unidad ? ` (${t.unidad})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {plantel.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No hay jugadores con contrato vigente en el plantel.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {plantel.map((j) => (
                  <li key={j.jugadorId} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{j.jugador}</span>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={valores[j.jugadorId] ?? ''}
                      onChange={(e) =>
                        setValores((prev) => ({ ...prev, [j.jugadorId]: e.target.value }))
                      }
                      aria-label={`${tipoActual?.nombre ?? 'Valor'} de ${j.jugador}`}
                      placeholder="—"
                      className="h-11 w-24 shrink-0 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums"
                    />
                    <span className="w-12 shrink-0 text-xs text-slate-400">{tipoActual?.unidad}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void guardar()}
                  disabled={guardando}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando…' : 'Guardar mediciones'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------- evolución ---------- */}
      {porTest.length > 0 && (
        <section aria-label="Evolución por test" className="space-y-4">
          <header>
            <h2 className="text-base font-semibold text-slate-900">Evolución</h2>
            <p className="text-xs text-slate-500">
              De la primera medición a la última. La flecha considera hacia dónde es mejorar en
              cada test.
            </p>
          </header>

          {porTest.map(([nombre, filas]) => (
            <div key={nombre} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">{nombre}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-2 font-semibold">Jugador</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Primera</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Última</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Cambio</th>
                      <th className="py-1.5 text-right font-semibold">Mediciones</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {filas.map((f) => (
                      <tr key={`${f.jugadorId}-${f.tipoTestId}`} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 pr-2 text-slate-800">{f.jugador}</td>
                        <td className="py-1.5 pr-2 text-right text-slate-500">
                          {formatear(f.primera, f.decimales)}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-semibold text-slate-900">
                          {formatear(f.ultima, f.decimales)}
                        </td>
                        <td
                          className={`py-1.5 pr-2 text-right font-medium ${
                            f.mejoro === null
                              ? 'text-slate-400'
                              : f.mejoro
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {f.mediciones.length < 2 ? (
                            '—'
                          ) : (
                            <>
                              {f.mejoro === null ? '' : f.mejoro ? '▲ ' : '▼ '}
                              {f.delta > 0 ? '+' : ''}
                              {formatear(f.delta, f.decimales)}
                            </>
                          )}
                        </td>
                        <td className="py-1.5 text-right text-slate-400">{f.mediciones.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      <ConfirmModal
        isOpen={aArchivar !== null}
        variant="danger"
        title={`Quitar ${aArchivar?.nombre ?? 'el test'}`}
        message="Si el test ya tiene mediciones cargadas se archiva en vez de borrarse, para no dejar la serie histórica sin nombre ni unidad. Si no tiene ninguna, se elimina."
        confirmLabel="Quitar del catálogo"
        cancelLabel="Cancelar"
        onCancel={() => setAArchivar(null)}
        onConfirm={async () => {
          const tipo = aArchivar;
          setAArchivar(null);
          if (tipo) await archivar(tipo);
        }}
      />
    </div>
  );
};

export default SeccionTests;
