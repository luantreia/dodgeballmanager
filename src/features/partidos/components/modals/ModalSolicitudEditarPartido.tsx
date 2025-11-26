import React, { useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { crearSolicitudEdicion } from '../../../../shared/features/solicitudes/services/solicitudesEdicionService';

interface ModalSolicitudEditarPartidoProps {
  isOpen: boolean;
  onClose: () => void;
  partidoId: string;
}

const ModalSolicitudEditarPartido: React.FC<ModalSolicitudEditarPartidoProps> = ({
  isOpen,
  onClose,
  partidoId,
}) => {
  const { addToast } = useToast();
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await crearSolicitudEdicion({
        tipo: 'editarPartidoCompetencia',
        entidad: partidoId,
        datosPropuestos: {
          mensaje,
        },
      });
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'La solicitud se ha enviado correctamente.' });
      onClose();
      setMensaje('');
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
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Descripción de la solicitud
          </label>
          <textarea
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            rows={4}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Describe los cambios que deseas realizar..."
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
