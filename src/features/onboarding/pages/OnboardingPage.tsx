import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import {
  crearEquipo,
  obtenerOpcionesEquipos,
  solicitarAccesoAEquipo,
  type EquipoOpcion,
} from '../../equipo/services/equipoService';
import { getSolicitudesEdicion } from '../../../shared/features/solicitudes';

type Modo = 'crear' | 'unirme';

const TIPOS_EQUIPO = [
  { value: 'club', label: 'Club' },
  { value: 'academia', label: 'Academia' },
  { value: 'seleccion', label: 'Selección' },
  { value: 'otro', label: 'Otro' },
];

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const inputClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { equipos, loading: cargandoEquipos, recargarEquipos, seleccionarEquipo } = useEquipo();
  const { addToast } = useToast();

  const [modo, setModo] = useState<Modo>('crear');

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('club');
  const [pais, setPais] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<EquipoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null);
  const [equiposPedidos, setEquiposPedidos] = useState<Set<string>>(new Set());

  // Si ya administra un equipo, el onboarding no tiene nada que hacer.
  useEffect(() => {
    if (!cargandoEquipos && equipos.length > 0) {
      navigate('/dashboard', { replace: true });
    }
  }, [cargandoEquipos, equipos.length, navigate]);

  // Pedidos de acceso que ya envió y siguen pendientes.
  const cargarPendientes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const resp = await getSolicitudesEdicion({
        tipo: 'usuario-solicitar-admin-equipo',
        estado: 'pendiente',
        creadoPor: user.id,
        scope: 'mine',
      } as any);
      const ids = (resp.solicitudes || [])
        .map((solicitud: any) => String(solicitud.entidad || solicitud?.datosPropuestos?.equipoId || ''))
        .filter(Boolean);
      setEquiposPedidos(new Set(ids));
    } catch (error) {
      console.error('No se pudieron cargar las solicitudes pendientes', error);
    }
  }, [user?.id]);

  useEffect(() => {
    void cargarPendientes();
  }, [cargarPendientes]);

  // Búsqueda con debounce para no pegarle al backend en cada tecla.
  useEffect(() => {
    if (modo !== 'unirme') return;

    let cancelado = false;
    const timer = window.setTimeout(async () => {
      try {
        setBuscando(true);
        const opciones = await obtenerOpcionesEquipos(busqueda.trim());
        if (!cancelado) setResultados(opciones);
      } catch (error) {
        console.error('Error buscando equipos', error);
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [busqueda, modo]);

  const handleCrear = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorCrear(null);

    if (!nombre.trim()) {
      setErrorCrear('El nombre del equipo es obligatorio');
      return;
    }

    try {
      setCreando(true);
      const equipo = await crearEquipo({
        nombre: nombre.trim(),
        tipo,
        pais: pais.trim(),
      });
      await recargarEquipos();
      seleccionarEquipo(equipo.id);
      addToast({
        type: 'success',
        title: `${equipo.nombre} está listo`,
        message: 'Ya podés cargar tu plantilla. Para inscribirte a una competencia falta que Overtime verifique el equipo.',
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = (error as any)?.message || 'No se pudo crear el equipo';
      setErrorCrear(message);
      addToast({ type: 'error', title: 'No se pudo crear el equipo', message });
    } finally {
      setCreando(false);
    }
  };

  const handleSolicitarAcceso = async (equipo: EquipoOpcion) => {
    try {
      setSolicitandoId(equipo.id);
      await solicitarAccesoAEquipo(equipo.id);
      setEquiposPedidos((prev) => new Set(prev).add(equipo.id));
      addToast({
        type: 'success',
        title: 'Pedido enviado',
        message: `Los administradores de ${equipo.nombre} tienen que aprobarlo. Te avisamos cuando pase.`,
      });
    } catch (error) {
      const message = (error as any)?.message || 'No se pudo enviar el pedido';
      addToast({ type: 'error', title: 'No se pudo enviar el pedido', message });
      // 409 = ya existe una pendiente: reflejarlo igual en la UI.
      if ((error as any)?.status === 409) {
        setEquiposPedidos((prev) => new Set(prev).add(equipo.id));
      }
    } finally {
      setSolicitandoId(null);
    }
  };

  if (cargandoEquipos) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          {user?.nombre ? `Bienvenido, ${user.nombre}` : 'Bienvenido a Overtime'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Para empezar necesitás un equipo. Creá uno nuevo o pedí acceso a uno que ya esté en la plataforma.
        </p>
      </header>

      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setModo('crear')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            modo === 'crear' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Crear un equipo
        </button>
        <button
          type="button"
          onClick={() => setModo('unirme')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            modo === 'unirme' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sumarme a uno existente
        </button>
      </div>

      {modo === 'crear' ? (
        <form className={cardClass} onSubmit={handleCrear}>
          <h2 className="text-lg font-semibold text-slate-900">Datos del equipo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Vas a quedar como administrador. Después podés sumar staff y jugadores desde el panel.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="nombre-equipo">
                Nombre del equipo
              </label>
              <input
                id="nombre-equipo"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
                placeholder="Ej. Dodgeball Club Rosario"
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="tipo-equipo">
                  Tipo
                </label>
                <select
                  id="tipo-equipo"
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value)}
                  className={inputClass}
                >
                  {TIPOS_EQUIPO.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="pais-equipo">
                  País <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  id="pais-equipo"
                  type="text"
                  value={pais}
                  onChange={(event) => setPais(event.target.value)}
                  placeholder="ARG"
                  maxLength={3}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            El equipo queda activo al instante: podés cargar la plantilla, crear amistosos y registrar
            estadísticas. Para <strong>inscribirlo a una competencia</strong> hace falta que un administrador
            de Overtime lo verifique.
          </div>

          {errorCrear ? <p className="mt-4 text-sm text-red-600">{errorCrear}</p> : null}

          <button
            type="submit"
            disabled={creando}
            className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 sm:w-auto"
          >
            {creando ? 'Creando…' : 'Crear equipo'}
          </button>
        </form>
      ) : (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-slate-900">Buscar un equipo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si tu club ya está en Overtime, pedí acceso en vez de crear un duplicado. Los administradores
            actuales del equipo aprueban el pedido (hasta 3 administradores por equipo).
          </p>

          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre del equipo"
            className={`${inputClass} mt-4`}
          />

          <div className="mt-4 space-y-2">
            {buscando ? (
              <p className="py-4 text-sm text-slate-500">Buscando…</p>
            ) : resultados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                {busqueda
                  ? 'No encontramos equipos con ese nombre. Podés crear uno nuevo.'
                  : 'Escribí el nombre de tu equipo para buscarlo.'}
              </p>
            ) : (
              resultados.map((equipo) => {
                const yaPedido = equiposPedidos.has(equipo.id);
                return (
                  <div
                    key={equipo.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{equipo.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {[equipo.tipo, equipo.pais].filter(Boolean).join(' · ') || 'Equipo'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={yaPedido || solicitandoId === equipo.id}
                      onClick={() => handleSolicitarAcceso(equipo)}
                      className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {yaPedido
                        ? 'Pedido enviado'
                        : solicitandoId === equipo.id
                        ? 'Enviando…'
                        : 'Pedir acceso'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {equiposPedidos.size > 0 ? (
            <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Tenés {equiposPedidos.size} {equiposPedidos.size === 1 ? 'pedido' : 'pedidos'} esperando
              aprobación. Cuando te acepten, el equipo aparece en el selector de arriba.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;
