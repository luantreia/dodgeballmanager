import React, { useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { crearSolicitudEdicion } from '../../../../shared/features/solicitudes/services/solicitudesEdicionService';

interface ModalSolicitudEditarPartidoProps {
  isOpen: boolean;
  onClose: () => void;
  partidoId: string;
  esCompetencia?: boolean;
}

const ModalSolicitudEditarPartido: React.FC<ModalSolicitudEditarPartidoProps> = ({
  isOpen,
  onClose,
  partidoId,
  esCompetencia = false,
}) => {
  const { addToast } = useToast();
  const [mensaje, setMensaje] = useState('');
  const [campos, setCampos] = useState<string[]>([]);
  const [prioridad, setPrioridad] = useState<'baja' | 'media' | 'alta'>('media');
  const [loading, setLoading] = useState(false);

  const opcionesCampo = [
    { value: 'resultado', label: 'Resultado / marcador' },
    { value: 'fecha_hora', label: 'Fecha y hora' },
    { value: 'ubicacion', label: 'Ubicación' },
    { value: 'alineacion', label: 'Alineación' },
    { value: 'sets', label: 'Sets' },
    { value: 'estadisticas', label: 'Estadísticas' },
    { value: 'estado', label: 'Estado del partido' },
    { value: 'nombre', label: 'Nombre del partido' },
  ];

  const toggleCampo = (campo: string) => {
    setCampos((prev) => (prev.includes(campo) ? prev.filter((c) => c !== campo) : [...prev, campo]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) {
      addToast({ type: 'info', title: 'Falta detalle', message: 'Describí el problema que detectaste.' });
      return;
    }

    if (!campos.length) {
      addToast({ type: 'info', title: 'Faltan campos', message: 'Seleccioná al menos un tipo de cambio.' });
      return;
    }

    setLoading(true);
    try {
      await crearSolicitudEdicion({
        tipo: 'editarPartidoCompetencia',
        entidad: partidoId,
        datosPropuestos: {
          mensaje: mensaje.trim(),
          camposSolicitados: campos,
          prioridad,
          origen: 'partidos-page',
        },
      });
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'La solicitud se ha enviado correctamente.' });
      onClose();
      setMensaje('');
      setCampos([]);
      setPrioridad('media');
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'Error al enviar la solicitud.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Solicitar Edición de Partido">
      <form onSubmit={handleSubmit} className="space-y-4">
        {esCompetencia ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este partido pertenece a competencia. Los cambios se gestionan por solicitud para validación de organización.
          </p>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700">Qué necesitás corregir</label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcionesCampo.map((opcion) => (
              <label key={opcion.value} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={campos.includes(opcion.value)}
                  onChange={() => toggleCampo(opcion.value)}
                />
                <span>{opcion.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Prioridad</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as 'baja' | 'media' | 'alta')}
          >
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Descripción de la solicitud
          </label>
          <textarea
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            rows={4}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Describe qué está mal y cuál debería ser el dato correcto..."
            required
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

export default ModalSolicitudEditarPartido;
