import { FACETAS, type ResultadoFiltros } from '../hooks/useFiltrosPartidos';

type Props = {
  filtros: ResultadoFiltros;
  totalPartidos: number;
};

/**
 * Panel de filtros facetados de la línea temporal.
 *
 * Cada faceta va colapsada en un `<details>`: son ocho, y desplegadas todas juntas en un
 * celular tapan el resultado, que es lo que uno quiere mirar mientras filtra. Se despliegan
 * solas las que tienen algo elegido.
 */
const PanelFiltrosPartidos = ({ filtros, totalPartidos }: Props) => {
  const {
    opciones,
    desde,
    hasta,
    setDesde,
    setHasta,
    alternar,
    limpiarFaceta,
    limpiarTodo,
    hayFiltros,
    partidosFiltrados,
  } = filtros;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Filtros</h3>
          <p className="text-xs text-slate-500">
            {partidosFiltrados.length === totalPartidos
              ? `${totalPartidos} partidos`
              : `${partidosFiltrados.length} de ${totalPartidos} partidos`}
          </p>
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarTodo}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Limpiar todo
          </button>
        )}
      </header>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          Desde
          <input
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
        </label>
      </div>

      <div className="space-y-2">
        {FACETAS.map(({ clave, label }) => {
          const lista = opciones[clave];
          const elegidas = lista.filter((o) => o.seleccionada).length;

          // Una faceta con un solo valor posible no filtra nada: sólo ocupa lugar. Se muestra
          // igual si hay algo elegido, para que se pueda deshacer.
          if (lista.length < 2 && elegidas === 0) return null;

          return (
            <details
              key={clave}
              open={elegidas > 0}
              className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium text-slate-700">
                <span>{label}</span>
                {elegidas > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {elegidas}
                  </span>
                )}
              </summary>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {lista.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    onClick={() => alternar(clave, opcion.valor)}
                    aria-pressed={opcion.seleccionada}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition [touch-action:manipulation] ${
                      opcion.seleccionada
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {opcion.label}
                    <span
                      className={`ml-1.5 tabular-nums ${
                        opcion.seleccionada ? 'text-brand-100' : 'text-slate-400'
                      }`}
                    >
                      {opcion.cantidad}
                    </span>
                  </button>
                ))}
              </div>

              {elegidas > 0 && (
                <button
                  type="button"
                  onClick={() => limpiarFaceta(clave)}
                  className="mt-2 text-xs font-medium text-slate-500 underline hover:text-slate-700"
                >
                  Quitar filtro de {label.toLowerCase()}
                </button>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
};

export default PanelFiltrosPartidos;
