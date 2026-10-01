import { useMemo, useState } from 'react';
import { descargarCsv, nombreArchivoCsv } from '../../../shared/utils/csv';
import { calcularMetricasJugadores } from '../utils/metricas';
import {
  csvDeComparacionSegmentos,
  csvDeFilas,
  csvDeMetricasPorJugador,
  type SegmentoExportable,
} from '../utils/exportaciones';
import type { FilaAnalitica } from '../services/filasService';
import type { PartidoTimeline } from '../services/timelineService';

type Props = {
  /** Las filas que los filtros dejaron a la vista. Es exactamente lo que se exporta. */
  filasFiltradas: FilaAnalitica[];
  /** Todos los partidos y todas las filas: los necesita la comparación, que reaplica cada segmento. */
  partidos: PartidoTimeline[];
  filas: FilaAnalitica[];
  segmentos: SegmentoExportable[];
  /** Descripción en palabras del recorte actual, para el nombre del archivo. */
  descripcion: string;
};

/**
 * Descarga de los datos del análisis en CSV.
 *
 * Exporta **el recorte que está a la vista**, no todo el historial, y el nombre del archivo lleva
 * de qué recorte salió. La diferencia no es cosmética: un botón que baja un dump convierte al
 * Excel en la herramienta de análisis y a la plataforma en un depósito de datos. Exportando el
 * recorte, el archivo es la salida de un análisis que se hizo acá y se puede volver a reproducir.
 *
 * Las tres opciones son las tres preguntas que la pantalla ya responde: el dato crudo para armar
 * una tabla dinámica, los totales por jugador, y la comparación entre segmentos.
 */
const ExportarDatos = ({ filasFiltradas, partidos, filas, segmentos, descripcion }: Props) => {
  const [abierto, setAbierto] = useState(false);

  const cantidadJugadores = useMemo(
    () => calcularMetricasJugadores(filasFiltradas).length,
    [filasFiltradas],
  );

  const hayDatos = filasFiltradas.length > 0;

  const bajar = (base: string, contenido: string) => {
    descargarCsv(nombreArchivoCsv(base, descripcion), contenido);
    setAbierto(false);
  };

  const opciones: Array<{ clave: string; titulo: string; detalle: string; onClick: () => void }> = [
    {
      clave: 'filas',
      titulo: 'Datos crudos',
      detalle: `${filasFiltradas.length} ${filasFiltradas.length === 1 ? 'fila' : 'filas'} · una por jugador y set`,
      onClick: () => bajar('filas', csvDeFilas(filasFiltradas)),
    },
    {
      clave: 'jugadores',
      titulo: 'Totales por jugador',
      detalle: `${cantidadJugadores} ${cantidadJugadores === 1 ? 'jugador' : 'jugadores'} · ya agregado`,
      onClick: () => bajar('jugadores', csvDeMetricasPorJugador(filasFiltradas)),
    },
  ];

  if (segmentos.length > 0) {
    opciones.push({
      clave: 'segmentos',
      titulo: 'Comparación de segmentos',
      detalle: `${segmentos.length} ${segmentos.length === 1 ? 'segmento' : 'segmentos'} · una columna cada uno`,
      onClick: () =>
        bajar('comparacion', csvDeComparacionSegmentos(segmentos, partidos, filas)),
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        disabled={!hayDatos}
        title={hayDatos ? undefined : 'No hay datos en este recorte para exportar'}
        className="flex min-h-[2.75rem] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition [touch-action:manipulation] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden>↓</span>
        Exportar
        <span aria-hidden className={`text-[9px] transition-transform ${abierto ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {abierto && hayDatos && (
        <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">
            Se exporta lo que tenés filtrado
          </p>
          {opciones.map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              onClick={opcion.onClick}
              className="w-full rounded-md px-2 py-2 text-left transition hover:bg-slate-50"
            >
              <span className="block text-xs font-semibold text-slate-800">{opcion.titulo}</span>
              <span className="block text-[11px] text-slate-500">{opcion.detalle}</span>
            </button>
          ))}
          <p className="border-t border-slate-100 px-2 pb-1 pt-1.5 text-[10px] leading-snug text-slate-400">
            CSV para Excel o Sheets, con punto y coma como separador.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExportarDatos;
