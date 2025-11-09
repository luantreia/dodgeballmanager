import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import { useToast } from '../../../shared/components/Toast/ToastProvider';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
      addToast({ type: 'success', title: 'Sesión iniciada', message: 'Bienvenido/a' });
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      const message = (err as any)?.message || 'Credenciales inválidas o servicio no disponible.';
      setError(message);
      addToast({ type: 'error', title: 'No se pudo iniciar sesión', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 font-bold text-white">
            OT
          </div>
          <h1 className="mt-4 text-xl font-semibold text-white">Overtime Manager</h1>
          <p className="text-sm text-slate-200/80">Panel exclusivo para managers y staff</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              placeholder="manager@overtime.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/50 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
