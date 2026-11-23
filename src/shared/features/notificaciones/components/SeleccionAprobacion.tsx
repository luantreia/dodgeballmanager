// Aprobación parcial: elegir qué partes de una solicitud incorporar.
//
// El backend (overtime/src/utils/seleccionAprobacion.js) acepta `seleccion` al aprobar; lo no
// elegido se descarta y queda registrado. Acá viven:
//   - el registro de la selección por solicitud: el detalle (donde se tilda) y el botón Aprobar
//     (en otra celda de la tabla) no comparten estado de React, así que se encuentran acá;
//   - los selectores de lote de stats y de edición de contrato.
// El de planilla está en PlanillaOficializacionDetalle (Organizaciones), porque necesita el visor.
//
// Este archivo es idéntico en las cinco apps que muestran solicitudes.

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { authFetch } from '../../../utils/authFetch';

type Seleccion = Record<string, unknown>;

const selecciones = new Map<string, Seleccion>();
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** null = aprobar todo (lo mismo que no haber tocado nada). */
export function setSeleccion(solicitudId: string, seleccion: Seleccion | null) {
  if (seleccion) selecciones.set(solicitudId, seleccion);
  else selecciones.delete(solicitudId);
  avisar();
}

export const getSeleccion = (solicitudId: string): Seleccion | undefined => selecciones.get(solicitudId);

/** Para que el botón Aprobar cambie su texto cuando hay una selección parcial. */
export function useHaySeleccion(solicitudId: string): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => selecciones.has(solicitudId),
  );
}

const Casilla: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }> = ({ checked, onChange, children }) => (
  <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm text-slate-700 hover:bg-slate-50">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
    />
    <span className="min-w-0">{children}</span>
  </label>
);

const Marco: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div className="rounded-lg border border-slate-200 p-3">
    <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">{titulo}</p>
    <p className="mb-2 text-xs text-slate-500">Lo que destildes se descarta al aprobar; la solicitud se cierra igual.</p>
    {children}
  </div>
);

// ── Lote de estadísticas de un set ───────────────────────────────────────────

interface FilaStat {
  _id: string;
  throws?: number;
  hits?: number;
  outs?: number;
  catches?: number;
  jugador?: { nombre?: string; alias?: string } | string;
  jugadorPartido?: { jugador?: { nombre?: string; alias?: string } | string } | string;
}

const nombreFila = (f: FilaStat) => {
  const j = typeof f.jugador === 'object' ? f.jugador : typeof f.jugadorPartido === 'object' && typeof f.jugadorPartido.jugador === 'object' ? f.jugadorPartido.jugador : undefined;
  return j?.alias || j?.nombre || 'Jugador';
};

export const SeleccionLote: React.FC<{ solicitudId: string; setId: string; statIds: string[] }> = ({ solicitudId, setId, statIds }) => {
  const [filas, setFilas] = useState<FilaStat[] | null>(null);
  const [error, setError] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(() => {
    const previa = getSeleccion(solicitudId)?.statIds;
    return new Set(Array.isArray(previa) ? (previa as string[]) : statIds);
  });

  // Clave de texto y no el array: quien llama arma statIds en cada render y el efecto
  // se dispararía en bucle.
  const clave = statIds.join(",");
  useEffect(() => {
    let cancelado = false;
    const ids = clave.split(",");
    authFetch<FilaStat[] | { estadisticas?: FilaStat[] }>(`/estadisticas/jugador-set?set=${setId}`)
      .then((r) => {
        const lista = Array.isArray(r) ? r : r.estadisticas ?? [];
        if (!cancelado) setFilas(lista.filter((f) => ids.includes(String(f._id))));
      })
      .catch(() => !cancelado && setError(true));
    return () => {
      cancelado = true;
    };
  }, [setId, clave]);

  const cambiar = (id: string, v: boolean) => {
    const next = new Set(elegidas);
    if (v) next.add(id);
    else next.delete(id);
    setElegidas(next);
    setSeleccion(solicitudId, next.size === statIds.length ? null : { statIds: [...next] });
  };

  if (error) return null; // sin la lista no se puede elegir: queda el aprobar todo de siempre
  if (!filas) return <p className="text-xs text-slate-500">Cargando las estadísticas…</p>;
  if (filas.length < 2) return null; // con una sola fila no hay nada que elegir

  return (
    <Marco titulo="Qué estadísticas publicar">
      {filas.map((f) => (
        <Casilla key={f._id} checked={elegidas.has(f._id)} onChange={(v) => cambiar(f._id, v)}>
          <span className="font-medium text-slate-900">{nombreFila(f)}</span>{' '}
          <span className="text-xs tabular-nums text-slate-500">
            {f.throws ?? 0} tiros · {f.hits ?? 0} hits · {f.outs ?? 0} outs · {f.catches ?? 0} atrapadas
          </span>
        </Casilla>
      ))}
    </Marco>
  );
};

// ── Edición de contrato ───────────────────────────────────────────────────────

const GRUPOS: Array<{ id: 'rol' | 'foto' | 'fechas' | 'estado'; claves: string[]; label: (d: Record<string, any>) => string }> = [
  { id: 'rol', claves: ['rol'], label: (d) => `Rol: ${d.rol}` },
  { id: 'foto', claves: ['foto'], label: () => 'Foto nueva' },
  {
    id: 'fechas',
    claves: ['fechaInicio', 'fechaFin', 'desde', 'hasta'],
    label: (d) => {
      const f = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('es-AR') : '—');
      return `Fechas: ${f(d.fechaInicio ?? d.desde)} → ${f(d.fechaFin ?? d.hasta)}`;
    },
  },
  { id: 'estado', claves: ['estado'], label: (d) => `Estado: ${d.estado}` },
];

export const SeleccionContrato: React.FC<{ solicitudId: string; datos: Record<string, any> }> = ({ solicitudId, datos }) => {
  const presentes = GRUPOS.filter((g) => g.claves.some((k) => datos[k] !== undefined));
  const [elegidos, setElegidos] = useState<Set<string>>(() => {
    const previa = getSeleccion(solicitudId)?.campos;
    return new Set(Array.isArray(previa) ? (previa as string[]) : presentes.map((g) => g.id));
  });
  if (presentes.length < 2) return null;

  const cambiar = (id: string, v: boolean) => {
    const next = new Set(elegidos);
    if (v) next.add(id);
    else next.delete(id);
    setElegidos(next);
    setSeleccion(solicitudId, next.size === presentes.length ? null : { campos: [...next] });
  };

  return (
    <Marco titulo="Qué cambios aplicar">
      {presentes.map((g) => (
        <Casilla key={g.id} checked={elegidos.has(g.id)} onChange={(v) => cambiar(g.id, v)}>
          {g.label(datos)}
        </Casilla>
      ))}
    </Marco>
  );
};
