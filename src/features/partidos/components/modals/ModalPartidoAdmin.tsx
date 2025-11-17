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
  eliminarPartido,
  actualizarModoVisualizacionPartido,
  actualizarModoEstadisticasPartido,
  extractEquipoId,
  type PartidoDetallado,
} from '../../services/partidoService';
import type { EstadisticaManualBackend } from '../../hooks/useEstadisticasModal';

import type { JugadorPartido } from '../../../../shared/utils/types/types';
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
  const [datosEdicion, setDatosEdicion] = useState<DatosEdicionState | null>(null);
  const [vistaEstadisticas, setVistaEstadisticas] = useState<VistaEstadisticas>('generales');
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
  }, [partidoId, addToast]);

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

  const handleCerrarAlineacion = useCallback(() => {
    setAlineacionModalAbierta(false);
  }, []);

  const handleAlineacionGuardada = useCallback(async (alineacion: JugadorPartido[]) => {
    onAlineacionActualizada?.(alineacion);
    await cargarPartido();
  }, [cargarPartido, onAlineacionActualizada]);

  // Efectos
  useEffect(() => {
    cargarPartido();
  }, [cargarPartido]);

  // Handlers

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