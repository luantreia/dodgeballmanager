import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { verificarEmail } from '../services/authService';
import { useAuth } from '../../../app/providers/AuthContext';

type Estado = 'verificando' | 'ok' | 'error';

const VerificarEmailPage = () => {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, refreshProfile } = useAuth();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('');
  // StrictMode monta dos veces en desarrollo y el token es de un solo uso:
  // sin esto el segundo intento fallaría siempre.
  const yaIntentado = useRef(false);

  useEffect(() => {
    if (yaIntentado.current) return;
    yaIntentado.current = true;

    const verificar = async () => {
      if (!token) {
        setEstado('error');
        setMensaje('El link no es válido.');
        return;
      }

      try {
        await verificarEmail(token);
        setEstado('ok');
        if (isAuthenticated) {
          await refreshProfile();
        }
      } catch (err) {
        setEstado('error');
        setMensaje((err as any)?.message || 'No pudimos verificar tu email.');
      }
    };

    void verificar();
  }, [token, isAuthenticated, refreshProfile]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 font-bold text-white">
          DT
        </div>

        {estado === 'verificando' ? (
          <>
            <h1 className="mt-4 text-xl font-semibold text-white">Verificando tu email…</h1>
            <span className="mt-6 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-400 border-t-transparent" />
          </>
        ) : estado === 'ok' ? (
          <>
            <h1 className="mt-4 text-xl font-semibold text-white">Email verificado</h1>
            <p className="mt-2 text-sm text-slate-200/80">
              Listo, tu dirección quedó confirmada.
            </p>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="mt-6 block w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold text-white">No pudimos verificar</h1>
            <p className="mt-2 text-sm text-rose-200">{mensaje}</p>
            <p className="mt-2 text-sm text-slate-200/80">
              Podés pedir un link nuevo desde el panel, en el aviso de arriba.
            </p>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="mt-6 block w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerificarEmailPage;
