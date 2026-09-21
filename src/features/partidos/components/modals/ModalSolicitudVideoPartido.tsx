import React, { useState } from 'react';
import ModalBase from '../../../../shared/components/ModalBase/ModalBase';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import { crearSolicitudEdicion } from '../../../../shared/features/solicitudes/services/solicitudesEdicionService';
import { extraerYoutubeId } from '../../../../shared/utils/youtube';

interface ModalSolicitudVideoPartidoProps {
  isOpen: boolean;
  onClose: () => void;
  partidoId: string;
}

const ModalSolicitudVideoPartido: React.FC<ModalSolicitudVideoPartidoProps> = ({
  isOpen,
  onClose,
  partidoId,
}) => {
  const { addToast } = useToast();
  const [videoUrl, setVideoUrl] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraerYoutubeId(videoUrl)) {
      addToast({ type: 'info', title: 'Link inválido', message: 'Pegá un link de YouTube válido.' });
      return;
    }

    setLoading(true);
    try {
      await crearSolicitudEdicion({
        tipo: 'editarPartidoVideo',
        entidad: partidoId,
        datosPropuestos: {
          videoUrl: videoUrl.trim(),
          mensaje: mensaje.trim() || undefined,
        },
      });
      addToast({ type: 'success', title: 'Solicitud enviada', message: 'La organización va a revisar el video.' });
      onClose();
      setVideoUrl('');
      setMensaje('');
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'Error al enviar la solicitud.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Solicitar video del partido">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este partido pertenece a competencia. El video lo carga la organización a partir de tu solicitud.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700">Link de YouTube</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Comentario (opcional)</label>
          <textarea
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            rows={3}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Ej: es el video en vivo, sigue grabando después de terminado el partido..."
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

export default ModalSolicitudVideoPartido;
