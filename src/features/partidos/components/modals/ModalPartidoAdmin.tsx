import { useEffect, useState, useCallback } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { InformacionPartidoSection } from '../sections/InformacionPartidoSection';
import { ConfiguracionAvanzadaSection } from '../sections/ConfiguracionAvanzadaSection';
import { SeccionEstadisticasGenerales } from '../sections/SeccionEstadisticasGenerales';
import { SeccionEstadisticasSetASet } from '../sections/SeccionEstadisticasSetASet';
import { SeccionEstadisticasDirectas } from '../sections/SeccionEstadisticasDirectas';
import ModalEstadisticas from './ModalEstadisticas';
import ModalEstadisticasGeneralesCaptura from './ModalEstadisticasGeneralesCaptura';
import {
  getPartidoDetallado,
  obtenerSetsDePartido,
  editarPartido,
  eliminarPartido,
  recalcularMarcadorPartido,
  actualizarModoVisualizacionPartido,
  crearSetPartido,
  actualizarSetPartido,
  eliminarSetPartido,
  type PartidoDetallado,
  type SetPartido,
} from '../../services/partidoService';
import type { EstadisticaManualBackend } from '../../hooks/useEstadisticasModal';

import type { Competencia } from '../../../../types';
import { getParticipaciones as getCompetencias } from '../../../competencias/services/equipoCompetenciaService';

type ModalPartidoAdminProps = {
  partidoId: string;
  token: string;
  onClose: () => void;
  onPartidoEliminado: (partidoId: string) => void;
};

type DatosEdicionState = {
  fecha: string;
  ubicacion: string;
  estado: string;
  nombrePartido: string;
  marcadorLocal: number;
  marcadorVisitante: number;
  marcadorModificadoManualmente: boolean;
  modalidad: string;
  categoria: string;
  competencia: string;
};

type VistaEstadisticas = 'generales' | 'setASet' | 'directas';

export const ModalPartidoAdmin = ({ partidoId, token, onClose, onPartidoEliminado }: ModalPartidoAdminProps) => {
  const [partido, setPartido] = useState<PartidoDetallado | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [datosEdicion, setDatosEdicion] = useState<DatosEdicionState | null>(null);
  const [vistaEstadisticas, setVistaEstadisticas] = useState<VistaEstadisticas>('generales');
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [capturaSetAbierta, setCapturaSetAbierta] = useState<boolean>(false);
  const [numeroSetEnCaptura, setNumeroSetEnCaptura] = useState<number | null>(null);
  const [capturaGeneralesAbierta, setCapturaGeneralesAbierta] = useState<boolean>(false);
  const [datosInicialesGenerales, setDatosInicialesGenerales] = useState<EstadisticaManualBackend[]>([]);
  const [hayDatosAutomaticosGenerales, setHayDatosAutomaticosGenerales] = useState<boolean>(false);

  // Cargar partido
  const cargarPartido = useCallback(async () => {
    if (!partidoId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const partidoDetalle = await getPartidoDetallado(partidoId);
      const sets = await obtenerSetsDePartido(partidoId);
      
      const partidoConSets: PartidoDetallado = {
        ...partidoDetalle,
        sets: sets.map(s => ({
          ...s,
          // Asegurar que los sets tengan los campos necesarios
          numeroSet: s.numeroSet || 0,
          marcadorLocal: s.marcadorLocal || 0,
          marcadorVisitante: s.marcadorVisitante || 0,
        })),
      };
      
      setPartido(partidoConSets);
      setDatosEdicion({
        fecha: partidoDetalle.fecha ? new Date(partidoDetalle.fecha).toISOString().slice(0, 16) : '',
        ubicacion: partidoDetalle.ubicacion || '',
        estado: partidoDetalle.estado || 'programado',
        nombrePartido: partidoDetalle.nombrePartido || '',
        marcadorLocal: partidoDetalle.marcadorLocal || 0,
        marcadorVisitante: partidoDetalle.marcadorVisitante || 0,
        marcadorModificadoManualmente: partidoDetalle.marcadorModificadoManualmente || false,
        modalidad: partidoDetalle.modalidad || '',
        categoria: partidoDetalle.categoria || '',
        competencia: typeof partidoDetalle.competencia === 'string'
          ? partidoDetalle.competencia
          : (partidoDetalle.competencia as { _id?: string } | undefined)?._id || '',
      });
    } catch (err) {
      setError('Error al cargar el partido. Por favor, intente nuevamente.');
      console.error('Error al cargar partido:', err);
    } finally {
      setLoading(false);
    }
  }, [partidoId]);

  const abrirCapturaSet = useCallback((numeroSet?: number) => {
    setNumeroSetEnCaptura(numeroSet ?? null);
    setCapturaSetAbierta(true);
  }, []);

  const cerrarCapturaSet = useCallback(async () => {
    setCapturaSetAbierta(false);
    setNumeroSetEnCaptura(null);
    await cargarPartido();
  }, [cargarPartido]);

  const abrirCapturaGenerales = useCallback((config?: {
    datosIniciales?: EstadisticaManualBackend[];
    hayDatosAutomaticos?: boolean;
  }) => {
    setDatosInicialesGenerales(config?.datosIniciales ?? []);
    setHayDatosAutomaticosGenerales(config?.hayDatosAutomaticos ?? false);
    setCapturaGeneralesAbierta(true);
  }, []);

  const cerrarCapturaGenerales = useCallback(async () => {
    setCapturaGeneralesAbierta(false);
    setDatosInicialesGenerales([]);
    setHayDatosAutomaticosGenerales(false);
    await cargarPartido();
  }, [cargarPartido]);

  // Cargar competencias
  const cargarCompetencias = useCallback(async () => {
    try {
      const participaciones = await getCompetencias({ equipoId: '' });
      const competencias = Array.isArray(participaciones)
        ? participaciones
            .map(p => p.competencia)
            .filter((c): c is Competencia => Boolean(c?.id))
        : [];
      setCompetencias(competencias);
    } catch (err) {
      console.error('Error al cargar competencias:', err);
    }
  }, []);

  const actualizarSetsLocales = useCallback((sets: SetPartido[]) => {
    setPartido(prev => (prev ? { ...prev, sets } : prev));
  }, []);

  const agregarSetAPartido = useCallback(async (_: string, data: { numeroSet: number; ganadorSet: string; estadoSet: string }) => {
    const nuevoSet = await crearSetPartido(partidoId, data);
    setPartido(prev => {
      if (!prev) return prev;
      const setsPrevios = prev.sets ?? [];
      return {
        ...prev,
        sets: [...setsPrevios, nuevoSet],
      };
    });
    return nuevoSet;
  }, [partidoId]);

  const actualizarSetDePartido = useCallback(async (numeroSet: number, cambios: Partial<SetPartido>) => {
    const setObjetivo = partido?.sets?.find(set => set.numeroSet === numeroSet);
    const setId = setObjetivo?._id;
    if (!setId) return null;

    const actualizado = await actualizarSetPartido(setId, cambios);
    setPartido(prev => {
      if (!prev) return prev;
      const setsPrevios = prev.sets ?? [];
      const setsActualizados = setsPrevios.map(set =>
        set._id === actualizado._id ? { ...set, ...actualizado } : set,
      );
      return {
        ...prev,
        sets: setsActualizados,
      };
    });

    return actualizado;
  }, [partido?.sets]);

  const eliminarSetDePartido = useCallback(async (numeroSet: number, setId?: string) => {
    const setObjetivo = partido?.sets?.find(set => set.numeroSet === numeroSet);
    const targetId = setId ?? setObjetivo?._id;
    if (!targetId) return false;

    await eliminarSetPartido(targetId);

    setPartido(prev => {
      if (!prev) return prev;
      const setsPrevios = prev.sets ?? [];
      return {
        ...prev,
        sets: setsPrevios.filter(set => set._id !== targetId),
      };
    });

    return true;
  }, [partido?.sets]);

  // Efectos
  useEffect(() => {
    cargarPartido();
    cargarCompetencias();
  }, [cargarPartido, cargarCompetencias]);

  // Handlers
  const handleGuardarEdicion = async () => {
    if (!datosEdicion) return;

    try {
      const { fecha, ...rest } = datosEdicion;
      const payload = {
        ...rest,
        fecha: fecha ? new Date(fecha).toISOString() : undefined,
      };

      await editarPartido(partidoId, payload);
      await cargarPartido();
      setModoEdicion(false);
    } catch (err) {
      setError('Error al guardar los cambios. Por favor, intente nuevamente.');
      console.error('Error al guardar partido:', err);
    }
  };

  const handleRecalcularMarcador = async () => {
    try {
      const partidoActualizado = await recalcularMarcadorPartido(partidoId);
      setPartido(prev => prev ? { ...prev, ...partidoActualizado } : null);
      setDatosEdicion(prev => prev ? {
        ...prev,
        marcadorLocal: partidoActualizado.marcadorLocal || 0,
        marcadorVisitante: partidoActualizado.marcadorVisitante || 0,
      } : null);
    } catch (err) {
      setError('Error al recalcular el marcador.');
      console.error('Error al recalcular marcador:', err);
    }
  };

  const handleEliminarPartido = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar este partido? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await eliminarPartido(partidoId);
      onPartidoEliminado(partidoId);
      onClose();
    } catch (err) {
      setError('Error al eliminar el partido. Por favor, intente nuevamente.');
      console.error('Error al eliminar partido:', err);
    }
  };

  const handleCambiarModoVisualizacion = async (modo: 'automatico' | 'manual') => {
    if (!partido) return;

    try {
      await actualizarModoVisualizacionPartido(partidoId, modo);
      setPartido(prev => prev ? { ...prev, modoVisualizacion: modo } : null);
    } catch (err) {
      setError('Error al actualizar el modo de visualización.');
      console.error('Error al cambiar modo de visualización:', err);
    }
  };

  if (loading) {
    return (
      <ModalBase title="Cargando partido..." onClose={onClose}>
        <div className="p-4 text-center">
          <p>Cargando información del partido...</p>
        </div>
      </ModalBase>
    );
  }

  if (error || !partido || !datosEdicion) {
    return (
      <ModalBase title="Error" onClose={onClose}>
        <div className="p-4 text-red-600">
          <p>{error || 'No se pudo cargar la información del partido.'}</p>
          <button
            onClick={cargarPartido}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </ModalBase>
    );
  }

  return (
    <ModalBase title={`Partido: ${partido.nombrePartido || 'Sin nombre'}`} onClose={onClose} size="xl">
      <div className="space-y-6 p-4">
        <InformacionPartidoSection
          partido={partido}
          modoEdicion={modoEdicion}
          datosEdicion={datosEdicion}
          competencias={competencias}
          onToggleModoEdicion={setModoEdicion}
          onChangeDatosEdicion={(campo, valor) => 
            setDatosEdicion(prev => prev ? { ...prev, [campo]: valor } : null)
          }
          onGuardar={handleGuardarEdicion}
          onRecalcular={handleRecalcularMarcador}
        />

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Estadísticas del Partido</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setVistaEstadisticas('generales')}
                className={`px-3 py-1 rounded ${
                  vistaEstadisticas === 'generales'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Generales
              </button>
              <button
                onClick={() => setVistaEstadisticas('setASet')}
                className={`px-3 py-1 rounded ${
                  vistaEstadisticas === 'setASet'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Set a Set
              </button>
              <button
                onClick={() => setVistaEstadisticas('directas')}
                className={`px-3 py-1 rounded ${
                  vistaEstadisticas === 'directas'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Estadísticas Directas
              </button>
            </div>
          </div>

          {vistaEstadisticas === 'generales' && (
            <SeccionEstadisticasGenerales
              partido={{ ...partido, _id: partido._id ?? partidoId } as any}
              partidoId={partidoId}
              onCambiarModoEstadisticas={async (id, modo) => {
                // Implementar lógica de cambio de modo si es necesario
              }}
              onAbrirCaptura={() => abrirCapturaGenerales()}
            />
          )}

          {vistaEstadisticas === 'setASet' && (
            <SeccionEstadisticasSetASet
              partido={partido}
              onAbrirCaptura={abrirCapturaSet}
            />
          )}

          {vistaEstadisticas === 'directas' && (
            <SeccionEstadisticasDirectas
              partido={partido}
              partidoId={partidoId}
              token={token}
              onRefresh={cargarPartido}
              setModalEstadisticasGeneralesAbierto={({ datosIniciales, hayDatosAutomaticos }) =>
                abrirCapturaGenerales({ datosIniciales, hayDatosAutomaticos })
              }
            />
          )}
        </div>

        <ConfiguracionAvanzadaSection
          partido={partido}
          onCambiarModoVisualizacion={handleCambiarModoVisualizacion}
          onEliminarPartido={handleEliminarPartido}
        />
      </div>

      {capturaSetAbierta && partido && (
        <ModalEstadisticas
          partido={partido}
          partidoId={partidoId}
          token={token}
          onClose={cerrarCapturaSet}
          actualizarSetsLocales={actualizarSetsLocales}
          agregarSetAPartido={agregarSetAPartido}
          actualizarSetDePartido={actualizarSetDePartido}
          refrescarPartidoSeleccionado={cargarPartido}
          eliminarSetDePartido={eliminarSetDePartido}
          numeroSetInicial={numeroSetEnCaptura}
        />
      )}

      {capturaGeneralesAbierta && (
        <ModalEstadisticasGeneralesCaptura
          partido={partido}
          partidoId={partidoId}
          token={token}
          onClose={cerrarCapturaGenerales}
          onRefresh={cargarPartido}
          datosIniciales={datosInicialesGenerales}
          hayDatosAutomaticos={hayDatosAutomaticosGenerales}
        />
      )}
    </ModalBase>
  );
};