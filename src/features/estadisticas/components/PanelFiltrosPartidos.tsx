import { FACETAS, type ResultadoFiltros } from '../hooks/useFiltrosPartidos';

type Props = {
  filtros: ResultadoFiltros;
};

/**
 * Las facetas de filtrado, para desplegar dentro del shell fijo de la pantalla.
 *
 * No dibuja tarjeta ni encabezado propios: el chip "Filtros" del shell ya dice cuántos partidos
 * quedan y es el que abre y cierra este panel. Antes esto era una `<section>` con su propio
 * título y su propio botón de plegado, que vivía en una columna al costado; al pasar la pantalla
 * al patrón de Organizaciones —barra fija con chips que despliegan configuración— ese cromo
 * quedaba duplicado, y dos controles de plegado encimados es peor que ninguno.
 *
 * Cada faceta sigue colapsada en un `<details>` y se despliega sola si tiene algo elegido: son
 * ocho, y abiertas todas juntas en un celular tapan el resultado que uno quiere mirar mientras
 * filtra. En pantallas anchas las facetas fluyen en columnas para que el panel desplegado no
 * empuje el contenido varias pantallas hacia abajo.
 */
const PanelFiltrosPartidos = ({ filtros }: Props) => {
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
  } = filtros;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-600">
          Desde
          <input
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800"
          />
        </label>
      </div>

      {/* `columns` y no `grid`: las facetas tienen alturas muy distintas —una modalidad son dos
          chips, un rival pueden ser veinte— y en grid las filas se alinean a la más alta,
          dejando huecos enormes. En columnas fluyen y se empaquetan solas. */}
      <div className="space-y-2 lg:columns-2 lg:gap-3 lg:space-y-0 xl:columns-3">
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
              className="mb-2 break-inside-avoid rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 lg:mb-3"
            >
              <summary className="flex min-h-[2.25rem] cursor-pointer items-center justify-between gap-2 text-sm font-medium text-slate-700 [touch-action:manipulation]">
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
                    className={`min-h-[2rem] rounded-full border px-2.5 py-1 text-xs font-medium transition [touch-action:manipulation] ${
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

      {hayFiltros && (
        <button
          type="button"
          onClick={limpiarTodo}
          className="min-h-[2.75rem] w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition [touch-action:manipulation] hover:border-slate-300 hover:text-slate-900 sm:w-auto"
        >
          Limpiar todos los filtros
        </button>
      )}
    </div>
  );
};

export default PanelFiltrosPartidos;
