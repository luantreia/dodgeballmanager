import { useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthContext';
import { actualizarUsuario, cambiarPassword } from '../services/usuarioService';
import { Input } from '../../../shared/components/ui';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import SolicitudModal from '../../../shared/components/SolicitudModal/SolicitudModal';
import { SolicitudEdicionTipo } from '../../../types/solicitudesEdicion';
import { authFetch } from '../../../utils/authFetch';

const PerfilPage = () => {
  const { user, refreshProfile, logout } = useAuth();
  const { addToast } = useToast();
  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingPerfil, setSavingPerfil] = useState(false);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [isSolicitudOpen, setIsSolicitudOpen] = useState(false);
  const [prefillTipo, setPrefillTipo] = useState<SolicitudEdicionTipo | undefined>(undefined);
  const [prefillDatos, setPrefillDatos] = useState<Record<string, any>>({});
  const [jugadoresCount, setJugadoresCount] = useState<number | null>(null);
  const [equiposCount, setEquiposCount] = useState<number | null>(null);

  const refreshCounts = async () => {
    try {
      const [jugadores, equipos] = await Promise.all([
        authFetch<any[]>('/jugadores/admin'),
        authFetch<any[]>('/equipos/admin'),
      ]);
      setJugadoresCount(Array.isArray(jugadores) ? jugadores.length : 0);
      setEquiposCount(Array.isArray(equipos) ? equipos.length : 0);
    } catch (_) {
      setJugadoresCount(0);
      setEquiposCount(0);
    }
  };

  useEffect(() => {
    if (user) {
      void refreshCounts();
    }
  }, [user?.id]);

  const openSolicitud = (tipo: SolicitudEdicionTipo) => {
    setPrefillTipo(tipo);
    if (tipo === 'usuario-crear-jugador') {
      setPrefillDatos({ nombre: '', alias: '', fechaNacimiento: '', genero: '', nacionalidad: '' });
    } else if (tipo === 'usuario-crear-equipo') {
      setPrefillDatos({ nombre: '', tipo: 'club', pais: '', descripcion: '', sitioWeb: '' });
    } else {
      setPrefillDatos({});
    }
    setIsSolicitudOpen(true);
  };

  const handleCloseSolicitud = () => {
    setIsSolicitudOpen(false);
    setPrefillTipo(undefined);
    setPrefillDatos({});
  };

  const handlePerfilSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSavingPerfil(true);
      await actualizarUsuario({ nombre, email });
      await refreshProfile();
      setFeedback('Datos actualizados correctamente.');
      addToast({ type: 'success', title: 'Perfil actualizado', message: 'Tus datos se guardaron correctamente' });
    } catch (error) {
      console.error(error);
      setFeedback('No pudimos actualizar tu perfil.');
      addToast({ type: 'error', title: 'Error', message: 'No pudimos actualizar tu perfil' });
    } finally {
      setSavingPerfil(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSavingPassword(true);
      await cambiarPassword({ passwordActual, passwordNueva });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordFeedback('Contraseña actualizada correctamente.');
      addToast({ type: 'success', title: 'Contraseña actualizada', message: 'Se cambió tu contraseña' });
    } catch (error) {
      console.error(error);
      setPasswordFeedback('No pudimos cambiar la contraseña.');
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cambiar la contraseña' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Sesión no disponible</h1>
        <p className="mt-2 text-sm text-slate-500">Ingresá nuevamente para administrar tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mi cuenta</h1>
          <p className="text-sm text-slate-500">Actualizá tus datos personales y credenciales de acceso.</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Cerrar sesión
        </button>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handlePerfilSubmit}>
          <h2 className="text-lg font-semibold text-slate-900">Datos personales</h2>
          <p className="mt-1 text-sm text-slate-500">Esta información se muestra en las áreas de gestión interna.</p>

          <div className="mt-4 space-y-4">
            <Input
              id="nombre"
              label="Nombre completo"
              type="text"
              value={nombre}
              onChange={(event) => setNombre((event.target as HTMLInputElement).value)}
              required
            />

            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail((event.target as HTMLInputElement).value)}
              required
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            {feedback ? <span className="text-sm text-slate-500">{feedback}</span> : null}
            <button
              type="submit"
              disabled={savingPerfil}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
            >
              {savingPerfil ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>

        <form className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handlePasswordSubmit}>
          <h2 className="text-lg font-semibold text-slate-900">Cambiar contraseña</h2>
          <p className="mt-1 text-sm text-slate-500">Usá una clave segura y distinta en cada temporada.</p>

          <div className="mt-4 space-y-4">
            <Input
              id="passwordActual"
              label="Contraseña actual"
              type="password"
              value={passwordActual}
              onChange={(event) => setPasswordActual((event.target as HTMLInputElement).value)}
              required
            />

            <Input
              id="passwordNueva"
              label="Nueva contraseña"
              type="password"
              value={passwordNueva}
              onChange={(event) => setPasswordNueva((event.target as HTMLInputElement).value)}
              required
            />
          </div>

          <div className="mt-4 flex items-center justify_between">
            {passwordFeedback ? <span className="text-sm text-slate-500">{passwordFeedback}</span> : null}
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mis Jugadores</h2>
              <p className="mt-1 text-sm text-slate-500">Jugadores que administrás o creaste.</p>
            </div>
            <div className="text-right text-2xl font-bold text-slate-900">{jugadoresCount ?? '—'}</div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => openSolicitud('usuario-crear-jugador')}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Agregar jugador
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mis Equipos</h2>
              <p className="mt-1 text-sm text-slate-500">Equipos que administrás o creaste.</p>
            </div>
            <div className="text-right text-2xl font-bold text-slate-900">{equiposCount ?? '—'}</div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => openSolicitud('usuario-crear-equipo')}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Agregar equipo
            </button>
          </div>
        </div>
      </section>

      {isSolicitudOpen && (
        <SolicitudModal
          isOpen={isSolicitudOpen}
          contexto={{ contexto: 'usuario', entidadId: undefined }}
          onClose={handleCloseSolicitud}
          onSuccess={refreshCounts}
          prefillTipo={prefillTipo}
          prefillDatos={prefillDatos}
        />
      )}
    </div>
  );
};

export default PerfilPage;
