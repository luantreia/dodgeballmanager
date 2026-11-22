import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { listarAportes, resolverAporte, type AporteJugador, type Totales } from '../services/aportesService';

/**
 * Bandeja de aportes: jugadores del plantel que cargaron sus propios números de un partido
 * y te los ofrecen. Aceptar los copia a la planilla del equipo de ese partido (no a lo
 * oficial); descartar sólo cierra el aporte.
 *
 * No se muestra si no hay nada pendiente: es una bandeja, no una sección permanente.
 */

interface Props {
  equipoId: string;
  /** Para que el análisis de abajo se refresque cuando un aporte cambia la planilla del equipo. */
  onCambio?: () => void;
}

const CAMPOS: Array<keyof Totales> = ['throws', 'hits', 'outs', 'catches'];
const INICIAL: Record<keyof Totales, string> = { throws: 'T', hits: 'H', outs: 'O', catches: 'C' };
const fmt = (t: Totales | null | undefined) => (t ? CAMPOS.map((c) => `${INICIAL[c]}${t[c]}`).join(' ') : '—');

const nombre = (j: AporteJugador['jugador']) => j.alias || [j.nombre, j.apellido].filter(Boolean).join(' ') || 'Jugador';

/** Por qué no se puede aceptar directo, si es que no se puede. */
const bloqueo = (a: AporteJugador): string | null => {
  const pl = a.planillaDelEquipo;
  if (!pl) return null;
  if (pl.estado === 'pendiente_oficializacion' || pl.estado === 'oficializada') {
    return 'La planilla del equipo de este partido ya está cerrada.';
  }
  if (pl.modo === 'sets') return 'La planilla del equipo es set a set: estos totales no se pueden repartir en sets.';
  return null;
};

const BandejaAportes = ({ equipoId, onCambio }: Props) => {
  const { addToast } = useToast();
  const [aportes, setAportes] = useState<AporteJugador[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setAportes(await listarAportes(equipoId));
    } catch {
      // Sin permiso de captura o error de red: la bandeja simplemente no aparece.
      setAportes([]);
    }
  }, [equipoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resolver = async (a: AporteJugador, accion: 'aceptar' | 'descartar') => {
    setOcupado(a.planillaId);
    try {
      await resolverAporte(a.planillaId, accion);
      addToast({
        type: 'success',
        title: accion === 'aceptar' ? 'Aporte aceptado' : 'Aporte descartado',
        message: accion === 'aceptar' ? `Los números de ${nombre(a.jugador)} quedaron en la planilla del equipo.` : 'Listo.',
      });
      await cargar();
      if (accion === 'aceptar') onCambio?.();
    } catch (e) {
      addToast({ type: 'error', title: 'Error', message: e instanceof Error ? e.message : 'No se pudo resolver el aporte' });
    } finally {
      setOcupado(null);
    }
  };

  if (!aportes.length) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">
          Números aportados por jugadores <span className="text-slate-500">({aportes.length})</span>
        </h2>
        <p className="text-sm text-slate-600">
          Cada uno cargó sus propios totales de un partido. Si los aceptás, pasan a la planilla del equipo — no a lo oficial.
        </p>
      </header>

      <ul className="divide-y divide-amber-100">
        {aportes.map((a) => {
          const motivo = bloqueo(a);
          const ya = a.planillaDelEquipo?.totalesDelJugador;
          return (
            <li key={a.planillaId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">{nombre(a.jugador)}</p>
                <p className="text-xs text-slate-500">
                  {a.partido.equipoLocal?.nombre ?? 'Local'} vs {a.partido.equipoVisitante?.nombre ?? 'Visitante'} ·{' '}
                  {new Date(a.partido.fecha).toLocaleDateString('es-AR')}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-slate-700">
                  Aporta <span className="font-semibold">{fmt(a.totales)}</span>
                  {ya && <span className="text-slate-500"> · hoy en tu planilla {fmt(ya)}</span>}
                </p>
                {a.notas && <p className="mt-0.5 text-xs italic text-slate-500">“{a.notas}”</p>}
                {motivo && <p className="mt-0.5 text-xs text-amber-800">{motivo}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupado === a.planillaId}
                  onClick={() => void resolver(a, 'descartar')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={ocupado === a.planillaId || !!motivo}
                  title={motivo ?? undefined}
                  onClick={() => void resolver(a, 'aceptar')}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {ya ? 'Reemplazar con estos' : 'Aceptar'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default BandejaAportes;
