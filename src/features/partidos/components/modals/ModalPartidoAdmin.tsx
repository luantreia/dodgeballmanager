import { useEffect, useState, useCallback, useMemo } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { ConfiguracionAvanzadaSection } from '../sections/SectionConfiguracionAvanzada';
import { SeccionEstadisticasGenerales } from '../sections/SeccionEstadisticasGenerales';
import { SeccionEstadisticasSetASet } from '../sections/SeccionEstadisticasSetASet';
import { SeccionEstadisticasDirectas } from '../sections/SeccionEstadisticasDirectas';
import ModalCapturaSetEstadisticas from './ModalCapturaSetEstadisticas';
import ModalEstadisticasGeneralesCaptura from './ModalEstadisticasDirectasCaptura';
import ModalAlineacionPartido from './ModalAlineacionPartido';
import ModalGestionSets from './ModalGestionSets';
import {
  getPartidoDetallado,
  obtenerSetsDePartido,
  editarPartido,
  eliminarPartido,
  recalcularMarcadorPartido,
  actualizarModoVisualizacionPartido,
  actualizarModoEstadisticasPartido,
  crearSetPartido,
  actualizarSetPartido,
  eliminarSetPartido,
  extractEquipoId,
  type PartidoDetallado,
  type SetPartido,
} from '../../services/partidoService';
import type { EstadisticaManualBackend } from '../../hooks/useEstadisticasModal';

import type { Competencia, JugadorPartido } from '../../../../types';
import { getParticipaciones as getCompetencias } from '../../../competencias/services/equipoCompetenciaService';
import ConfirmModal from '../../../../shared/components/ConfirmModal/ConfirmModal';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';

type ModalPartidoAdminProps = {
  partidoId: string;
  token: string;
  onClose: () => void;
  onPartidoEliminado: (partidoId: string) => void;
  equipoId?: string;
  onAlineacionActualizada?: (alineacion: JugadorPartido[]) => void;
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

export const ModalPartidoAdmin = ({ partidoId, token, onClose, onPartidoEliminado, equipoId, onAlineacionActualizada }: ModalPartidoAdminProps) => {
  const [partido, setPartido] = useState<PartidoDetallado | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [datosEdicion, setDatosEdicion] = useState<DatosEdicionState | null>(null);
  const [vistaEstadisticas, setVistaEstadisticas] = useState<VistaEstadisticas>('generales');
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [capturaSetAbierta, setCapturaSetAbierta] = useState<boolean>(false);
  const [numeroSetEnCaptura, setNumeroSetEnCaptura] = useState<number | null>(null);
  const [gestionSetsAbierta, setGestionSetsAbierta] = useState<boolean>(false);
  const [capturaGeneralesAbierta, setCapturaGeneralesAbierta] = useState<boolean>(false);
  const [datosInicialesGenerales, setDatosInicialesGenerales] = useState<EstadisticaManualBackend[]>([]);
  const [hayDatosAutomaticosGenerales, setHayDatosAutomaticosGenerales] = useState<boolean>(false);
  const [alineacionModalAbierta, setAlineacionModalAbierta] = useState<boolean>(false);
  const [confirmEliminarAbierto, setConfirmEliminarAbierto] = useState<boolean>(false);
  const { addToast } = useToast();

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
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar el partido' });
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

  const equipoContextoId = useMemo(() => {
    if (equipoId) return equipoId;
    if (!partido) return undefined;
    return extractEquipoId(partido.equipoLocal) ?? extractEquipoId(partido.equipoVisitante);
  }, [equipoId, partido]);

  const handleGestionarAlineacion = useCallback(() => {
    setAlineacionModalAbierta(true);
  }, []);

  const handleCerrarAlineacion = useCallback(() => {
    setAlineacionModalAbierta(false);
  }, []);

  const handleAlineacionGuardada = useCallback(async (alineacion: JugadorPartido[]) => {
    onAlineacionActualizada?.(alineacion);
    await cargarPartido();
  }, [cargarPartido, onAlineacionActualizada]);

  // Cargar competencias
  const cargarCompetencias = useCallback(async () => {
    try {
      if (!equipoContextoId) {
        setCompetencias([]);
        return;
      }
      const participaciones = await getCompetencias({ equipoId: equipoContextoId });
      const competencias = Array.isArray(participaciones)
        ? participaciones
            .map(p => p.competencia)
            .filter((c): c is Competencia => Boolean(c?.id))
        : [];
      setCompetencias(competencias);
    } catch (err) {
      console.error('Error al cargar competencias:', err);
    }
  }, [equipoContextoId]);

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
      addToast({ type: 'success', title: 'Guardado', message: 'Se actualizaron los datos del partido' });
    } catch (err) {
      setError('Error al guardar los cambios. Por favor, intente nuevamente.');
      console.error('Error al guardar partido:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos guardar los cambios del partido' });
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
      addToast({ type: 'success', title: 'Marcador actualizado', message: 'Marcador recalculado desde sets' });
    } catch (err) {
      setError('Error al recalcular el marcador.');
      console.error('Error al recalcular marcador:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos recalcular el marcador' });
    }
  };

  const handleEliminarPartido = async () => {
    setConfirmEliminarAbierto(true);
  };

  const confirmarEliminarPartido = async () => {
    try {
      await eliminarPartido(partidoId);
      onPartidoEliminado(partidoId);
      setConfirmEliminarAbierto(false);
      onClose();
      addToast({ type: 'success', title: 'Partido eliminado', message: 'El partido fue eliminado' });
    } catch (err) {
      setError('Error al eliminar el partido. Por favor, intente nuevamente.');
      console.error('Error al eliminar partido:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos eliminar el partido' });
    }
  };

  const handleCambiarModoVisualizacion = async (modo: 'automatico' | 'manual') => {
    if (!partido) return;

    try {
      await actualizarModoVisualizacionPartido(partidoId, modo);
      setPartido(prev => prev ? { ...prev, modoVisualizacion: modo } : null);
      addToast({ type: 'success', title: 'Modo actualizado', message: 'Se cambió el modo de visualización' });
    } catch (err) {
      setError('Error al actualizar el modo de visualización.');
      console.error('Error al cambiar modo de visualización:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cambiar el modo de visualización' });
    }
  };

  if (loading) {
    return (
      <ModalBase title="Cargando partido..." onClose={onClose} isOpen>
        <div className="p-4 text-center">
          <p>Cargando información del partido...</p>
        </div>
      </ModalBase>
    );
  }

  if (error || !partido || !datosEdicion) {
    return (
      <ModalBase title="Error" onClose={onClose} isOpen>
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
    <ModalBase title={`Estadísticas del Partido: ${partido.nombrePartido || 'Sin nombre'}`} onClose={onClose} size="xl" isOpen>
      <div>
        <div className="bg-white rounded-lg p-2 sm:p-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold">Vistas</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setVistaEstadisticas('generales')}
                className={`px-3 py-1 rounded text-xs sm:text-sm ${
                  vistaEstadisticas === 'generales'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Generales
              </button>
              <button
                onClick={() => setVistaEstadisticas('setASet')}
                className={`px-3 py-1 rounded text-xs sm:text-sm ${
                  vistaEstadisticas === 'setASet'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Set a Set
              </button>
              <button
                onClick={() => setVistaEstadisticas('directas')}
                className={`px-3 py-1 rounded text-xs sm:text-sm ${
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
              onCambiarModoEstadisticas={async (_id, modo) => {
                try {
                  await actualizarModoEstadisticasPartido(partidoId, modo);
                  setPartido(prev => (prev ? { ...prev, modoEstadisticas: modo } : prev));
                } catch (err) {
                  setError('Error al actualizar el modo de estadísticas.');
                  console.error('Error al cambiar modo de estadísticas:', err);
                  addToast({ type: 'error', title: 'Error', message: 'No pudimos cambiar el modo de estadísticas' });
                }
              }}
              onAbrirCaptura={() => abrirCapturaGenerales()}
            />
          )}

          {vistaEstadisticas === 'setASet' && (
            <SeccionEstadisticasSetASet
              partido={partido}
              onAbrirCaptura={abrirCapturaSet}
              onAbrirGestionSets={() => setGestionSetsAbierta(true)}
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

      {capturaSetAbierta && (
        <ModalCapturaSetEstadisticas
          partido={partido}
          partidoId={partidoId}
          token={token}
          isOpen={capturaSetAbierta}
          onClose={cerrarCapturaSet}
          numeroSetInicial={numeroSetEnCaptura}
          onRefresh={cargarPartido}
        />
      )}

      {gestionSetsAbierta && (
        <ModalGestionSets
          partidoId={partidoId}
          isOpen={gestionSetsAbierta}
          onClose={() => setGestionSetsAbierta(false)}
          onAbrirCaptura={(numero) => {
            setNumeroSetEnCaptura(numero);
            setGestionSetsAbierta(false);
            setCapturaSetAbierta(true);
          }}
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
          onAbrirAlineacion={() => setAlineacionModalAbierta(true)}
        />
      )}

      {partido ? (
        <ModalAlineacionPartido
          partidoId={partidoId}
          equipoId={equipoContextoId}
          isOpen={alineacionModalAbierta}
          onClose={handleCerrarAlineacion}
          onSaved={handleAlineacionGuardada}
        />
      ) : null}

      <ConfirmModal
        isOpen={confirmEliminarAbierto}
        onCancel={() => setConfirmEliminarAbierto(false)}
        onConfirm={confirmarEliminarPartido}
        title="Eliminar partido"
        message="¿Está seguro de que desea eliminar este partido? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
      />
    </ModalBase>
  );
};