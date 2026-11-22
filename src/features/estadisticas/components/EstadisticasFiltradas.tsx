import { useMemo } from 'react';
import type { FilaAnalitica } from '../services/filasService';
import {
  calcularMetricasEquipo,
  calcularMetricasJugadores,
  formatearPorcentaje,
} from '../utils/metricas';
import { DataTable } from 'overtime-kit';

type Props = {
  filas: FilaAnalitica[];
  descripcion: string;
};

/**
 * Las estadísticas de lo que los filtros dejaron a la vista.
 *
 * Antes esta pantalla tenía dos bloques separados —"Oficial · Verificado" arriba y "Mis
 * planillas · Datos propios" abajo, con la aclaración de que no se suman—. Eso era el modelo de
 * datos filtrándose a la interfaz: el DT no piensa en "oficial" contra "mío", piensa en qué pasó
 * en estos partidos. Ahora hay una sola superficie, y qué fuente aporta los números lo decide
 * cada partido (ver `fuentePreferida`). La distinción sigue visible, pero por partido y como
 * etiqueta, no como sección aparte.
 */
const EstadisticasFiltradas = ({ filas, descripcion }: Props) => {
  const equipo = useMemo(() => calcularMetricasEquipo(filas), [filas]);
  const jugadores = useMemo(() => calcularMetricasJugadores(filas), [filas]);

  const fuentes = useMemo(() => {
    const porPartido = new Map<string, FilaAnalitica['fuente']>();
    for (const fila of filas) if (!porPartido.has(fila.partidoId)) porPartido.set(fila.partidoId, fila.fuente);
    let oficial = 0;
    let planilla = 0;
    for (const fuente of porPartido.values()) {
      if (fuente === 'oficial') oficial += 1;
      else if (fuente === 'planilla') planilla += 1;
    }
    return { oficial, planilla };
  }, [filas]);

  const tarjetas = [
    { label: 'Partidos', valor: String(equipo.jugados), pie: `${equipo.ganados}G · ${equipo.perdidos}P · ${equipo.empatados}E` },
    { label: '% victorias', valor: formatearPorcentaje(equipo.porcentajeVictorias), pie: `sobre ${equipo.jugados} jugados` },
    { label: 'Efectividad', valor: formatearPorcentaje(equipo.efectividad, 1), pie: `${equipo.hits} hits / ${equipo.throws} throws` },
    { label: 'Catches', valor: String(equipo.catches), pie: `${equipo.outs} outs recibidos` },
  ];

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-slate-900">Estadísticas</h3>
        <p className="text-xs text-slate-500">{descripcion}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
            <p className="text-xs font-medium text-slate-500">{tarjeta.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{tarjeta.valor}</p>
            <p className="mt-0.5 text-[11px] text-muted">{tarjeta.pie}</p>
          </div>
        ))}
      </div>

      {/* De dónde salen los números que se están sumando. Es la única aclaración que hace falta:
          sustituye al bloque separado de "datos propios". */}
      {(fuentes.oficial > 0 || fuentes.planilla > 0) && (
        <p className="text-xs text-slate-500">
          {fuentes.oficial > 0 && `${fuentes.oficial} ${fuentes.oficial === 1 ? 'partido usa' : 'partidos usan'} datos oficiales`}
          {fuentes.oficial > 0 && fuentes.planilla > 0 && ' · '}
          {fuentes.planilla > 0 && `${fuentes.planilla} ${fuentes.planilla === 1 ? 'usa tu planilla' : 'usan tu planilla'}`}
          {equipo.partidosConDatos < equipo.partidos &&
            ` · ${equipo.partidos - equipo.partidosConDatos} sin estadísticas cargadas`}
        </p>
      )}

      {jugadores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Ninguno de estos partidos tiene estadísticas cargadas todavía.
        </div>
      ) : (
        <>
          {/* En mobile DataTable pasa a una tarjeta por jugador: las ocho columnas necesitan 560px
              y en un teléfono hits y efectividad, que son las que se miran, quedaban fuera. */}
          <DataTable
            caption="Estadísticas por jugador"
            data={jugadores}
            rowKey={(j) => j.jugadorId}
            empty="Ninguno de estos partidos tiene estadísticas cargadas todavía."
            pageSize={0}
            columns={[
              { id: 'jugador', header: 'Jugador', sortValue: (j) => j.jugador, cell: (j) => <span className="text-slate-800">{j.jugador}</span> },
              { id: 'hits', header: 'Hits', align: 'right', sortValue: (j) => j.hits, cell: (j) => <span className="font-semibold text-slate-800">{j.hits}</span> },
              { id: 'efectividad', header: 'Efec.', align: 'right', sortValue: (j) => j.efectividad, cell: (j) => formatearPorcentaje(j.efectividad, 1) },
              { id: 'throws', header: 'Throws', align: 'right', sortValue: (j) => j.throws, cell: (j) => j.throws },
              { id: 'catches', header: 'Catches', align: 'right', sortValue: (j) => j.catches, cell: (j) => j.catches },
              { id: 'supervivencia', header: 'Superv.', align: 'right', sortValue: (j) => j.supervivencia, cell: (j) => formatearPorcentaje(j.supervivencia) },
              { id: 'partidos', header: 'PJ', align: 'right', hideOnMobile: true, sortValue: (j) => j.partidos, cell: (j) => j.partidos },
              { id: 'sets', header: 'Sets', align: 'right', hideOnMobile: true, sortValue: (j) => j.sets, cell: (j) => j.sets },
            ]}
          />
        </>
      )}
    </section>
  );
};

export default EstadisticasFiltradas;
