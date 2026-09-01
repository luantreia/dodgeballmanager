import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../services/authService';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

// Mismas reglas que valida el backend en validators/userValidator.js
const validarPassword = (password: string): string | null => {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir una mayúscula';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir una minúscula';
  if (!/\d/.test(password)) return 'La contraseña debe incluir un número';
  return null;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40';

const ResetPasswordPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('El link no es válido. Pedí uno nuevo desde "Olvidé mi contraseña".');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const errorPassword = validarPassword(password);
    if (errorPassword) {
      setError(errorPassword);
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, password);
      addToast({
        type: 'success',
        title: 'Contraseña actualizada',
        message: 'Ya podés iniciar sesión con tu contraseña nueva.',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      setError((err as any)?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 font-bold text-white">
            DT
          </div>
          <h1 className="mt-4 text-xl font-semibold text-white">Elegí una contraseña nueva</h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
              Contraseña nueva
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="Mínimo 8 caracteres"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-300/70">
              Al menos 8 caracteres, con mayúscula, minúscula y número.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="confirmPassword">
              Repetir contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className={inputClass}
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-200/80">
          <Link
            to="/olvide-password"
            className="font-semibold text-brand-300 underline hover:text-brand-200"
          >
            Pedir un link nuevo
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
