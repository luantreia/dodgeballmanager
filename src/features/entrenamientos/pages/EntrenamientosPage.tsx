import { useCallback, useEffect, useState } from 'react';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import ConfirmModal from '../../../shared/components/ConfirmModal/ConfirmModal';
import {
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../../../shared/utils/formatDate';
import {
  crearEntrenamiento,
  eliminarEntrenamiento,
  getResumenAsistencia,
  listarEntrenamientos,
  type EntrenamientoResumen,
  type EntrenamientoTipo,
  type ResumenJugador,
} from '../services/entrenamientoService';
import ModalAsistencia from '../components/ModalAsistencia';

const TIPOS: Array<{ valor: EntrenamientoTipo; label: string }> = [
  { valor: 'general', label: 'General' },
  { valor: 'fisico', label: 'Físico' },
  { valor: 'tactico', label: 'Táctico' },
  { valor: 'tecnico', label: 'Técnico' },
  { valor: 'amistoso_interno', label: 'Amistoso interno' },
  { valor: 'otro', label: 'Otro' },
];

const porcentaje = (valor: number | null) => (valor === null ? '—' : `${Math.round(valor * 100)}%`);

/** Semáforo del porcentaje de asistencia. Un número suelto no dice si está bien o mal. */
const claseAsistencia = (valor: number | null): string => {
  if (valor === null) return 'text-slate-400';
  if (valor >= 0.85) return 'text-emerald-700';
  if (valor >= 0.6) return 'text-amber-700';
  return 'text-rose-700';
};

/**
 * Entrenamientos y asistencia.
 *
 * Es lo que convierte el panel en algo de uso semanal y no sólo de día de partido: hasta acá,
 * un DT abría la app cuando jugaba. La asistencia acumulada es además de los pocos datos que
 * explican el rendimiento sin que nadie tenga que cargar una sola estadística.
 */
const EntrenamientosPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const { addToast } = useToast();

  const [entrenamientos, setEntrenamientos] = useState<EntrenamientoResumen[]>([]);
  const [resumen, setResumen] = useState<{ totalEntrenamientos: number; jugadores: ResumenJugador[] } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<EntrenamientoResumen | null>(null);

  const [fecha, setFecha] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [lugar, setLugar] = useState('');
  const [tipo, setTipo] = useState<EntrenamientoTipo>('general');

  const equipoId = equipoSeleccionado?.id;

  const cargar = useCallback(async () => {
    if (!equipoId) return;
    setCargando(true);
    try {
      // El resumen no debe tumbar la lista si falla: son dos preguntas distintas.
      const [lista, res] = await Promise.all([
        listarEntrenamientos(equipoId),
        getResumenAsistencia(equipoId).catch(() => null),
      ]);
      setEntrenamientos(lista);
      setResumen(res);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos cargar los entrenamientos',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setCargando(false);
    }
  }, [equipoId, addToast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!equipoId) return;
    const iso = fromDatetimeLocalValue(fecha);
    if (!iso) {
      addToast({ type: 'error', title: 'Fecha inválida', message: 'Revisá la fecha del entrenamiento.' });
      return;
    }

    setCreando(true);
    try {
      await crearEntrenamiento({ equipo: equipoId, fecha: iso, lugar, tipo });
      setLugar('');
      await cargar();
      addToast({
        type: 'success',
        title: 'Entrenamiento creado',
        message: 'Se convocó a todo el plantel. Marcá las excepciones al tomar asistencia.',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos crear el entrenamiento',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setCreando(false);
    }
  };

  const borrar = async (id: string) => {
    try {
      await eliminarEntrenamiento(id);
      await cargar();
      addToast({ type: 'success', title: 'Entrenamiento eliminado', message: 'Se borró junto con su asistencia.' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos eliminarlo',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    }
  };

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">Elegí un equipo para gestionar sus entrenamientos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Entrenamientos</h1>
        <p className="text-sm text-slate-500">
          Citá al plantel, tomá asistencia y mirá quién sostiene la semana.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-base font-semibold text-slate-900">Nuevo entrenamiento</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={crear}>
          <label className="text-xs font-medium text-slate-600">
            Cuándo
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Dónde
            <input
              type="text"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Gimnasio, club…"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as EntrenamientoTipo)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={creando}
            className="self-end rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {creando ? 'Creando…' : 'Crear y convocar'}
          </button>
        </form>
      </section>

      {resumen && resumen.jugadores.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <header className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">Asistencia del plantel</h2>
            <p className="text-xs text-slate-500">
              Sobre {resumen.totalEntrenamientos} entrenamiento
              {resumen.totalEntrenamientos === 1 ? '' : 's'} realizado
              {resumen.totalEntrenamientos === 1 ? '' : 's'}. Los justificados no cuentan como falta.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-2 font-semibold">Jugador</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Presente</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Tarde</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Ausente</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Justif.</th>
                  <th className="py-1.5 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {resumen.jugadores.map((j) => (
                  <tr key={j.jugadorId} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-2 text-slate-800">{j.jugador}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-600">{j.presente}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-600">{j.tarde}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-600">{j.ausente}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-400">{j.justificado}</td>
                    <td className={`py-1.5 text-right font-bold ${claseAsistencia(j.porcentaje)}`}>
                      {porcentaje(j.porcentaje)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Sesiones</h2>

        {cargando ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : entrenamientos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Todavía no cargaste ningún entrenamiento.
          </p>
        ) : (
          <ul className="space-y-2">
            {entrenamientos.map((e) => {
              const presentes = e.asistencia.presente + e.asistencia.tarde;
              const total =
                presentes + e.asistencia.ausente + e.asistencia.justificado + e.asistencia.convocado;
              return (
                <li
                  key={e._id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateTime(e.fecha)}
                      {e.lugar ? <span className="font-normal text-slate-500"> · {e.lugar}</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {TIPOS.find((t) => t.valor === e.tipo)?.label ?? e.tipo}
                      {e.estado === 'programado' ? ' · sin asistencia tomada' : ''}
                      {e.estado === 'cancelado' ? ' · cancelado' : ''}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                    {presentes}/{total}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAbierto(e._id)}
                    className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 [touch-action:manipulation]"
                  >
                    {e.estado === 'programado' ? 'Tomar asistencia' : 'Ver / editar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAEliminar(e)}
                    aria-label="Eliminar entrenamiento"
                    className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    Eliminar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {abierto && (
        <ModalAsistencia
          entrenamientoId={abierto}
          onClose={() => setAbierto(null)}
          onGuardado={cargar}
        />
      )}

      <ConfirmModal
        isOpen={aEliminar !== null}
        variant="danger"
        title="Eliminar el entrenamiento"
        message={
          aEliminar
            ? `Se borra la sesión del ${formatDateTime(aEliminar.fecha)} y toda su asistencia. No se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onCancel={() => setAEliminar(null)}
        onConfirm={async () => {
          const id = aEliminar?._id;
          setAEliminar(null);
          if (id) await borrar(id);
        }}
      />
    </div>
  );
};

export default EntrenamientosPage;
