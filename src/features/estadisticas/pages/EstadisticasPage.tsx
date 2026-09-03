import { useEquipo } from '../../../app/providers/EquipoContext';
import { useToken } from '../../../app/providers/AuthContext';
import SeccionAnalisis from '../components/sections/SeccionAnalisis';

/**
 * Estadísticas del equipo.
 *
 * Antes esta pantalla tenía dos superficies separadas: arriba un bloque "Oficial · Verificado"
 * con los totales de la competencia, y abajo otro de "Mis planillas · Datos propios" con la
 * aclaración de que no se suman a los de arriba. Eso era el modelo de datos filtrándose a la
 * interfaz — el DT no piensa en "oficial" contra "mío", piensa en qué pasó en estos partidos.
 *
 * Ahora hay una sola superficie. Qué fuente aporta los números lo decide cada partido
 * (`PlanillaEquipo.fuentePreferida`, elegible desde el visor), y los filtros no sólo listan
 * partidos: deciden qué se agrega. La distinción entre dato oficial y captura propia sigue
 * visible, pero por partido y como etiqueta, nunca como sección aparte.
 */
const EstadisticasPage = () => {
  const { equipoSeleccionado } = useEquipo();
  const token = useToken();

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Seleccioná un equipo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Elegí un equipo para ver su rendimiento histórico.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Estadísticas</h1>
        <p className="text-sm text-slate-500">
          Filtrá lo que querés analizar. Todo lo de abajo se recalcula con esos filtros.
        </p>
      </header>

      <SeccionAnalisis
        equipoId={equipoSeleccionado.id}
        equipoNombre={equipoSeleccionado.nombre}
        token={token ?? ''}
      />
    </div>
  );
};

export default EstadisticasPage;
