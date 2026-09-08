import { useEquipo } from '../../../app/providers/EquipoContext';
import SeccionCompetencias from '../components/SeccionCompetencias';

/**
 * Competencias, de vuelta como destino propio.
 *
 * Estuvo un rato degradada a pestaña de Partidos, con el argumento de que era casi sólo lectura.
 * El argumento describía la pantalla de entonces, no lo que la sección tiene que ser: acá vive el
 * ciclo de un torneo —dónde estamos en la tabla, quién está habilitado, cómo nos fue—, y eso es
 * gestión, no consulta. Una competencia es el contenedor de casi todo lo demás.
 */
const CompetenciasPage = () => {
  const { equipoSeleccionado } = useEquipo();

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Elegí un equipo para ver sus competencias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Competencias</h1>
        <p className="text-sm text-slate-500">
          En qué torneos juega el equipo, cómo va en cada uno y quién está habilitado.
        </p>
      </header>

      <SeccionCompetencias />
    </div>
  );
};

export default CompetenciasPage;
