import React, { useEffect, useState } from 'react';
import { formatDate } from '../../../../shared/utils/formatDate';
import {
  getResumenPlanillas,
  type ResumenPlanillas,
} from '../../../partidos/services/planillaEquipoService';

/**
 * Análisis sobre las planillas propias del equipo.
 *
 * Va en una sección aparte, no como una pestaña de la tabla oficial, por dos razones:
 * los números son de otra naturaleza —captura propia, sin verificar— y además el
 * vocabulario es distinto (throws/hits/outs/catches contra puntos/bloqueos/faltas de
 * la tabla histórica). Fundirlos en una sola cifra borraría justamente la distinción
 * que hace que la planilla sea segura de usar.
 */

interface Props {
  equipoId: string;
}

const CAMPOS = [
  { key: 'throws', label: 'Throws' },
  { key: 'hits', label: 'Hits' },
  { key: 'outs', label: 'Outs' },
  { key: 'catches', label: 'Catches' },
] as const;

const SeccionMisPlanillas: React.FC<Props> = ({ equipoId }) => {
  const [resumen, setResumen] = useState<ResumenPlanillas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const cargar = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const data = await getResumenPlanillas(equipoId);
        if (!cancelado) setResumen(data);
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar tus planillas');
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [equipoId]);

  const oficializadas = resumen?.partidos.filter((p) => p.estado === 'oficializada').length ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">Mis planillas</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Datos propios
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Lo que capturó tu equipo por su cuenta. No son datos oficiales de la competencia y no se
          suman a los de arriba: sirven para analizar partidos que nadie más cargó.
        </p>
      </header>

      {loading ? (
        <p className="px-6 py-5 text-sm text-slate-500">Cargando tus planillas…</p>
      ) : error ? (
        <p className="px-6 py-5 text-sm text-rose-700">{error}</p>
      ) : !resumen || resumen.partidos.length === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Todavía no armaste ninguna planilla. Podés crear una desde el detalle de cualquier partido
          que hayas jugado, aunque ya esté finalizado.
        </p>
      ) : (
        <div className="space-y-6 px-6 py-5">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partidos</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {resumen.partidos.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ya oficializadas
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {oficializadas}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Jugadores con datos
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {resumen.jugadores.length}
              </p>
            </div>
          </div>

          {resumen.jugadores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 text-left">Jugador</th>
                    <th className="px-2 py-2 text-right">Partidos</th>
                    <th className="px-2 py-2 text-right">Sets</th>
                    {CAMPOS.map((c) => (
                      <th key={c.key} className="px-2 py-2 text-right">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums text-slate-700">
                  {resumen.jugadores.map((j) => (
                    <tr key={j.jugadorId} className="hover:bg-slate-50/60">
                      <td className="px-2 py-2 font-medium text-slate-900">{j.nombre}</td>
                      <td className="px-2 py-2 text-right">{j.partidos}</td>
                      <td className="px-2 py-2 text-right">{j.sets}</td>
                      {CAMPOS.map((c) => (
                        <td key={c.key} className="px-2 py-2 text-right">
                          {j[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Partido por partido
            </h3>
            <ul className="divide-y divide-slate-100">
              {resumen.partidos.map((p) => (
                <li key={p.planillaId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                  <span className="text-slate-800">
                    {p.partido?.fecha ? formatDate(p.partido.fecha) : 'Sin fecha'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {p.modo === 'sets' ? 'Set a set' : 'Totales'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      p.estado === 'oficializada'
                        ? 'bg-emerald-100 text-emerald-700'
                        : p.estado === 'pendiente_oficializacion'
                          ? 'bg-blue-100 text-blue-700'
                          : p.estado === 'rechazada'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {p.estado === 'oficializada'
                      ? 'Oficializada'
                      : p.estado === 'pendiente_oficializacion'
                        ? 'Esperando aprobación'
                        : p.estado === 'rechazada'
                          ? 'Rechazada'
                          : 'Borrador'}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-slate-500">
                    {p.totales.throws} throws · {p.totales.hits} hits · {p.totales.outs} outs ·{' '}
                    {p.totales.catches} catches
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};

export default SeccionMisPlanillas;
