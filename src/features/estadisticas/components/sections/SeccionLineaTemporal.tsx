import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { getTimelineEquipo, type FuenteDatos, type PartidoTimeline } from '../../services/timelineService';
import { useFiltrosPartidos } from '../../hooks/useFiltrosPartidos';
import PanelFiltrosPartidos from '../PanelFiltrosPartidos';
import LineaTemporalPartidos from '../LineaTemporalPartidos';
import ModalVisorPartido from '../ModalVisorPartido';
import ModalPlanillaEquipo from '../../../partidos/components/modals/ModalPlanillaEquipo';
import ModalCapturaSetEstadisticas from '../../../partidos/components/modals/ModalCapturaSetEstadisticas';
import { getPartidoDetallado, type PartidoDetallado } from '../../../partidos/services/partidoService';

type Props = {
  equipoId: string;
  equipoNombre?: string;
  token: string;
};

/** Qué modal está abierto encima de la línea temporal. */
type Vista =
  | { tipo: 'ninguna' }
  | { tipo: 'visor'; partido: PartidoTimeline }
  | { tipo: 'planilla'; partido: PartidoTimeline }
  | { tipo: 'captura'; partido: PartidoTimeline };

/**
 * Historial de partidos del equipo: filtros facetados + línea temporal + visor.
 *
 * El ciclo que arma es ver → editar → volver a ver. Desde la línea se abre el visor, que es de
 * solo lectura; desde el visor se salta a la captura que corresponda a la fuente que estabas
 * mirando; al cerrar la captura se recarga la línea, porque el estado de datos de ese partido
 * pudo cambiar.
 */
const SeccionLineaTemporal = ({ equipoId, equipoNombre, token }: Props) => {
  const { addToast } = useToast();
  const [partidos, setPartidos] = useState<PartidoTimeline[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: 'ninguna' });
  const [detalle, setDetalle] = useState<PartidoDetallado | null>(null);

  const filtros = useFiltrosPartidos(partidos);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await getTimelineEquipo(equipoId);
      setPartidos(data);
      setError(null);
    } catch (err) {
      setError('No pudimos cargar el historial de partidos.');
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

  /**
   * El modal de captura por sets necesita el partido completo (equipos, competencia), que la
   * línea temporal no trae entero. Se pide recién al abrirlo, no para los 200 de la lista.
   */
  const abrirCaptura = useCallback(
    async (partido: PartidoTimeline, fuente: FuenteDatos) => {
      if (fuente === 'planilla' || !partido.datos.oficial.existe) {
        // Sin datos oficiales, lo que el DT puede cargar por su cuenta es su planilla.
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

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-900">Historial de partidos</h2>
        <p className="text-sm text-slate-500">
          Filtrá por lo que quieras cruzar y mirá partido por partido qué datos hay cargados.
        </p>
      </header>

      {cargando ? (
        <p className="text-sm text-slate-500">Cargando historial…</p>
      ) : error ? (
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
      ) : partidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Tu equipo todavía no tiene partidos cargados.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
          <PanelFiltrosPartidos filtros={filtros} totalPartidos={partidos.length} />
          <LineaTemporalPartidos
            partidos={filtros.partidosFiltrados}
            onAbrir={(partido) => setVista({ tipo: 'visor', partido })}
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
    </section>
  );
};

export default SeccionLineaTemporal;
