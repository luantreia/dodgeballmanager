import { useEffect, useState, useCallback } from 'react';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import ModalEstadisticas from './ModalEstadisticas';
import ModalEstadisticasGeneralesCaptura from './ModalEstadisticasGeneralesCaptura';
import GraficoEstadisticasSet from '../../estadisticas/components/GraficoEstadisticasSet';
import EstadisticasGeneralesPartido from '../../estadisticas/components/EstadisticasGeneralesPartido';
import { SeccionEstadisticasGenerales } from './SeccionEstadisticasGenerales';
import { SeccionEstadisticasSetASet } from './SeccionEstadisticasSetASet';
import { SeccionEstadisticasDirectas } from './SeccionEstadisticasDirectas';
import {
  getPartidoDetallado,
  obtenerSetsDePartido,
  crearSetPartido,
  actualizarSetPartido,
  eliminarSetPartido,
  editarPartido,
  eliminarPartido,
  recalcularMarcadorPartido,
  type PartidoDetallado,
  type SetPartido,
  type CrearSetPayload,
  type ActualizarSetPayload,
} from '../services/partidoService';
import type { Competencia } from '../../../types';
import { getParticipaciones as getCompetencias } from '../../competencias/services/equipoCompetenciaService';

type ModalEstadisticasGeneralesState = {
  datosIniciales: unknown[];
  hayDatosAutomaticos: boolean;
} | null;

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

type ModalPartidoAdminProps = {
  partidoId: string;
  token: string;
  onClose: () => void;
  onPartidoEliminado: (partidoId: string) => void;
};

const crearEstadoEdicion = (partido: PartidoDetallado): DatosEdicionState => ({
  fecha: partido.fecha ? new Date(partido.fecha).toISOString().slice(0, 16) : '',
  ubicacion: partido.ubicacion ?? '',
  estado: partido.estado ?? 'programado',
  nombrePartido: partido.nombrePartido ?? '',
  marcadorLocal: partido.marcadorLocal ?? 0,
  marcadorVisitante: partido.marcadorVisitante ?? 0,
  marcadorModificadoManualmente: partido.marcadorModificadoManualmente ?? true,
  modalidad: partido.modalidad ?? '',
  categoria: partido.categoria ?? '',
  competencia: typeof partido.competencia === 'object' && partido.competencia?._id ? partido.competencia._id : partido.competencia ?? '',
});

const normalizarSet = (set: SetPartido): SetPartido => set;

type DatosEdicionChangeHandler = <K extends keyof DatosEdicionState>(
  field: K,
  value: DatosEdicionState[K],
) => void;

type InformacionPartidoSectionProps = {
  partido: PartidoDetallado;
  modoEdicion: boolean;
  datosEdicion: DatosEdicionState;
  competencias: Competencia[];
  loadingCompetencias: boolean;
  onToggleModoEdicion: (activo: boolean) => void;
  onChangeDatosEdicion: DatosEdicionChangeHandler;
  onGuardar: () => void;
  onRecalcular: () => void;
};

const InformacionPartidoSection = ({
  partido,
  modoEdicion,
  datosEdicion,
  competencias,
  loadingCompetencias,
  onToggleModoEdicion,
  onChangeDatosEdicion,
  onGuardar,
  onRecalcular,
}: InformacionPartidoSectionProps) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <h3 className="text-lg font-semibold mb-3">Información del Partido</h3>

    {modoEdicion ? (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre del Partido</label>
          <input
            type="text"
            value={datosEdicion.nombrePartido}
            onChange={(e) => onChangeDatosEdicion('nombrePartido', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
          <input
            type="datetime-local"
            value={datosEdicion.fecha}
            onChange={(e) => onChangeDatosEdicion('fecha', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Ubicación</label>
          <input
            type="text"
            value={datosEdicion.ubicacion}
            onChange={(e) => onChangeDatosEdicion('ubicacion', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Estado</label>
          <select
            value={datosEdicion.estado}
            onChange={(e) => onChangeDatosEdicion('estado', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="programado">Programado</option>
            <option value="en_juego">En Juego</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Modalidad</label>
            <select
              value={datosEdicion.modalidad}
              onChange={(e) => onChangeDatosEdicion('modalidad', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">-</option>
              <option value="Foam">Foam</option>
              <option value="Cloth">Cloth</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Categoría</label>
            <select
              value={datosEdicion.categoria}
              onChange={(e) => onChangeDatosEdicion('categoria', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">-</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Mixto">Mixto</option>
              <option value="Libre">Libre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Competencia</label>
            <select
              value={datosEdicion.competencia}
              onChange={(e) => onChangeDatosEdicion('competencia', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={loadingCompetencias}
            >
              <option value="">Amistoso (sin competencia)</option>
              {loadingCompetencias ? (
                <option value="" disabled>
                  Cargando competencias...
                </option>
              ) : (
                competencias.map((competencia) => (
                  <option key={competencia.id} value={competencia.id}>
                    {competencia.nombre}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Marcador Local</label>
            <input
              type="number"
              value={datosEdicion.marcadorLocal}
              onChange={(e) => onChangeDatosEdicion('marcadorLocal', Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Marcador Visitante</label>
            <input
              type="number"
              value={datosEdicion.marcadorVisitante}
              onChange={(e) => onChangeDatosEdicion('marcadorVisitante', Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              min={0}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onGuardar}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Guardar
          </button>
          <button
            onClick={onRecalcular}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
            title="Recalcular marcador automáticamente desde los sets"
          >
            🔄 Recalcular
          </button>
          <button
            onClick={() => onToggleModoEdicion(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-2">
        <p>
          <strong>Nombre:</strong> {partido.nombrePartido || 'Sin nombre'}
        </p>
        <p>
          <strong>Fecha:</strong> {partido.fecha ? new Date(partido.fecha).toLocaleString() : '-'}
        </p>
        <p>
          <strong>Competencia:</strong> {partido.competencia?.nombre || 'Partido amistoso'}
        </p>
        <p>
          <strong>Modalidad:</strong> {partido.modalidad || '-'}
        </p>
        <p>
          <strong>Categoría:</strong> {partido.categoria || '-'}
        </p>
        <p>
          <strong>Estado:</strong> {partido.estado || '-'}
        </p>
        <p>
          <strong>Ubicación:</strong> {partido.ubicacion || '-'}
        </p>
        <p>
          <strong>Marcador:</strong> {partido.equipoLocal?.nombre || 'Local'} {partido.marcadorLocal ?? 0} - {partido.marcadorVisitante ?? 0} {partido.equipoVisitante?.nombre || 'Visitante'}
        </p>
        <p>
          <strong>Equipo Local:</strong> {partido.equipoLocal?.nombre || '-'}
        </p>
        <p>
          <strong>Equipo Visitante:</strong> {partido.equipoVisitante?.nombre || '-'}
        </p>
        <button
          onClick={() => onToggleModoEdicion(true)}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Editar Datos
        </button>
      </div>
    )}
  </div>
);

type EstadisticasPartidoSectionProps = {
  vistaActual: VistaEstadisticas;
  onChangeVista: (vista: VistaEstadisticas) => void;
  partido: PartidoDetallado;
  partidoId: string;
  token: string;
  onCambiarModoEstadisticas: (id: string, nuevoModo: 'manual' | 'automatico') => Promise<void> | void;
  onOpenEstadisticasModal: (numeroSet?: number) => void;
  onSetRefreshDirectas: (callback: (() => Promise<void>) | null) => void;
  setModalEstadisticasGeneralesAbierto: (state: ModalEstadisticasGeneralesState) => void;
};

const EstadisticasPartidoSection = ({
  vistaActual,
  onChangeVista,
  partido,
  partidoId,
  token,
  onCambiarModoEstadisticas,
  onOpenEstadisticasModal,
  onSetRefreshDirectas,
  setModalEstadisticasGeneralesAbierto,
}: EstadisticasPartidoSectionProps) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-semibold">Estadísticas del Partido</h3>
      <div className="flex gap-2">
        <button
          onClick={() => onChangeVista('generales')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            vistaActual === 'generales'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          📊 Generales
        </button>
        <button
          onClick={() => onChangeVista('setASet')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            vistaActual === 'setASet'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          🎯 Set a Set
        </button>
        <button
          onClick={() => onChangeVista('directas')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            vistaActual === 'directas'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          ⚡ Directas
        </button>
      </div>
    </div>

    {vistaActual === 'generales' && (
      <SeccionEstadisticasGenerales
        partido={partido}
        partidoId={partidoId}
        onCambiarModoEstadisticas={onCambiarModoEstadisticas}
      />
    )}

    {vistaActual === 'setASet' && (
      <SeccionEstadisticasSetASet
        partido={partido}
        token={token}
        onAbrirCaptura={(numeroSet) => {
          onOpenEstadisticasModal(numeroSet);
        }}
      />
    )}

    {vistaActual === 'directas' && (
      <SeccionEstadisticasDirectas
        partido={partido}
        partidoId={partidoId}
        token={token}
        onRefresh={onSetRefreshDirectas}
        setModalEstadisticasGeneralesAbierto={setModalEstadisticasGeneralesAbierto}
      />
    )}
  </div>
);

type AccionesPartidoSectionProps = {
  onGestionarSets: () => void;
  onVerPartido: () => void;
};

const AccionesPartidoSection = ({ onGestionarSets, onVerPartido }: AccionesPartidoSectionProps) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <button
      onClick={onGestionarSets}
      className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
    >
      Gestionar Sets y Estadísticas
    </button>
    <button
      onClick={onVerPartido}
      className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
    >
      Ver Partido Completo
    </button>
  </div>
);

type ConfiguracionAvanzadaSectionProps = {
  partido: PartidoDetallado;
  onCambiarModoVisualizacion: (nuevoModo: 'automatico' | 'manual') => void;
  onEliminarPartido: () => void;
};

const ConfiguracionAvanzadaSection = ({
  partido,
  onCambiarModoVisualizacion,
  onEliminarPartido,
}: ConfiguracionAvanzadaSectionProps) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <details className="group">
      <summary className="flex items-center justify-between cursor-pointer text-red-800 font-medium hover:text-red-900 transition-colors">
        <span className="flex items-center gap-2">
          ⚙️ Configuración Avanzada
          <svg
            className="w-4 h-4 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" />
          </svg>
        </span>
      </summary>

      <div className="mt-4 pt-4 border-t border-red-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="text-blue-800 font-semibold mb-3">👁️ Configuración de Visualización</h4>
          <p className="text-blue-700 text-sm mb-4">
            Controla qué estadísticas ven los usuarios comunes del partido.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700">Mostrar al público:</span>
            <select
              value={(partido?.modoVisualizacion as 'automatico' | 'manual') || 'automatico'}
              onChange={(e) => onCambiarModoVisualizacion(e.target.value as 'automatico' | 'manual')}
              className="px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="automatico">📊 Estadísticas por Set (calculadas)</option>
              <option value="manual">✏️ Estadísticas Totales (ingresadas)</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-semibold mb-3">⚠️ Acciones Irreversibles</h4>
          <p className="text-red-700 text-sm mb-4">
            Estas acciones eliminarán permanentemente datos del partido. No se pueden deshacer.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onEliminarPartido}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
              title="Eliminar este partido permanentemente"
            >
              🗑️ Eliminar Partido
            </button>
          </div>
        </div>
      </div>
    </details>
  </div>
);

export const ModalPartidoAdmin = ({ partidoId, token, onClose, onPartidoEliminado }: ModalPartidoAdminProps) => {
  const [partido, setPartido] = useState<PartidoDetallado | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEstadisticasAbierto, setModalEstadisticasAbierto] = useState(false);
  const [modalEstadisticasGeneralesAbierto, setModalEstadisticasGeneralesAbierto] =
    useState<ModalEstadisticasGeneralesState>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [datosEdicion, setDatosEdicion] = useState<DatosEdicionState | null>(null);
  const [vistaEstadisticas, setVistaEstadisticas] = useState<VistaEstadisticas>('generales');
  const [refreshEstadisticas, setRefreshEstadisticas] = useState<(() => Promise<void>) | null>(null);
  const [numeroSetInicial, setNumeroSetInicial] = useState<number | null>(null);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loadingCompetencias, setLoadingCompetencias] = useState(false);

  const fetchPartidoCompleto = useCallback(async () => {
    if (!partidoId) return;
    setLoading(true);
    try {
      const partidoDetalle = await getPartidoDetallado(partidoId);
      const sets = await obtenerSetsDePartido(partidoId);
      const partidoConSets: PartidoDetallado = {
        ...partidoDetalle,
        sets: sets.map(normalizarSet),
      };
      setPartido(partidoConSets);
      setDatosEdicion(crearEstadoEdicion(partidoConSets));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar partido';
      setError(message);
    } finally {
      setLoading(false);
    }

  }, [partidoId]);

  useEffect(() => {
    void fetchPartidoCompleto();
  }, [fetchPartidoCompleto]);

  useEffect(() => {
    const cargarCompetencias = async () => {
      try {
        setLoadingCompetencias(true);
        const lista = await getCompetencias({ equipoId: '' });
        const competenciasNormalizadas = Array.isArray(lista)
          ? lista
              .map((participacion) => participacion.competencia)
              .filter((competencia): competencia is Competencia => Boolean(competencia?.id))
          : [];
        setCompetencias(competenciasNormalizadas);
      } catch (e) {
        setCompetencias([]);
      } finally {
        setLoadingCompetencias(false);
      }
    };

    void cargarCompetencias();
  }, []);

  const handleAgregarSet = async (partidoIdParam: string, setData: Omit<CrearSetPayload, 'partido'>) => {
    const idToUse = partidoIdParam || partidoId;
    const creado = await crearSetPartido(idToUse, setData);
    setPartido((prev) =>
      prev
        ? {
            ...prev,
            sets: [...(prev.sets ?? []), normalizarSet(creado)],
          }
        : prev,
    );
    return creado;
  };

  const handleActualizarSet = async (setId: string, payload: ActualizarSetPayload) => {
    const actualizado = await actualizarSetPartido(setId, payload);
    setPartido((prev) =>
      prev
        ? {
            ...prev,
            sets: prev.sets?.map((set) => (set._id === setId ? normalizarSet(actualizado) : set)) ?? [],
          }
        : prev,
    );
    return actualizado;
  };

  const handleEliminarSet = async (setId: string) => {
    await eliminarSetPartido(setId);
    setPartido((prev) =>
      prev
        ? {
            ...prev,
            sets: prev.sets?.filter((set) => set._id !== setId) ?? [],
          }
        : prev,
    );
    return true;
  };

  const handleGuardarEdicion = async () => {
    if (!datosEdicion) return;
    try {
      const { fecha, competencia, ...rest } = datosEdicion;
      const payload: Record<string, unknown> = {
        ...rest,
        marcadorModificadoManualmente: true,
      };

      if (fecha) {
        payload.fecha = new Date(fecha);
      }

      payload.competencia = competencia || null;

      Object.entries(payload).forEach(([key, value]) => {
        if (value === '' || value === undefined) {
          delete (payload as Record<string, unknown>)[key];
        }
      });

      const partidoActualizado = await editarPartido(partidoId, payload);
      setPartido((prev) => (prev ? { ...prev, ...partidoActualizado } : prev));
      setDatosEdicion((prev) => (prev ? { ...prev, marcadorModificadoManualmente: true } : prev));
      setModoEdicion(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar partido';
      alert(`Error al actualizar partido: ${message}`);
    }
  };

  const handleRecalcularMarcador = async () => {
    try {
      const partidoActualizado = await recalcularMarcadorPartido(partidoId);
      setPartido((prev) => (prev ? { ...prev, ...partidoActualizado } : prev));
      setDatosEdicion((prev) =>
        prev
          ? {
              ...prev,
              marcadorLocal: partidoActualizado.marcadorLocal ?? 0,
              marcadorVisitante: partidoActualizado.marcadorVisitante ?? 0,
              marcadorModificadoManualmente: partidoActualizado.marcadorModificadoManualmente ?? false,
            }
          : prev,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al recalcular marcador';
      alert(`Error al recalcular marcador: ${message}`);
    }
  };

  const handleEliminarPartido = async () => {
    try {
      await eliminarPartido(partidoId);
      onClose();
      onPartidoEliminado(partidoId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar partido';
      alert(`Error al eliminar partido: ${message}`);
    }
  };

  const handleCambiarModoEstadisticas = async (id: string, nuevoModo: 'manual' | 'automatico') => {
    try {
      setPartido((prev) => (prev ? { ...prev, modoEstadisticas: nuevoModo } : prev));
      await editarPartido(id, { modoEstadisticas: nuevoModo });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cambiar modo de estadísticas';
      alert(`Error al cambiar modo: ${message}`);
      void fetchPartidoCompleto();
    }
  };

  const handleCambiarModoVisualizacion = async (nuevoModo: 'automatico' | 'manual') => {
    try {
      setPartido((prev) => (prev ? { ...prev, modoVisualizacion: nuevoModo } : prev));
      await editarPartido(partidoId, { modoVisualizacion: nuevoModo });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cambiar modo de visualización';
      alert(`Error al cambiar modo de visualización: ${message}`);
      void fetchPartidoCompleto();
    }
  };

  const refrescarPartidoSeleccionado = async (): Promise<void> => {
    await fetchPartidoCompleto();
  };

  const actualizarSetsLocalesCallback = useCallback((sets: SetPartido[]) => {
    setPartido(prev => prev ? { ...prev, sets } : prev);
  }, []);

  if (loading) {
    return (
      <ModalBase title="Cargando partido..." onClose={onClose}>
        <p>Cargando...</p>
      </ModalBase>
    );
  }

  if (error) {
    return (
      <ModalBase title="Error" onClose={onClose}>
        <p className="text-red-600">{error}</p>
      </ModalBase>
    );
  }

  if (!partido || !datosEdicion) {
    return null;
  }

  return (
    <>
      <ModalBase title={`Administrar Partido`} onClose={onClose}>
        <div className="space-y-6">
          {/* Datos del partido */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Información del Partido</h3>
            
            {modoEdicion ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre del Partido</label>
                  <input
                    type="text"
                    value={datosEdicion.nombrePartido}
                    onChange={(e) =>
                      setDatosEdicion((prev) =>
                        prev ? { ...prev, nombrePartido: e.target.value } : prev,
                      )
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={datosEdicion.fecha}
                    onChange={(e) =>
                      setDatosEdicion((prev) => (prev ? { ...prev, fecha: e.target.value } : prev))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ubicación</label>
                  <input
                    type="text"
                    value={datosEdicion.ubicacion}
                    onChange={(e) =>
                      setDatosEdicion((prev) =>
                        prev ? { ...prev, ubicacion: e.target.value } : prev,
                      )
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado</label>
                  <select
                    value={datosEdicion.estado}
                    onChange={(e) =>
                      setDatosEdicion((prev) => (prev ? { ...prev, estado: e.target.value } : prev))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="programado">Programado</option>
                    <option value="en_juego">En Juego</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Modalidad</label>
                    <select
                      value={datosEdicion.modalidad}
                      onChange={(e) =>
                        setDatosEdicion((prev) =>
                          prev ? { ...prev, modalidad: e.target.value } : prev,
                        )
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">-</option>
                      <option value="Foam">Foam</option>
                      <option value="Cloth">Cloth</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Categoría</label>
                    <select
                      value={datosEdicion.categoria}
                      onChange={(e) =>
                        setDatosEdicion((prev) =>
                          prev ? { ...prev, categoria: e.target.value } : prev,
                        )
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">-</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Mixto">Mixto</option>
                      <option value="Libre">Libre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Competencia</label>
                    <select
                      value={datosEdicion.competencia}
                      onChange={(e) =>
                        setDatosEdicion((prev) =>
                          prev ? { ...prev, competencia: e.target.value } : prev,
                        )
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Amistoso (sin competencia)</option>
                      {competencias.map((competencia) => (
                        <option key={competencia.id} value={competencia.id}>{competencia.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Marcador Local</label>
                    <input
                      type="number"
                      value={datosEdicion.marcadorLocal}
                      onChange={(e) => setDatosEdicion(prev => ({ ...prev, marcadorLocal: Number(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Marcador Visitante</label>
                    <input
                      type="number"
                      value={datosEdicion.marcadorVisitante}
                      onChange={(e) => setDatosEdicion(prev => ({ ...prev, marcadorVisitante: Number(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min={0}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGuardarEdicion}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleRecalcularMarcador}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    title="Recalcular marcador automáticamente desde los sets"
                  >
                    🔄 Recalcular
                  </button>
                  <button
                    onClick={() => setModoEdicion(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p><strong>Nombre:</strong> {partido.nombrePartido || 'Sin nombre'}</p>
                <p><strong>Fecha:</strong> {partido.fecha ? new Date(partido.fecha).toLocaleString() : '-'}</p>
                <p><strong>Competencia:</strong> {partido.competencia?.nombre || 'Partido amistoso'}</p>
                <p><strong>Modalidad:</strong> {partido.modalidad || '-'}</p>
                <p><strong>Categoría:</strong> {partido.categoria || '-'}</p>
                <p><strong>Estado:</strong> {partido.estado || '-'}</p>
                <p><strong>Ubicación:</strong> {partido.ubicacion || '-'}</p>
                <p><strong>Marcador:</strong> {partido.equipoLocal?.nombre || 'Local'} {partido.marcadorLocal ?? 0} - {partido.marcadorVisitante ?? 0} {partido.equipoVisitante?.nombre || 'Visitante'}</p>
                <p><strong>Equipo Local:</strong> {partido.equipoLocal?.nombre || '-'}</p>
                <p><strong>Equipo Visitante:</strong> {partido.equipoVisitante?.nombre || '-'}</p>
                <button
                  onClick={() => setModoEdicion(true)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Editar Datos
                </button>
              </div>
            )}
          </div>

          {/* Estadísticas del partido */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Estadísticas del Partido</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setVistaEstadisticas('generales')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    vistaEstadisticas === 'generales'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  📊 Generales
                </button>
                <button
                  onClick={() => setVistaEstadisticas('setASet')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    vistaEstadisticas === 'setASet'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  🎯 Set a Set
                </button>
                <button
                  onClick={() => setVistaEstadisticas('directas')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    vistaEstadisticas === 'directas'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ⚡ Directas
                </button>
              </div>
            </div>

            {/* Vista Estadísticas Generales */}
            {vistaEstadisticas === 'generales' && (
              <SeccionEstadisticasGenerales
                partido={partido}
                partidoId={partidoId}
                onCambiarModoEstadisticas={handleCambiarModoEstadisticas}
              />
            )}

            {/* Vista Set a Set */}
            {vistaEstadisticas === 'setASet' && (
              <SeccionEstadisticasSetASet
                partido={partido}
                token={token}
                onAbrirCaptura={(numeroSet) => {
                  setNumeroSetInicial(numeroSet);
                  setModalEstadisticasAbierto(true);
                }}
              />
            )}

            {/* Vista Estadísticas Directas */}
            {vistaEstadisticas === 'directas' && (
              <SeccionEstadisticasDirectas
                partido={partido}
                partidoId={partidoId}
                token={token}
                onRefresh={setRefreshEstadisticas}
                setModalEstadisticasGeneralesAbierto={setModalEstadisticasGeneralesAbierto}
              />
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setNumeroSetInicial(null);
                setModalEstadisticasAbierto(true);
              }}
              className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              Gestionar Sets y Estadísticas
            </button>
            <button
              onClick={() => window.open(`/partidos/${partidoId}`, '_blank')}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Ver Partido Completo
            </button>
          </div>

          {/* Sección de configuración avanzada */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-red-800 font-medium hover:text-red-900 transition-colors">
                <span className="flex items-center gap-2">
                  ⚙️ Configuración Avanzada
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" />
                  </svg>
                </span>
              </summary>

              <div className="mt-4 pt-4 border-t border-red-200">
                {/* Selector de Modo de Visualización */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="text-blue-800 font-semibold mb-3">👁️ Configuración de Visualización</h4>
                  <p className="text-blue-700 text-sm mb-4">
                    Controla qué estadísticas ven los usuarios comunes del partido.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-700">Mostrar al público:</span>
                    <select
                      value={(partido?.modoVisualizacion as 'automatico' | 'manual') || 'automatico'}
                      onChange={(e) => handleCambiarModoVisualizacion(e.target.value as 'automatico' | 'manual')}
                      className="px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="automatico">📊 Estadísticas por Set (calculadas)</option>
                      <option value="manual">✏️ Estadísticas Totales (ingresadas)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-red-200 rounded-lg p-4">
                  <h4 className="text-red-800 font-semibold mb-3">⚠️ Acciones Irreversibles</h4>
                  <p className="text-red-700 text-sm mb-4">
                    Estas acciones eliminarán permanentemente datos del partido. No se pueden deshacer.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={handleEliminarPartido}
                      className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                      title="Eliminar este partido permanentemente"
                    >
                      🗑️ Eliminar Partido
                    </button>
                  </div>
                </div>
              </div>
            </details>
          </div>

        </div>
      </ModalBase>

      {/* Modal de estadísticas */}
      {modalEstadisticasAbierto && (
        <ModalEstadisticas
          partido={partido}
          partidoId={partidoId}
          token={token}
          numeroSetInicial={numeroSetInicial || 1}
          actualizarSetsLocales={actualizarSetsLocalesCallback}
          agregarSetAPartido={handleAgregarSet}
          actualizarSetDePartido={async (numeroSet, cambios) => {
            const setObjetivo = partido?.sets?.find((set) => set.numeroSet === numeroSet);
            if (!setObjetivo) {
              return null;
            }
            return handleActualizarSet(setObjetivo._id, cambios as ActualizarSetPayload);
          }}
          eliminarSetDePartido={async (numeroSet, setId) => {
            const id = setId ?? partido?.sets?.find((set) => set.numeroSet === numeroSet)?._id;
            if (!id) return false;
            await handleEliminarSet(id);
            return true;
          }}
          refrescarPartidoSeleccionado={refrescarPartidoSeleccionado}
          onClose={() => {
            setModalEstadisticasAbierto(false);
            setNumeroSetInicial(null);
          }}
        />
      )}

      {/* Modal de estadísticas generales */}
      {modalEstadisticasGeneralesAbierto && (
        <ModalEstadisticasGeneralesCaptura
          partido={partido}
          partidoId={partidoId}
          token={token}
          onClose={() => setModalEstadisticasGeneralesAbierto(null)}
          onRefresh={refreshEstadisticas ?? undefined}
          datosIniciales={modalEstadisticasGeneralesAbierto?.datosIniciales || []}
          hayDatosAutomaticos={modalEstadisticasGeneralesAbierto?.hayDatosAutomaticos || false}
        />
      )}
    </>
  );
}
