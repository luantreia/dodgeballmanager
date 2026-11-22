// Resumen en palabras de una solicitud: qué se pide, sobre qué, y qué pasa si se aprueba.
//
// Existe porque el detalle mostraba `datosPropuestos` crudo (setId, partidoId, en_juego…) y quien
// aprueba no podía saber de qué partido se trataba. El backend manda `contexto` con los nombres
// ya resueltos (services/contextoSolicitudes.js); acá sólo se arma la oración.
//
// Regla para agregar un tipo: el "si aprobás" tiene que describir lo que hace el backend al
// aprobar (routes/solicitudEdicion.js), no lo que uno supone. Si no está claro, mejor no decirlo.
//
// Este archivo es idéntico en las cinco apps que muestran solicitudes.

import React from 'react';

export interface ContextoSolicitud {
  partido: { id: string; local: string | null; visitante: string | null; nombre: string | null; fecha: string | null; competencia: string | null } | null;
  set: { numero: number } | null;
  equipo: { id: string; nombre: string } | null;
  jugador: { id: string; nombre: string | null } | null;
  organizacion: { id: string; nombre: string } | null;
}

interface SolicitudResumible {
  tipo: string;
  datosPropuestos?: Record<string, any>;
  creadoPor?: unknown;
  contexto?: ContextoSolicitud | null;
}

const fechaCorta = (f: string | null) =>
  f ? new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : null;

/** "Lobos vs Halcones" (+ competencia y fecha en el detalle). */
export function describirPartido(p: ContextoSolicitud['partido']): string | null {
  if (!p) return null;
  if (p.local && p.visitante) return `${p.local} vs ${p.visitante}`;
  return p.nombre || null;
}

const solicitante = (creadoPor: unknown) =>
  (typeof creadoPor === 'object' && creadoPor && 'nombre' in creadoPor && (creadoPor as { nombre?: string }).nombre) || 'Alguien';

const VISIBILIDAD: Record<string, string> = {
  organizacion: 'solo la organización',
  publica: 'cualquiera, también en el portal público',
};

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-slate-900">{children}</strong>;

type Resumen = { que: React.ReactNode; siAprobas?: React.ReactNode };

function resumir(s: SolicitudResumible): Resumen | null {
  const c = s.contexto ?? null;
  const d = s.datosPropuestos ?? {};
  const quien = solicitante(s.creadoPor);
  const partido = describirPartido(c?.partido ?? null);
  const enPartido = partido ? <> de <B>{partido}</B></> : null;
  const set = c?.set?.numero ?? (Number.isFinite(Number(d.numeroSet)) ? Number(d.numeroSet) : null);
  const delSet = set != null ? <B>set {set}</B> : <>un set</>;
  const visibilidad = VISIBILIDAD[d.visibilidadObjetivo] ?? VISIBILIDAD.organizacion;
  const equipo = c?.equipo?.nombre;

  switch (s.tipo) {
    case 'estadisticasJugadorSet-lote':
    case 'estadisticasJugadorSet':
      return {
        que: <>{quien} quiere publicar las estadísticas{equipo ? <> de <B>{equipo}</B></> : null} en el {delSet}{enPartido}.</>,
        siAprobas: <>Esas estadísticas pasan a ser oficiales y las ve {visibilidad}.</>,
      };
    case 'estadisticas-set-propuesta':
      return {
        que: <>{quien} propone estadísticas para el {delSet}{enPartido}.</>,
        siAprobas: <>Los números propuestos se cargan como oficiales (todavía no existen) y los ve {visibilidad}.</>,
      };
    case 'estadisticas-partido-propuesta':
      return {
        que: <>{quien} propone los totales de estadísticas{enPartido}, cargados a mano y sin sets.</>,
        siAprobas: <>Esos totales se cargan como oficiales y los ve {visibilidad}.</>,
      };
    case 'resultadoSet': {
      const accion = d.accion;
      if (accion === 'crear') {
        return {
          que: <>{quien} quiere crear el {delSet}{enPartido}.</>,
          siAprobas: <>El set se crea en el partido{d.ganadorSet && d.ganadorSet !== 'pendiente' ? <> con ganador <B>{d.ganadorSet}</B></> : <>, todavía sin ganador</>}.</>,
        };
      }
      if (accion === 'actualizar') {
        return { que: <>{quien} quiere cambiar el {delSet}{enPartido}.</>, siAprobas: <>El set queda con los valores propuestos (ganador, estado o número).</> };
      }
      if (accion === 'eliminar') {
        return { que: <>{quien} quiere borrar el {delSet}{enPartido}.</>, siAprobas: <>El set se elimina del partido.</> };
      }
      return { que: <>{quien} propone un cambio en el {delSet}{enPartido}.</> };
    }
    case 'resultadoPartido':
      return { que: <>{quien} quiere cargar el resultado{enPartido}.</> };
    case 'editarPartidoCompetencia':
      return { que: <>{quien} quiere editar los datos{enPartido}.</> };
    case 'editarPartidoVideo':
      return { que: <>{quien} quiere agregar el video{enPartido}.</>, siAprobas: <>El video queda asociado al partido.</> };
    case 'planilla-equipo-oficializacion':
      return { que: <>{quien} quiere oficializar la planilla{equipo ? <> de <B>{equipo}</B></> : null}{enPartido}.</> };
    case 'usuario-crear-organizacion':
    case 'usuario-crear-equipo':
    case 'usuario-crear-jugador': {
      const que = { 'usuario-crear-organizacion': 'la organización', 'usuario-crear-equipo': 'el equipo', 'usuario-crear-jugador': 'el jugador' }[s.tipo];
      return {
        que: d.nombre ? <>{quien} quiere crear {que} <B>{d.nombre}</B>.</> : <>{quien} quiere crear {que}, pero la solicitud no trae nombre.</>,
        siAprobas: d.nombre ? <>Se crea y {quien} queda como administrador.</> : <>No se puede aprobar sin nombre: rechazala y pedí que la vuelva a cargar.</>,
      };
    }
    case 'usuario-solicitar-admin-equipo':
      return { que: <>{quien} quiere administrar el equipo {equipo ? <B>{equipo}</B> : null}.</>, siAprobas: <>Pasa a ser administrador del equipo.</> };
    case 'usuario-solicitar-admin-jugador':
      return { que: <>{quien} quiere administrar el perfil de {c?.jugador?.nombre ? <B>{c.jugador.nombre}</B> : 'un jugador'}.</>, siAprobas: <>Pasa a ser administrador de ese perfil.</> };
    case 'usuario-solicitar-admin-organizacion':
      return { que: <>{quien} quiere administrar la organización {c?.organizacion?.nombre ? <B>{c.organizacion.nombre}</B> : null}.</>, siAprobas: <>Pasa a ser administrador de la organización.</> };
    case 'jugador-claim':
      return {
        que: <>{quien} dice que el perfil de {c?.jugador?.nombre ? <B>{c.jugador.nombre}</B> : 'este jugador'} es suyo.</>,
        siAprobas: <>El perfil queda vinculado a su cuenta.</>,
      };
    default:
      return null;
  }
}

/** Datos de ubicación que acompañan al resumen: competencia y fecha del partido. */
function ubicacion(c: ContextoSolicitud | null | undefined): string | null {
  const p = c?.partido;
  if (!p) return null;
  return [p.competencia, fechaCorta(p.fecha)].filter(Boolean).join(' · ') || null;
}

export const ResumenSolicitud: React.FC<{ solicitud: SolicitudResumible }> = ({ solicitud }) => {
  const r = resumir(solicitud);
  if (!r) return null;
  const donde = ubicacion(solicitud.contexto);
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
      <p>{r.que}</p>
      {donde ? <p className="text-xs text-slate-500">{donde}</p> : null}
      {r.siAprobas ? (
        <p className="text-sm">
          <span className="font-semibold text-emerald-800">Si aprobás: </span>
          {r.siAprobas}
        </p>
      ) : null}
    </div>
  );
};

/** ¿Este campo de datosPropuestos es un id o lista de ids? No le dice nada a quien aprueba. */
export const esCampoTecnico = (clave: string, valor: unknown) =>
  /(^|[a-z])Id$|Ids$|^_id$|^__v$/.test(clave) ||
  (typeof valor === 'string' && /^[0-9a-f]{24}$/i.test(valor)) ||
  (Array.isArray(valor) && valor.every((v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v)));

const VALORES: Record<string, string> = {
  en_juego: 'En juego',
  finalizado: 'Finalizado',
  pendiente: 'Pendiente',
  programado: 'Programado',
  cancelado: 'Cancelado',
  organizacion: 'Solo la organización',
  publica: 'Pública',
  crear: 'Crear',
  actualizar: 'Actualizar',
  eliminar: 'Eliminar',
  local: 'Local',
  visitante: 'Visitante',
};

/** "visibilidadObjetivo" → "Visibilidad objetivo"; "captura-estadistica" → "Captura estadistica". */
export const humanizar = (s: string) => {
  const t = s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const valorLegible = (v: string) => VALORES[v] ?? (/^[a-z]+([_-][a-z]+)+$/.test(v) ? humanizar(v) : v);
