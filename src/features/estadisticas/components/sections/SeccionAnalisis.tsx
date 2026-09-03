import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { getTimelineEquipo, type FuenteDatos, type PartidoTimeline } from '../../services/timelineService';
import { getFilasAnaliticas, type FilaAnalitica } from '../../services/filasService';
import { clonarFiltros, describirFiltros, useFiltrosPartidos } from '../../hooks/useFiltrosPartidos';
import PanelFiltrosPartidos from '../PanelFiltrosPartidos';
import LineaTemporalPartidos from '../LineaTemporalPartidos';
import EstadisticasFiltradas from '../EstadisticasFiltradas';
import ComparadorSegmentos, { type Segmento } from '../ComparadorSegmentos';
import AnalisisCruzado from './AnalisisCruzado';
import ModalVisorPartido from '../ModalVisorPartido';
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

/**
 * La pantalla de análisis del DT: filtros facetados, estadísticas de lo filtrado, comparación
 * entre segmentos y la línea temporal de partidos.
 *
 * El orden no es casual. Los filtros están arriba porque son la pregunta; las estadísticas
 * inmediatamente debajo porque son la respuesta; la línea temporal va al final y arrancada
 * colapsada, porque es el detalle al que se baja cuando algo llama la atención.
 *
 * Los dos datasets se piden una sola vez: `timeline` (un registro por partido, para filtrar y
 * listar) y `filas` (un registro por jugador y por set, para las métricas). Los filtros operan
 * sobre los partidos y las filas heredan la decisión por `partidoId` — así "lo que ves" y "lo
 * que se suma" no pueden separarse.
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
  const [lineaVisible, setLineaVisible] = useState(false);

  const filtros = useFiltrosPartidos(partidos);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [timeline, analiticas] = await Promise.all([
        getTimelineEquipo(equipoId),
        getFilasAnaliticas(equipoId),
      ]);
      setPartidos(timeline);
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
  }, [equipoId, addToast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Las filas heredan el filtrado de los partidos: filtrar es analizar, no sólo listar.
  const filasFiltradas = useMemo(() => {
    const ids = new Set(filtros.partidosFiltrados.map((p) => p._id));
    return filas.filter((fila) => ids.has(fila.partidoId));
  }, [filas, filtros.partidosFiltrados]);

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

  const abrirCaptura = useCallback(
    async (partido: PartidoTimeline, fuente: FuenteDatos) => {
      if (fuente === 'planilla' || !partido.datos.oficial.existe) {
        setVista({ tipo: 'planilla', partido });
        return;
      }
      try {
        setDetalle(await getPartidoDetallado(partido._id));
        setVista({ tipo: 'captura', partido });
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
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Tu equipo todavía no tiene partidos cargados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <PanelFiltrosPartidos filtros={filtros} totalPartidos={partidos.length} />
          <button
            type="button"
            onClick={agregarSegmento}
            className="w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            + Guardar como segmento para comparar
          </button>
        </div>

        <div className="space-y-6">
          <EstadisticasFiltradas filas={filasFiltradas} descripcion={descripcionActual} />

          <ComparadorSegmentos
            segmentos={segmentos}
            partidos={partidos}
            filas={filas}
            onQuitar={(id) => setSegmentos((prev) => prev.filter((s) => s.id !== id))}
            onLimpiar={() => setSegmentos([])}
          />

          {/* El pivot ahora come de las mismas filas filtradas, así que responde sobre
              exactamente el mismo conjunto que las tarjetas de arriba. */}
          <AnalisisCruzado
            filas={filasFiltradas}
            onAbrirPartido={(partidoId) => {
              const partido = partidos.find((p) => p._id === partidoId);
              if (partido) setVista({ tipo: 'visor', partido });
            }}
          />

          <section>
            {/* La línea arranca cerrada: es el detalle, no el titular. Abrirla es una decisión. */}
            <button
              type="button"
              onClick={() => setLineaVisible((v) => !v)}
              aria-expanded={lineaVisible}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-slate-300"
            >
              <span className="text-sm font-semibold text-slate-900">
                Partido por partido
                <span className="ml-2 font-normal text-slate-500">
                  {filtros.partidosFiltrados.length}
                </span>
              </span>
              <span aria-hidden className="text-slate-400">
                {lineaVisible ? '▲' : '▼'}
              </span>
            </button>

            {lineaVisible && (
              <div className="mt-3">
                <LineaTemporalPartidos
                  partidos={filtros.partidosFiltrados}
                  onAbrir={(partido) => setVista({ tipo: 'visor', partido })}
                />
              </div>
            )}
          </section>
        </div>
      </div>

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
    </div>
  );
};

export default SeccionAnalisis;
