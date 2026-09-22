import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import {
  getTimelineEquipo,
  type EquipoResumen,
  type FuenteDatos,
  type PartidoTimeline,
} from '../../services/timelineService';
import { getFilasAnaliticas, type FilaAnalitica } from '../../services/filasService';
import { clonarFiltros, describirFiltros, useFiltrosPartidos } from '../../hooks/useFiltrosPartidos';
import PanelFiltrosPartidos from '../PanelFiltrosPartidos';
import LineaTemporalPartidos from '../LineaTemporalPartidos';
import EstadisticasFiltradas from '../EstadisticasFiltradas';
import ComparadorSegmentos, { type Segmento } from '../ComparadorSegmentos';
import AnalisisCruzado from './AnalisisCruzado';
import SeccionSinergias from './SeccionSinergias';
import SeccionCondicionesSet from './SeccionCondicionesSet';
import { construirSets } from '../../utils/setsAnaliticos';
import ModalVisorPartido from '../ModalVisorPartido';
import ModalScoutearPartido from '../ModalScoutearPartido';
import ModalPlanillasHuerfanas from '../ModalPlanillasHuerfanas';
import ModalPlanillaEquipo from '../../../partidos/components/modals/ModalPlanillaEquipo';
import ModalCapturaSetEstadisticas from '../../../partidos/components/modals/ModalCapturaSetEstadisticas';
import { getPartidoDetallado, type PartidoDetallado } from '../../../partidos/services/partidoService';

type Props = {
  equipoId: string;
  equipoNombre?: string;
  token: string;
};

type Vista =
  | { tipo: 'ninguna' }
  | { tipo: 'visor'; partido: PartidoTimeline }
  | { tipo: 'planilla'; partido: PartidoTimeline }
  | { tipo: 'captura'; partido: PartidoTimeline };

type Pestana = 'resumen' | 'sinergias' | 'sets' | 'partidos' | 'mas';

const PESTANAS: Array<{ id: Pestana; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'sinergias', label: 'Sinergias' },
  { id: 'sets', label: 'Sets' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'mas', label: 'Más' },
];

/**
 * La pantalla de análisis del DT: un shell fijo con la pregunta, y pestañas con las respuestas.
 *
 * Sigue el patrón de `CompetenciaRankedSection` en Overtime-Organizaciones: una barra
 * `sticky top-0` con chips que despliegan su configuración en el lugar, una fila de pestañas
 * segmentadas debajo, y sólo el contenido de la activa. Antes esto era una columna de filtros al
 * costado más seis bloques apilados, tres de ellos plegables. En escritorio se leía bien; en un
 * teléfono era un scroll de varias pantallas donde para comparar el resumen con las sinergias
 * había que recordar los números en el camino. Con pestañas, cambiar de pregunta es un toque y la
 * posición de scroll no se pierde.
 *
 * Los dos datasets se piden una sola vez: `timeline` (un registro por partido, para filtrar y
 * listar) y `filas` (un registro por jugador y por set, para las métricas). Los filtros operan
 * sobre los partidos y las filas heredan la decisión por `partidoId` — así "lo que ves" y "lo
 * que se suma" no pueden separarse. De esas mismas filas sale `setsAnaliticos`, que reagrupa por
 * set y alimenta a las sinergias y a las condiciones del set.
 *
 * Sólo se monta la pestaña activa, así que las agregaciones de las otras no se calculan: entrar a
 * la pantalla ya no enumera las combinaciones de sinergias de todos los sets del historial.
 */
const SeccionAnalisis = ({ equipoId, equipoNombre, token }: Props) => {
  const { addToast } = useToast();
  const [partidos, setPartidos] = useState<PartidoTimeline[]>([]);
  const [filas, setFilas] = useState<FilaAnalitica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: 'ninguna' });
  const [detalle, setDetalle] = useState<PartidoDetallado | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [scouteando, setScouteando] = useState(false);
  /**
   * A través de qué equipo se arma todo el análisis. Por defecto el propio; se puede apuntar a
   * cualquier equipo de `equiposDisponibles` (un rival de un partido jugado, o uno de los dos
   * lados de un partido scouteado a terceros) para ver el mismo motor de filtros/segmentos con
   * lo que este equipo capturó sobre ellos. Nunca lee la planilla privada del otro equipo — ver
   * el comentario de `obtenerFilasAnaliticas` en el backend.
   */
  const [perspectiva, setPerspectiva] = useState<EquipoResumen>({
    _id: equipoId,
    nombre: equipoNombre || 'Mi equipo',
    escudo: null,
  });
  const [equiposDisponibles, setEquiposDisponibles] = useState<EquipoResumen[]>([]);
  const [perspectivaAbierta, setPerspectivaAbierta] = useState(false);
  const [verHuerfanas, setVerHuerfanas] = useState(false);
  /**
   * Planilla de scouting recién creada, todavía no aparece en `partidos`/`filas` (esas
   * listas sólo traen partidos donde el equipo jugó — un partido scouteado no entra
   * ahí). Se abre en su propio estado, aparte de `vista`, para no simular un
   * `PartidoTimeline` que no existe todavía.
   */
  const [planillaScoutAbierta, setPlanillaScoutAbierta] = useState<{ partidoId: string; detalle: PartidoDetallado | null } | null>(null);

  const filtros = useFiltrosPartidos(partidos);

  // Cambiar de equipo (un DT con más de un plantel) invalida cualquier perspectiva y segmento
  // que hubiera elegido sobre el equipo anterior — si no, `perspectiva` seguiría apuntando a un
  // rival del equipo viejo, o directamente al equipo viejo mismo.
  useEffect(() => {
    setPerspectiva({ _id: equipoId, nombre: equipoNombre || 'Mi equipo', escudo: null });
    setSegmentos([]);
  }, [equipoId, equipoNombre]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [timeline, analiticas] = await Promise.all([
        getTimelineEquipo(equipoId, { perspectiva: perspectiva._id }),
        getFilasAnaliticas(equipoId, { perspectiva: perspectiva._id }),
      ]);
      setPartidos(timeline.partidos);
      setEquiposDisponibles(timeline.equiposDisponibles);
      setFilas(analiticas);
      setError(null);
    } catch (err) {
      setError('No pudimos cargar las estadísticas del equipo.');
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error inesperado',
      });
    } finally {
      setCargando(false);
    }
  }, [equipoId, perspectiva._id, addToast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Las filas heredan el filtrado de los partidos: filtrar es analizar, no sólo listar.
  const filasFiltradas = useMemo(() => {
    const ids = new Set(filtros.partidosFiltrados.map((p) => p._id));
    return filas.filter((fila) => ids.has(fila.partidoId));
  }, [filas, filtros.partidosFiltrados]);

  /**
   * Las filas reagrupadas por set: la unidad que necesitan tanto las sinergias entre jugadores
   * como las condiciones del set. Se calcula una sola vez acá y se pasa a las dos secciones, en
   * vez de que cada una recorra las filas por su cuenta.
   */
  const setsAnaliticos = useMemo(() => construirSets(filasFiltradas), [filasFiltradas]);

  const descripcionActual = useMemo(
    () => describirFiltros(partidos, { filtros: filtros.filtros, desde: filtros.desde, hasta: filtros.hasta }),
    [partidos, filtros.filtros, filtros.desde, filtros.hasta],
  );

  /**
   * Un segmento es una foto de los filtros de este momento. No hay un segundo formulario para
   * definirlo: armás la vista que te interesa, la guardás, cambiás los filtros y guardás otra.
   * Los `Set` se clonan porque el hook los reemplaza al filtrar y un segmento tiene que quedar
   * congelado.
   */
  const agregarSegmento = useCallback(() => {
    const estado = {
      filtros: clonarFiltros(filtros.filtros),
      desde: filtros.desde,
      hasta: filtros.hasta,
    };
    setSegmentos((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, nombre: describirFiltros(partidos, estado), estado },
    ]);
  }, [filtros.filtros, filtros.desde, filtros.hasta, partidos]);

  // Un segmento guardado bajo una perspectiva no significa lo mismo bajo otra — reaplicar sus
  // filtros a los datos de otro equipo daría una comparación sin sentido, así que se limpian.
  const elegirPerspectiva = useCallback((equipo: EquipoResumen) => {
    setPerspectiva(equipo);
    setSegmentos([]);
    setPerspectivaAbierta(false);
  }, []);

  const abrirCaptura = useCallback(
    async (partido: PartidoTimeline, fuente: FuenteDatos) => {
      // En los dos casos hace falta el partido con `equipoLocal`/`equipoVisitante` populados:
      // sin esto, el selector de ganador del set en "Mi planilla" no tiene de dónde sacar los
      // nombres reales y cae al genérico "Local"/"Visitante".
      try {
        const detallado = await getPartidoDetallado(partido._id);
        setDetalle(detallado);
        setVista({ tipo: fuente === 'planilla' || !partido.datos.oficial.existe ? 'planilla' : 'captura', partido });
      } catch (err) {
        addToast({
          type: 'error',
          title: 'No pudimos abrir la captura',
          message: err instanceof Error ? err.message : 'Error inesperado',
        });
      }
    },
    [addToast],
  );

  const cerrarYRecargar = useCallback(() => {
    setVista({ tipo: 'ninguna' });
    setDetalle(null);
    void cargar();
  }, [cargar]);

  const otrosEquipos = equiposDisponibles.filter((e) => e._id !== equipoId);
  const mismoEquipo: EquipoResumen = { _id: equipoId, nombre: equipoNombre || 'Mi equipo', escudo: null };

  /**
   * El chip vive tanto en la barra sticky como en el estado vacío: sin él ahí, elegir una
   * perspectiva sin partidos (o volver a "Mi equipo") no tendría por dónde deshacerse.
   */
  const selectorPerspectiva = (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setPerspectivaAbierta((v) => !v)}
        aria-expanded={perspectivaAbierta}
        className={`flex min-h-[2.75rem] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition [touch-action:manipulation] ${
          perspectiva._id !== equipoId
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        <span aria-hidden>👁</span>
        {perspectiva._id === equipoId ? 'Mi equipo' : perspectiva.nombre}
        <span aria-hidden className={`text-[9px] transition-transform ${perspectivaAbierta ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {perspectivaAbierta && (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => elegirPerspectiva(mismoEquipo)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
              perspectiva._id === equipoId ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-slate-50'
            }`}
          >
            Mi equipo
          </button>
          {otrosEquipos.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Todavía no capturaste datos de otro equipo.</p>
          ) : (
            otrosEquipos.map((e) => (
              <button
                key={e._id}
                type="button"
                onClick={() => elegirPerspectiva(e)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                  perspectiva._id === e._id ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-slate-50'
                }`}
              >
                {e.nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  if (cargando) return <p className="text-sm text-slate-500">Cargando estadísticas…</p>;

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (partidos.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-center">{selectorPerspectiva}</div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {perspectiva._id === equipoId
            ? 'Tu equipo todavía no tiene partidos cargados.'
            : `Todavía no capturaste datos de partidos de ${perspectiva.nombre}.`}
        </div>
        {/* El timeline solo trae partidos donde el equipo jugó — si el único que tenías se
            borró, esta pantalla se queda vacía y el botón de la barra de abajo nunca se monta.
            Sin esto no habría forma de llegar a la planilla que quedó huérfana. */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setVerHuerfanas(true)}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
          >
            ¿Tenías una planilla de un partido que se borró? Buscala acá
          </button>
        </div>
        {verHuerfanas && (
          <ModalPlanillasHuerfanas equipoId={equipoId} onClose={() => setVerHuerfanas(false)} onCambio={cargar} />
        )}
      </div>
    );
  }

  const hayFiltros = filtros.hayFiltros;

  return (
    <div className="space-y-4">
      {/*
        Shell fijo: chips de contexto que despliegan su configuración en el lugar, y las pestañas
        debajo. Los márgenes negativos lo llevan hasta los bordes de la pantalla para que la
        franja fija tape todo el ancho mientras el contenido pasa por debajo; `top-0` lo pega
        arriba, así que cambiar de pestaña o de filtro nunca obliga a volver a subir.
      */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur sm:-mx-6">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            aria-expanded={filtrosAbiertos}
            className={`flex min-h-[2.75rem] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition [touch-action:manipulation] ${
              hayFiltros
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span aria-hidden>⚙</span>
            {filtros.partidosFiltrados.length === partidos.length
              ? `${partidos.length} partidos`
              : `${filtros.partidosFiltrados.length} de ${partidos.length}`}
            <span
              aria-hidden
              className={`text-[9px] transition-transform ${filtrosAbiertos ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>

          {selectorPerspectiva}

          <button
            type="button"
            onClick={() => setScouteando(true)}
            className="min-h-[2.75rem] rounded-full border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition [touch-action:manipulation] hover:bg-slate-100"
          >
            Scoutear partido
          </button>

          <button
            type="button"
            onClick={() => setVerHuerfanas(true)}
            className="min-h-[2.75rem] rounded-full border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition [touch-action:manipulation] hover:bg-slate-100"
          >
            Planillas sin partido
          </button>

          <button
            type="button"
            onClick={agregarSegmento}
            className="ml-auto min-h-[2.75rem] rounded-full border border-brand-300 bg-brand-50 px-3 text-xs font-bold text-brand-700 transition [touch-action:manipulation] hover:bg-brand-100"
          >
            + Segmento
            {segmentos.length > 0 && (
              <span className="ml-1.5 tabular-nums text-brand-500">{segmentos.length}</span>
            )}
          </button>
        </div>

        {filtrosAbiertos && (
          <div className="max-h-[60dvh] overflow-y-auto border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
            <PanelFiltrosPartidos filtros={filtros} />
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto border-t border-slate-200 bg-slate-100/70 px-2 py-1.5">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              aria-current={pestana === p.id ? 'page' : undefined}
              className={`min-h-[2.5rem] flex-1 rounded-md px-2 text-[11px] font-bold uppercase tracking-tight transition-colors [touch-action:manipulation] ${
                pestana === p.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Qué se está mirando, en palabras. En el shell no entra —el chip sólo tiene lugar para
          el conteo— y sin esto un segmento filtrado se confunde con el total del equipo. */}
      <p className="text-xs text-slate-500">{descripcionActual}</p>

      {perspectiva._id !== equipoId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Estás viendo lo que vos capturaste sobre {perspectiva.nombre} — no es su vista oficial
          ni está necesariamente completo.
        </p>
      )}

      {pestana === 'resumen' && (
        <EstadisticasFiltradas filas={filasFiltradas} descripcion={descripcionActual} />
      )}

      {/* Las dos preguntas que se hacen sobre el set como unidad: con quién se juega mejor, y
          bajo qué condiciones se gana. Las dos comen de `setsAnaliticos`, que ya heredó el
          filtrado, así que responden sobre el mismo conjunto que el resumen. */}
      {pestana === 'sinergias' && <SeccionSinergias sets={setsAnaliticos} />}

      {pestana === 'sets' && <SeccionCondicionesSet sets={setsAnaliticos} />}

      {pestana === 'partidos' && (
        <LineaTemporalPartidos
          partidos={filtros.partidosFiltrados}
          onAbrir={(partido) => setVista({ tipo: 'visor', partido })}
        />
      )}

      {pestana === 'mas' && (
        <div className="space-y-6">
          <ComparadorSegmentos
            segmentos={segmentos}
            partidos={partidos}
            filas={filas}
            onQuitar={(id) => setSegmentos((prev) => prev.filter((s) => s.id !== id))}
            onLimpiar={() => setSegmentos([])}
          />

          {/* El pivot come de las mismas filas filtradas, así que responde sobre exactamente el
              mismo conjunto que el resumen. */}
          <AnalisisCruzado
            filas={filasFiltradas}
            onAbrirPartido={(partidoId) => {
              const partido = partidos.find((p) => p._id === partidoId);
              if (partido) setVista({ tipo: 'visor', partido });
            }}
          />
        </div>
      )}

      {vista.tipo === 'visor' && (
        <ModalVisorPartido
          partido={vista.partido}
          equipoId={equipoId}
          onClose={() => setVista({ tipo: 'ninguna' })}
          onEditar={(partido, fuente) => void abrirCaptura(partido, fuente)}
          onCambio={cargar}
        />
      )}

      {vista.tipo === 'planilla' && (
        <ModalPlanillaEquipo
          partidoId={vista.partido._id}
          equipoId={equipoId}
          equipoNombre={equipoNombre}
          partido={detalle}
          onClose={cerrarYRecargar}
          onRefresh={cargar}
        />
      )}

      {vista.tipo === 'captura' && (
        <ModalCapturaSetEstadisticas
          isOpen
          partido={detalle}
          partidoId={vista.partido._id}
          token={token}
          esCompetencia={Boolean(vista.partido.competencia)}
          onClose={cerrarYRecargar}
          onRefresh={cargar}
        />
      )}

      {verHuerfanas && (
        <ModalPlanillasHuerfanas equipoId={equipoId} onClose={() => setVerHuerfanas(false)} onCambio={cargar} />
      )}

      {scouteando && (
        <ModalScoutearPartido
          equipoId={equipoId}
          onClose={() => setScouteando(false)}
          onCreada={async (partidoId) => {
            setScouteando(false);
            try {
              const detalleCreado = await getPartidoDetallado(partidoId);
              setPlanillaScoutAbierta({ partidoId, detalle: detalleCreado });
            } catch {
              setPlanillaScoutAbierta({ partidoId, detalle: null });
            }
          }}
        />
      )}

      {planillaScoutAbierta && (
        <ModalPlanillaEquipo
          partidoId={planillaScoutAbierta.partidoId}
          equipoId={equipoId}
          equipoNombre={equipoNombre}
          partido={planillaScoutAbierta.detalle}
          onClose={() => setPlanillaScoutAbierta(null)}
          onRefresh={cargar}
        />
      )}
    </div>
  );
};

export default SeccionAnalisis;
