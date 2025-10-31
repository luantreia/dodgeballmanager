import React, { useEffect } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { useJugadoresSeleccion } from '../../hooks/useJugadoresSeleccion';
import { useAsignacionJugadores } from '../../hooks/useAsignacionJugadores';
import { useEstadisticasModal } from '../../hooks/useEstadisticasModal';
import { extractEquipoId } from '../../services/partidoService';
import ModalHeader from './ModalHeader';
import AutocompletadoInfo from './AutocompletadoInfo';
import AsignacionJugadores from '../sections/AsignacionJugadores';
import CapturaEstadisticas from './CapturaEstadisticas';
import type { PartidoDetallado } from '../../services/partidoService';
import type { EstadisticaManualJugador } from '../../../estadisticas/services/estadisticasService';
import type { EstadisticaManualBackend, EstadisticaCampoEditable } from '../../hooks/useEstadisticasModal';

type JugadorAsignado = {
  _id: string;
  jugador: { _id?: string; nombre?: string } | string;
  equipo: string | { _id: string };
};

interface ModalEstadisticasGeneralesCapturaProps {
  partido: PartidoDetallado | null;
  partidoId: string;
  token: string;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  datosIniciales?: EstadisticaManualJugador[];
  hayDatosAutomaticos?: boolean;
}

const obtenerEquipoId = (equipo: JugadorAsignado['equipo']): string | undefined => {
  if (!equipo) return undefined;
  return typeof equipo === 'string' ? equipo : equipo._id;
};

const ModalEstadisticasGeneralesCaptura: React.FC<ModalEstadisticasGeneralesCapturaProps> = ({
  partido,
  partidoId,
  token,
  onClose,
  onRefresh,
  datosIniciales = [],
  hayDatosAutomaticos = false,
}) => {
  // Hook principal para lógica de estadísticas
  const estadisticasState = useEstadisticasModal(partidoId, token);
  const { cargarJugadoresYEstadisticas } = estadisticasState;

  // Hook para lógica de selección de jugadores
  const {
    getJugadoresPorEquipo,
    cambiarSeleccionJugador: cambiarSeleccionBase
  } = useJugadoresSeleccion(
    estadisticasState.jugadores,
    estadisticasState.seleccionesLocal,
    estadisticasState.seleccionesVisitante
  );

  // Función para cambiar selección de jugador con actualización de estado
  const cambiarSeleccionJugador = (equipo: 'local' | 'visitante', posicion: number, jugadorPartidoId: string) => {
    cambiarSeleccionBase(equipo, posicion, jugadorPartidoId);
    if (equipo === 'local') {
      estadisticasState.setSeleccionesLocal(prev => {
        const nuevas = [...prev];
        nuevas[posicion] = jugadorPartidoId;
        return nuevas;
      });
    } else {
      estadisticasState.setSeleccionesVisitante(prev => {
        const nuevas = [...prev];
        nuevas[posicion] = jugadorPartidoId;
        return nuevas;
      });
    }
  };

  // Hook para lógica de asignación de jugadores
  const jugadoresAsignados: JugadorAsignado[] = Array.isArray(estadisticasState.jugadores)
    ? (estadisticasState.jugadores as JugadorAsignado[])
    : [];

  const jugadoresLocal = jugadoresAsignados.filter((jugador) =>
    obtenerEquipoId(jugador.equipo) === extractEquipoId(partido?.equipoLocal),
  );
  const jugadoresVisitante = jugadoresAsignados.filter((jugador) =>
    obtenerEquipoId(jugador.equipo) === extractEquipoId(partido?.equipoVisitante),
  );

  const {
    toggleJugadorLocal,
    toggleJugadorVisitante,
    asignarJugadores,
    hayJugadoresAsignados,
  } = useAsignacionJugadores(
    estadisticasState.mostrarAsignacion,
    jugadoresAsignados,
    partido ?? null,
    estadisticasState.jugadoresSeleccionadosLocal as Set<string>,
    estadisticasState.jugadoresSeleccionadosVisitante as Set<string>,
    estadisticasState.setJugadoresSeleccionadosLocal,
    estadisticasState.setJugadoresSeleccionadosVisitante,
    estadisticasState.setAsignandoJugadores,
    () => cargarJugadoresYEstadisticas(
      partido,
      normalizarDatosIniciales(datosIniciales),
      hayDatosAutomaticos,
    ),
  );

  // Hooks para obtener listas de jugadores por equipo
  const loadingLocal = estadisticasState.loading;
  const loadingVisitante = estadisticasState.loading;

  // Efecto para cargar datos iniciales
  useEffect(() => {
    cargarJugadoresYEstadisticas(
      partido,
      normalizarDatosIniciales(datosIniciales),
      hayDatosAutomaticos,
    );
  }, [cargarJugadoresYEstadisticas, partido, datosIniciales, hayDatosAutomaticos]);

  // Función para guardar y cerrar
  const guardarYCerrar = async () => {
    if (!partido) return;
    const success = await estadisticasState.guardarEstadisticas(partido);
    if (success) {
      if (typeof onRefresh === 'function') {
        await Promise.resolve(onRefresh());
      }
      onClose();
    }
  };

  if (estadisticasState.loading) {
    return (
      <ModalBase onClose={onClose}>
        <div className="text-center py-8">
          <p className="text-gray-600">Cargando jugadores y estadísticas...</p>
        </div>
      </ModalBase>
    );
  }

  return (
    <ModalBase onClose={onClose}>
      <div className="space-y-6">
        <ModalHeader
          tipoAutocompletado={estadisticasState.tipoAutocompletado}
          datosIniciales={datosIniciales}
        />

        <AutocompletadoInfo
          tipoAutocompletado={estadisticasState.tipoAutocompletado}
          datosIniciales={datosIniciales}
        />

        {estadisticasState.mostrarAsignacion ? (
          <AsignacionJugadores
            partido={partido}
            jugadoresLocal={jugadoresLocal}
            jugadoresVisitante={jugadoresVisitante}
            loadingLocal={loadingLocal}
            loadingVisitante={loadingVisitante}
            jugadoresSeleccionadosLocal={estadisticasState.jugadoresSeleccionadosLocal}
            jugadoresSeleccionadosVisitante={estadisticasState.jugadoresSeleccionadosVisitante}
            toggleJugadorLocal={toggleJugadorLocal}
            toggleJugadorVisitante={toggleJugadorVisitante}
            asignarJugadores={asignarJugadores}
            asignandoJugadores={estadisticasState.asignandoJugadores}
            hayJugadoresAsignados={hayJugadoresAsignados}
            onClose={onClose}
          />
        ) : (
          <CapturaEstadisticas
            partido={partido}
            seleccionesLocal={estadisticasState.seleccionesLocal}
            seleccionesVisitante={estadisticasState.seleccionesVisitante}
            estadisticas={estadisticasState.estadisticas}
            getJugadoresPorEquipo={getJugadoresPorEquipo}
            cambiarSeleccionJugador={cambiarSeleccionJugador}
            cambiarEstadistica={estadisticasState.cambiarEstadistica as (
              jugadorPartidoId: string,
              campo: EstadisticaCampoEditable,
              valor: number,
            ) => void}
            setMostrarAsignacion={estadisticasState.setMostrarAsignacion}
            guardar={guardarYCerrar}
            guardando={estadisticasState.guardando}
            hayDatosAutomaticos={estadisticasState.tipoAutocompletado === 'automatico'}
          />
        )}
      </div>
    </ModalBase>
  );
};

export default ModalEstadisticasGeneralesCaptura;

const normalizarDatosIniciales = (
  datosIniciales: EstadisticaManualJugador[] = [],
): EstadisticaManualBackend[] => {
  return datosIniciales.reduce<EstadisticaManualBackend[]>((acumulado, dato) => {
    const jugadorPartido = dato.jugadorPartido;
    const jugadorPartidoId =
      typeof jugadorPartido === 'string' ? jugadorPartido : jugadorPartido?._id;

    if (!jugadorPartidoId) {
      return acumulado;
    }

    const equipoNormalizado = (() => {
      if (typeof jugadorPartido === 'string') {
        return undefined;
      }

      const equipo = jugadorPartido?.equipo;
      if (typeof equipo === 'string') {
        return equipo;
      }

      if (equipo && typeof equipo === 'object' && equipo._id) {
        return { _id: equipo._id };
      }

      return undefined;
    })();

    acumulado.push({
      _id: dato._id,
      jugadorPartido: {
        _id: jugadorPartidoId,
        equipo: equipoNormalizado,
      },
      throws: dato.throws,
      hits: dato.hits,
      outs: dato.outs,
      catches: dato.catches,
      tipoCaptura: dato.tipoCaptura as EstadisticaManualBackend['tipoCaptura'],
    });

    return acumulado;
  }, []);
};
