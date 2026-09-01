import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
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

const RegistroPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

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
      await register(nombre.trim(), email.trim(), password);
      addToast({
        type: 'success',
        title: 'Cuenta creada',
        message: 'Ahora armá tu equipo para empezar.',
      });
      // Recién registrado: todavía no administra ningún equipo.
      navigate('/onboarding', { replace: true });
    } catch (err) {
      const detalles = (err as any)?.details;
      const message =
        detalles?.errors?.[0]?.message ||
        (err as any)?.message ||
        'No se pudo crear la cuenta.';
      setError(message);
      addToast({ type: 'error', title: 'No se pudo crear la cuenta', message });
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
          <h1 className="mt-4 text-xl font-semibold text-white">Crear cuenta</h1>
          <p className="text-center text-sm text-slate-200/80">
            Panel para directores técnicos, entrenadores y staff
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="nombre">
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              autoComplete="name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
              minLength={2}
              placeholder="Tu nombre y apellido"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="tu@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
              Contraseña
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

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-200/80">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-semibold text-brand-300 underline hover:text-brand-200">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegistroPage;
