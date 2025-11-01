import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import {
  getPartidoDetallado,
  recalcularMarcadorPartido,
  editarPartido,
  extractEquipoId,
  type PartidoDetallado,
} from '../../services/partidoService';
import type { Competencia } from '../../../../types';
import { getParticipaciones as getCompetencias } from '../../../competencias/services/equipoCompetenciaService';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';

interface ModalInformacionPartidoProps {
  partidoId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const ModalInformacionPartido = ({ partidoId, isOpen, onClose }: ModalInformacionPartidoProps) => {
  const { addToast } = useToast();
  const [partido, setPartido] = useState<PartidoDetallado | null>(null);
  const [loading, setLoading] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [datosEdicion, setDatosEdicion] = useState<{
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
  } | null>(null);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);

  const equipoContextoId = useMemo(() => {
    if (!partido) return undefined;
    return extractEquipoId(partido.equipoLocal) ?? extractEquipoId(partido.equipoVisitante);
  }, [partido]);

  const cargar = useCallback(async () => {
    if (!isOpen || !partidoId) {
      setPartido(null);
      setDatosEdicion(null);
      return;
    }
    try {
      setLoading(true);
      const detalle = await getPartidoDetallado(partidoId);
      setPartido(detalle);
      setDatosEdicion({
        fecha: detalle.fecha ? new Date(detalle.fecha).toISOString().slice(0, 16) : '',
        ubicacion: detalle.ubicacion || '',
        estado: detalle.estado || 'programado',
        nombrePartido: detalle.nombrePartido || '',
        marcadorLocal: detalle.marcadorLocal || 0,
        marcadorVisitante: detalle.marcadorVisitante || 0,
        marcadorModificadoManualmente: detalle.marcadorModificadoManualmente || false,
        modalidad: detalle.modalidad || '',
        categoria: detalle.categoria || '',
        competencia:
          typeof detalle.competencia === 'string'
            ? detalle.competencia
            : (detalle.competencia as { _id?: string } | undefined)?._id || '',
      });
    } catch (err) {
      console.error('Error al cargar información del partido:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos obtener los datos del partido.' });
    } finally {
      setLoading(false);
    }
  }, [addToast, isOpen, partidoId]);

  const cargarCompetencias = useCallback(async () => {
    try {
      if (!equipoContextoId) {
        setCompetencias([]);
        return;
      }
      const participaciones = await getCompetencias({ equipoId: equipoContextoId });
      const comps = Array.isArray(participaciones)
        ? participaciones.map((p) => p.competencia).filter((c): c is Competencia => Boolean(c?.id))
        : [];
      setCompetencias(comps);
    } catch (err) {
      console.error('Error al cargar competencias:', err);
    }
  }, [equipoContextoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void cargarCompetencias();
  }, [cargarCompetencias]);

  const handleGuardar = async () => {
    if (!partidoId || !datosEdicion) return;
    try {
      const { fecha, ...rest } = datosEdicion;
      const payload = {
        ...rest,
        fecha: fecha ? new Date(fecha).toISOString() : undefined,
      };
      await editarPartido(partidoId, payload);
      await cargar();
      setModoEdicion(false);
      addToast({ type: 'success', title: 'Guardado', message: 'Se actualizaron los datos del partido' });
    } catch (err) {
      console.error('Error al guardar partido:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos guardar los cambios' });
    }
  };

  const handleRecalcular = async () => {
    if (!partidoId) return;
    try {
      const actualizado = await recalcularMarcadorPartido(partidoId);
      setPartido((prev) => (prev ? { ...prev, ...actualizado } : prev));
      setDatosEdicion((prev) =>
        prev
          ? {
              ...prev,
              marcadorLocal: actualizado.marcadorLocal || 0,
              marcadorVisitante: actualizado.marcadorVisitante || 0,
              marcadorModificadoManualmente: false,
            }
          : prev,
      );
      addToast({ type: 'success', title: 'Marcador actualizado', message: 'Marcador recalculado desde sets' });
    } catch (err) {
      console.error('Error al recalcular marcador:', err);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos recalcular el marcador' });
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Detalles del partido"
      subtitle="Información básica y edición rápida"
      size="lg"
      bodyClassName="p-0"
    >
      <div className="space-y-4 px-6 pb-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-4 animate-pulse rounded bg-slate-200" />
            ))}
          </div>
        ) : partido && datosEdicion ? (
          <div >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Información del Partido</h2>
              {!modoEdicion ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setModoEdicion(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Editar
                  </button>
                </div>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={handleGuardar}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setModoEdicion(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {modoEdicion ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre del Partido</label>
                  <input
                    type="text"
                    value={datosEdicion.nombrePartido}
                    onChange={(e) =>
                      setDatosEdicion((prev) => (prev ? { ...prev, nombrePartido: e.target.value } : prev))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        setDatosEdicion((prev) => (prev ? { ...prev, ubicacion: e.target.value } : prev))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Modalidad</label>
                    <select
                      value={datosEdicion.modalidad}
                      onChange={(e) =>
                        setDatosEdicion((prev) => (prev ? { ...prev, modalidad: e.target.value } : prev))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Foam">Foam</option>
                      <option value="Cloth">Cloth</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Categoría</label>
                    <select
                      value={datosEdicion.categoria}
                      onChange={(e) =>
                        setDatosEdicion((prev) => (prev ? { ...prev, categoria: e.target.value } : prev))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Mixto">Mixto</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Competencia</label>
                  <select
                    value={datosEdicion.competencia}
                    onChange={(e) =>
                      setDatosEdicion((prev) => (prev ? { ...prev, competencia: e.target.value } : prev))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Sin competencia</option>
                    {competencias.map((competencia) => (
                      <option key={competencia.id} value={competencia.id}>
                        {competencia.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Marcador Local</label>
                    <input
                      type="number"
                      value={datosEdicion.marcadorLocal}
                      onChange={(e) =>
                        setDatosEdicion((prev) =>
                          prev
                            ? {
                                ...prev,
                                marcadorLocal: Number(e.target.value),
                                marcadorModificadoManualmente: true,
                              }
                            : prev,
                        )
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Marcador Visitante</label>
                    <input
                      type="number"
                      value={datosEdicion.marcadorVisitante}
                      onChange={(e) =>
                        setDatosEdicion((prev) =>
                          prev
                            ? {
                                ...prev,
                                marcadorVisitante: Number(e.target.value),
                                marcadorModificadoManualmente: true,
                              }
                            : prev,
                        )
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRecalcular}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Recalcular marcador
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p><strong>Nombre:</strong> {partido.nombrePartido || 'No especificado'}</p>
                <p><strong>Fecha:</strong> {partido.fecha ? new Date(partido.fecha).toLocaleString() : 'No especificada'}</p>
                <p><strong>Ubicación:</strong> {partido.ubicacion || 'No especificada'}</p>
                <p><strong>Estado:</strong> {partido.estado || 'No especificado'}</p>
                <p><strong>Modalidad:</strong> {partido.modalidad || 'No especificada'}</p>
                <p><strong>Categoría:</strong> {partido.categoria || 'No especificada'}</p>
                <p>
                  <strong>Competencia:</strong>{' '}
                  {typeof partido.competencia === 'string'
                    ? partido.competencia
                    : partido.competencia?.nombre || 'No especificada'}
                </p>
                <p>
                  <strong>Marcador:</strong> {partido.marcadorLocal} - {partido.marcadorVisitante}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Seleccioná un partido para ver su información.</p>
        )}
      </div>
    </ModalBase>
  );
};

export default ModalInformacionPartido;
