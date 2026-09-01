import { useState } from 'react';
import { Link } from 'react-router-dom';
import { solicitarResetPassword } from '../services/authService';

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40';

const OlvidePasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await solicitarResetPassword(email.trim());
      // El backend responde igual exista o no la cuenta, así que la pantalla
      // tampoco distingue: mostrar otra cosa revelaría qué emails existen.
      setEnviado(true);
    } catch (err) {
      setError((err as any)?.message || 'No se pudo procesar el pedido. Probá de nuevo.');
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
          <h1 className="mt-4 text-xl font-semibold text-white">Recuperar contraseña</h1>
        </div>

        {enviado ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
              Si ese email está registrado, te mandamos un link para elegir una contraseña nueva.
              Revisá tu casilla (y el spam). El link vence en 1 hora.
            </p>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-brand-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Volver al login
            </Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <p className="text-sm text-slate-200/80">
              Escribí tu email y te mandamos un link para elegir una contraseña nueva.
            </p>

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

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviarme el link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-200/80">
          <Link to="/login" className="font-semibold text-brand-300 underline hover:text-brand-200">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OlvidePasswordPage;
