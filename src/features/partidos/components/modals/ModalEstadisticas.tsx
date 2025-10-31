import { useState, useEffect, useCallback, useMemo, type FC } from 'react';
import EncabezadoEstadisticas from './EncabezadoEstadisticas';
import EquiposEstadisticas from './EquipoEstadisticas';
import { SetManager } from '../sections/SetManager';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import type { PartidoDetallado, SetPartido } from '../../services/partidoService';
import { useModalSetEstadisticas, type JugadorSet } from '../../hooks/useModalSetEstadisticas';
import type { EstadisticaJugadorEntrada } from './ListaJugadores';

type ModalEstadisticasProps = {
  partido?: PartidoDetallado | null;
  partidoId: string;
  token: string;
  onClose: () => void;
  actualizarSetsLocales: (sets: SetPartido[]) => void;
  agregarSetAPartido: (partidoId: string, data: { numeroSet: number; ganadorSet: string; estadoSet: string }) => Promise<SetPartido | null | undefined>;
  actualizarSetDePartido: (numeroSet: number, cambios: Partial<SetPartido>) => Promise<SetPartido | null | undefined>;
  refrescarPartidoSeleccionado: () => Promise<void> | void;
  eliminarSetDePartido: (numeroSet: number, setId?: string) => Promise<boolean>;
  numeroSetInicial?: number | null;
};

const ESTADISTICAS_INICIALES = {
  throws: 0,
  hits: 0,
  outs: 0,
  catches: 0,
};

type EquipoResumen = {
  _id: string;
  nombre: string;
};

const crearEquipoResumen = (equipo: PartidoDetallado['equipoLocal'], etiqueta: string): EquipoResumen => {
  if (!equipo) {
    return { _id: 'sin-equipo', nombre: etiqueta };
  }

  if (typeof equipo === 'string') {
    return { _id: equipo, nombre: etiqueta };
  }

  return {
    _id: equipo._id ?? 'sin-equipo',
    nombre: equipo.nombre ?? etiqueta,
  };
};

const mapearAEntrada = (jugadores: JugadorSet[]): EstadisticaJugadorEntrada[] =>
  jugadores.map((jugador) => ({
    jugadorId: jugador.jugadorPartidoId ?? jugador.jugadorId,
    estadisticas: {
      ...ESTADISTICAS_INICIALES,
      ...jugador.estadisticas,
    },
  }));

const ModalEstadisticas: FC<ModalEstadisticasProps> = ({
  partido,
  partidoId,
  token,
  onClose,
  actualizarSetsLocales,
  agregarSetAPartido,
  actualizarSetDePartido,
  refrescarPartidoSeleccionado,
  eliminarSetDePartido,
  numeroSetInicial = null,
}) => {
  const [partidoLocal, setPartidoLocal] = useState<PartidoDetallado | null | undefined>(partido);
  const [numeroSetSeleccionado, setNumeroSetSeleccionado] = useState<string>(
    numeroSetInicial ? String(numeroSetInicial) : '',
  );
  const [uiStatsOverride, setUiStatsOverride] = useState<{ local: JugadorSet[]; visitante: JugadorSet[] } | null>(null);

  const setsLocales = useMemo(() => partidoLocal?.sets ?? [], [partidoLocal?.sets]);
  const estadisticasSet = setsLocales.find((s) => s.numeroSet.toString() === numeroSetSeleccionado);

  const actualizarSetSeleccionado = useCallback(
    (cambios: Partial<SetPartido>) => {
      if (!estadisticasSet) return;
      setPartidoLocal((prev) => {
        if (!prev || !prev.sets) return prev;
        const nuevosSets = prev.sets.map((s) =>
          s.numeroSet === estadisticasSet.numeroSet ? { ...s, ...cambios } : s,
        );
        return { ...prev, sets: nuevosSets };
      });
    },
    [estadisticasSet],
  );

  const {
    serviciosCargados,
    equiposDelSet,
    guardar,
    guardando,
    asignarJugador,
    cambiarEstadistica,
    copiarJugadoresDeSetAnterior,
    mostrarConfirmacionManual,
    confirmarRecalculo,
    cancelarRecalculo,
  } = useModalSetEstadisticas({
    partidoId,
    numeroSetSeleccionado,
    estadisticasSet,
    setsLocales,
    actualizarSetDePartido,
    actualizarSetSeleccionado,
    refrescarPartidoSeleccionado,
  });

  useEffect(() => {
    setPartidoLocal(partido);
  }, [partido]);

  useEffect(() => {
    if (numeroSetInicial) {
      setNumeroSetSeleccionado(String(numeroSetInicial));
    }
  }, [numeroSetInicial]);

  useEffect(() => {
    if (!setsLocales.length || numeroSetSeleccionado) {
      return;
    }

    const ultimoSet = setsLocales.reduce((max, set) =>
      set.numeroSet > max.numeroSet ? set : max
    , setsLocales[0]);
    setNumeroSetSeleccionado(ultimoSet.numeroSet.toString());
  }, [setsLocales, numeroSetSeleccionado]);

  useEffect(() => {
    const setsActuales = partidoLocal?.sets;
    if (!setsActuales) return;
    actualizarSetsLocales(setsActuales);
  }, [partidoLocal?.sets, actualizarSetsLocales]);

  useEffect(() => {
    setUiStatsOverride(null);
  }, [numeroSetSeleccionado]);

  const handleAgregarSet = async () => {
    // Calcular el siguiente número de set disponible
    const numerosExistentes = setsLocales.map(s => s.numeroSet).sort((a, b) => a - b);
    let numero = 1;

    // Encontrar el primer número disponible
    for (let i = 0; i < numerosExistentes.length; i++) {
      if (numerosExistentes[i] === numero) {
        numero++;
      } else {
        break;
      }
    }

    console.log('Creando set con número:', numero);
    console.log('Sets existentes:', numerosExistentes);

    const setData = {
      numeroSet: numero,
      ganadorSet: 'pendiente',
      estadoSet: 'en_juego'
    };

    try {
      const creado = await agregarSetAPartido(partidoId, setData);
      if (creado?.numeroSet) {
        setPartidoLocal(prev => {
          if (!prev) return prev;
          const setsPrevios = prev.sets ?? [];
          return { ...prev, sets: [...setsPrevios, creado] };
        });
        setNumeroSetSeleccionado(creado.numeroSet.toString());
        setUiStatsOverride(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error agregando set:', error);
      alert('Error al crear el set: ' + message);
    }
  };

  const eliminarSet = async () => {
    if (!numeroSetSeleccionado) return alert('Seleccione un set para eliminar');

    const ultimoNumeroSet = Math.max(...setsLocales.map(s => s.numeroSet));

    if (Number(numeroSetSeleccionado) !== ultimoNumeroSet) {
      return alert('Solo se puede eliminar el último set.');
    }

    const confirm = window.confirm(`¿Seguro que querés eliminar el Set ${numeroSetSeleccionado}? Esta acción no se puede deshacer.`);
    if (!confirm) return;

    try {
      const exito = await eliminarSetDePartido(
        Number(numeroSetSeleccionado),
        estadisticasSet?._id
      );
      if (exito) {
        const nuevosSets = (partidoLocal?.sets ?? []).filter(s => s.numeroSet !== Number(numeroSetSeleccionado));
        setPartidoLocal(prev => (prev ? { ...prev, sets: nuevosSets } : prev));
        actualizarSetsLocales(nuevosSets);
        setNumeroSetSeleccionado('');
        alert(`Set ${numeroSetSeleccionado} eliminado correctamente`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error eliminando el set');
      console.error(error);
      console.error(message);
    }
  };

  const setGanadorSetLocal = (ganador: SetPartido['ganadorSet']) => {
    actualizarSetSeleccionado({ ganadorSet: ganador });
  };

  const obtenerEstadisticasEquipo = useCallback((equipoId?: string): JugadorSet[] => {
    if (!equipoId) return [];
    return (equiposDelSet[equipoId] ?? []).map((jugador) => ({
      jugadorId: jugador.jugadorId,
      jugadorPartidoId: jugador.jugadorPartidoId,
      equipoId: jugador.equipoId ?? equipoId,
      estadisticas: {
        ...ESTADISTICAS_INICIALES,
        ...jugador.estadisticas,
      },
    }));
  }, [equiposDelSet]);

  const handleCopiarJugadores = () => {
    copiarJugadoresDeSetAnterior();
    setUiStatsOverride(null);
  };

  if (!partidoLocal) {
    return (
      <ModalBase onClose={onClose} bodyClassName="p-0">
        <div className="p-6 text-center text-gray-600">Cargando partido...</div>
      </ModalBase>
    );
  }

  if (!serviciosCargados) {
    return (
      <ModalBase onClose={onClose} bodyClassName="p-0">
        <div className="p-6 text-center text-gray-600">Cargando servicios...</div>
      </ModalBase>
    );
  }

  const equipoLocalResumen = crearEquipoResumen(partidoLocal.equipoLocal, 'Equipo Local');
  const equipoVisitanteResumen = crearEquipoResumen(partidoLocal.equipoVisitante, 'Equipo Visitante');

  const localStatsBase = obtenerEstadisticasEquipo(equipoLocalResumen._id);
  const visitanteStatsBase = obtenerEstadisticasEquipo(equipoVisitanteResumen._id);

  const localStatsUI = uiStatsOverride ? mapearAEntrada(uiStatsOverride.local) : mapearAEntrada(localStatsBase);
  const visitanteStatsUI = uiStatsOverride ? mapearAEntrada(uiStatsOverride.visitante) : mapearAEntrada(visitanteStatsBase);

  return (
    <ModalBase onClose={onClose} bodyClassName="p-0">
      <EncabezadoEstadisticas onClose={onClose} />

      <div className="space-y-4 px-1 pb-4">
        <SetManager
          setsLocales={setsLocales}
          numeroSetSeleccionado={numeroSetSeleccionado}
          setNumeroSetSeleccionado={setNumeroSetSeleccionado}
          estadisticasSet={estadisticasSet}
          onAgregarSet={handleAgregarSet}
          onEliminarSet={eliminarSet}
          eliminando={false}
          setGanadorSet={setGanadorSetLocal}
          guardar={() => { void guardar(); }}
        />

        {!numeroSetSeleccionado && (
          <p className="italic text-gray-500 text-center py-4 bg-gray-100 rounded-md">
            Seleccione un set para empezar la carga de estadísticas, o añada uno nuevo.
          </p>
        )}

        {numeroSetSeleccionado && setsLocales.length > 1 && (
          <button
            onClick={handleCopiarJugadores}
            className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors duration-200 ml-2"
          >
            Copiar jugadores del set anterior
          </button>
        )}

        {numeroSetSeleccionado && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setUiStatsOverride({ local: [], visitante: [] })}
              className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
              title="Limpiar selecciones y estadísticas de la UI (no guarda)"
            >
              Limpiar inputs
            </button>
          </div>
        )}

        {estadisticasSet && (
          <>
            {(() => {
              return (
                <EquiposEstadisticas
                  equipoLocal={equipoLocalResumen}
                  equipoVisitante={equipoVisitanteResumen}
                  estadisticas={{ local: localStatsUI, visitante: visitanteStatsUI }}
                  onCambiarEstadistica={cambiarEstadistica}
                  onAsignarJugador={(equipo, index, jugadorId) => {
                    const equipoId = equipo === 'local' ? equipoLocalResumen._id : equipoVisitanteResumen._id;
                    asignarJugador(index, jugadorId, equipoId);
                  }}
                  token={token}
                />
              );
            })()}

            <button
              onClick={guardar}
              disabled={guardando}
              className={`
                mt-6 w-full py-2 px-4 rounded-lg font-semibold transition-colors duration-200
                bg-green-600 text-white hover:bg-green-700
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
              `}
            >
              {guardando ? 'Guardando...' : 'Guardar Estadísticas del Set'}
            </button>
          </>
        )}

        {/* Modal de confirmación para estadísticas manuales */}
        {mostrarConfirmacionManual && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">Advertencia: Estadísticas Manuales Detectadas</h3>
              <p className="text-gray-600 mb-4">
                Se encontraron estadísticas manuales para este partido. Guardar estadísticas automáticas
                recalculará todas las estadísticas agregadas del partido.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmarRecalculo}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                >
                  Continuar y Recalcular
                </button>
                <button
                  onClick={cancelarRecalculo}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
export default ModalEstadisticas;
