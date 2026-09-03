import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { formatDateTime } from '../../../shared/utils/formatDate';
import {
  guardarAsistencias,
  obtenerEntrenamiento,
  type AsistenciaEntrenamientoEstado,
  type EntrenamientoDetalle,
  type FilaAsistencia,
} from '../services/entrenamientoService';

type Props = {
  entrenamientoId: string;
  onClose: () => void;
  onGuardado: () => void | Promise<void>;
};

/**
 * Los cuatro estados que el DT marca de verdad. `convocado` es el inicial y no se ofrece como
 * opción: es el "todavía no lo marqué", no una decisión.
 */
const ESTADOS: Array<{ valor: AsistenciaEntrenamientoEstado; corto: string; clase: string }> = [
  { valor: 'presente', corto: 'P', clase: 'bg-emerald-600 text-white' },
  { valor: 'tarde', corto: 'T', clase: 'bg-amber-500 text-white' },
  { valor: 'ausente', corto: 'A', clase: 'bg-rose-600 text-white' },
  { valor: 'justificado', corto: 'J', clase: 'bg-slate-500 text-white' },
];

const ETIQUETAS: Record<AsistenciaEntrenamientoEstado, string> = {
  convocado: 'Sin marcar',
  presente: 'Presente',
  tarde: 'Tarde',
  ausente: 'Ausente',
  justificado: 'Justificado',
};

/**
 * Toma de asistencia.
 *
 * Está pensada para usarse de pie, con una mano, mientras el plantel llega: una fila por
 * jugador y cuatro botones grandes por fila, sin desplegables ni modales anidados. Los botones
 * miden 44px porque es la pantalla que más se toca de toda la sección.
 */
const ModalAsistencia = ({ entrenamientoId, onClose, onGuardado }: Props) => {
  const { addToast } = useToast();
  const [detalle, setDetalle] = useState<EntrenamientoDetalle | null>(null);
  const [filas, setFilas] = useState<FilaAsistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    let cancelado = false;
    obtenerEntrenamiento(entrenamientoId)
      .then((data) => {
        if (cancelado) return;
        setDetalle(data);
        setFilas(data.asistencias);
      })
      .catch((error) => {
        if (!cancelado) {
          addToast({
            type: 'error',
            title: 'No pudimos cargar el entrenamiento',
            message: error instanceof Error ? error.message : 'Error inesperado',
          });
        }
      })
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [entrenamientoId, addToast]);

  const marcar = useCallback((jugadorId: string, estado: AsistenciaEntrenamientoEstado) => {
    setSucio(true);
    setFilas((prev) =>
      prev.map((f) => (f.jugadorId === jugadorId ? { ...f, estado } : f)),
    );
  }, []);

  /** Marcar a todos presentes y corregir las excepciones es mucho más rápido que al revés. */
  const marcarTodos = useCallback((estado: AsistenciaEntrenamientoEstado) => {
    setSucio(true);
    setFilas((prev) => prev.map((f) => ({ ...f, estado })));
  }, []);

  const conteo = useMemo(() => {
    const acc = { presente: 0, tarde: 0, ausente: 0, justificado: 0, convocado: 0 };
    for (const f of filas) acc[f.estado] += 1;
    return acc;
  }, [filas]);

  const guardar = useCallback(async () => {
    setGuardando(true);
    try {
      await guardarAsistencias(
        entrenamientoId,
        filas.map((f) => ({
          jugadorId: f.jugadorId,
          estado: f.estado,
          minutosTarde: f.minutosTarde,
          notas: f.notas,
        })),
      );
      setSucio(false);
      await Promise.resolve(onGuardado());
      addToast({
        type: 'success',
        title: 'Asistencia guardada',
        message: 'El entrenamiento queda marcado como realizado.',
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No pudimos guardar la asistencia',
        message: error instanceof Error ? error.message : 'Error inesperado',
      });
    } finally {
      setGuardando(false);
    }
  }, [entrenamientoId, filas, onGuardado, onClose, addToast]);

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      size="lg"
      title="Asistencia"
      subtitle={detalle ? `${formatDateTime(detalle.fecha)}${detalle.lugar ? ` · ${detalle.lugar}` : ''}` : undefined}
      hasUnsavedChanges={sucio}
      unsavedMessage="Marcaste asistencia que todavía no guardaste. ¿Cerrar y perderla?"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 tabular-nums">
            {conteo.presente + conteo.tarde} de {filas.length} presentes
            {conteo.convocado > 0 ? ` · ${conteo.convocado} sin marcar` : ''}
          </p>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando || filas.length === 0}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar asistencia'}
          </button>
        </div>
      }
    >
      {cargando ? (
        <p className="py-8 text-center text-sm text-slate-500">Cargando plantel…</p>
      ) : filas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Este entrenamiento no tiene jugadores convocados. Revisá que tu plantel tenga contratos
          aceptados.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Marcar a todos:</span>
            {ESTADOS.map((e) => (
              <button
                key={e.valor}
                type="button"
                onClick={() => marcarTodos(e.valor)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 [touch-action:manipulation]"
              >
                {ETIQUETAS[e.valor]}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-slate-100">
            {filas.map((fila) => (
              <li key={fila.jugadorId} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {fila.jugador}
                </span>
                <div className="flex shrink-0 gap-1" role="group" aria-label={`Asistencia de ${fila.jugador}`}>
                  {ESTADOS.map((e) => {
                    const activo = fila.estado === e.valor;
                    return (
                      <button
                        key={e.valor}
                        type="button"
                        onClick={() => marcar(fila.jugadorId, e.valor)}
                        aria-pressed={activo}
                        aria-label={`${ETIQUETAS[e.valor]}: ${fila.jugador}`}
                        title={ETIQUETAS[e.valor]}
                        className={`h-11 w-11 rounded-lg text-sm font-bold transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
                          activo ? e.clase : 'border border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {e.corto}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalBase>
  );
};

export default ModalAsistencia;
