import { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { reenviarVerificacion } from '../../features/auth/services/authService';
import { useToast } from './Toast/ToastProvider';

/**
 * Aviso persistente para cuentas con el email sin confirmar. No bloquea el uso
 * del panel: solo recuerda y ofrece reenviar el mail.
 */
const EmailVerificacionBanner = () => {
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [oculto, setOculto] = useState(false);

  // `emailVerificado` puede venir undefined desde un backend viejo: en ese caso
  // no mostramos nada en vez de acusar a todo el mundo de no estar verificado.
  if (!isAuthenticated || oculto || user?.emailVerificado !== false) {
    return null;
  }

  const handleReenviar = async () => {
    try {
      setEnviando(true);
      const respuesta = await reenviarVerificacion();
      addToast({
        type: respuesta.delivered ? 'success' : 'info',
        title: respuesta.delivered ? 'Mail reenviado' : 'Envío de mails no configurado',
        message: respuesta.message,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'No se pudo reenviar',
        message: (err as any)?.message || 'Probá de nuevo en un rato.',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <p className="text-sm text-amber-900">
          Confirmá tu email <strong>{user?.email}</strong> para asegurar el acceso a tu cuenta.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReenviar}
            disabled={enviando}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Reenviar mail'}
          </button>
          <button
            type="button"
            onClick={() => setOculto(true)}
            className="rounded-lg px-2 py-1.5 text-sm text-amber-700 transition hover:text-amber-900"
            aria-label="Ocultar aviso"
          >
            Ocultar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificacionBanner;
