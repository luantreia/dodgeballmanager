import React, { useState } from 'react';
import { Input } from '../../../shared/components/ui';
import SolicitudModal from '../../../shared/components/SolicitudModal/SolicitudModal';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { useEquipo } from '../../../app/providers/EquipoContext';
import {
  crearJugador,
  generarInvitacion,
  armarLinkInvitacion,
  type JugadorCreado,
} from '../services/jugadorService';

type Props = {
  equipoId: string;
  onSuccess?: () => void;
};

const GENEROS: Array<{ value: 'masculino' | 'femenino' | 'otro'; label: string }> = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
];

const CrearJugadorSection: React.FC<Props> = ({ equipoId, onSuccess }) => {
  const { addToast } = useToast();
  const { equipoSeleccionado } = useEquipo();

  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [alias, setAlias] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [genero, setGenero] = useState<'masculino' | 'femenino' | 'otro'>('otro');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jugadorCreado, setJugadorCreado] = useState<JugadorCreado | null>(null);
  const [linkInvitacion, setLinkInvitacion] = useState<string | null>(null);
  const [generandoLink, setGenerandoLink] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [abrirFichaje, setAbrirFichaje] = useState(false);

  const limpiar = () => {
    setNombre('');
    setAlias('');
    setFechaNacimiento('');
    setGenero('otro');
    setError(null);
    setJugadorCreado(null);
    setLinkInvitacion(null);
    setCopiado(false);
  };

  const handleCrear = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      setGuardando(true);
      const jugador = await crearJugador({
        nombre: nombre.trim(),
        alias: alias.trim() || undefined,
        fechaNacimiento: fechaNacimiento || undefined,
        genero,
      });
      setJugadorCreado(jugador);
      addToast({
        type: 'success',
        title: 'Jugador creado',
        message: `${jugador.nombre} ya existe en Overtime. Ahora podés ficharlo o invitarlo.`,
      });
      onSuccess?.();
    } catch (err) {
      const message = (err as any)?.message || 'No se pudo crear el jugador';
      setError(message);
      addToast({ type: 'error', title: 'No se pudo crear el jugador', message });
    } finally {
      setGuardando(false);
    }
  };

  const handleGenerarLink = async () => {
    if (!jugadorCreado) return;
    try {
      setGenerandoLink(true);
      const { token } = await generarInvitacion(jugadorCreado._id);
      setLinkInvitacion(armarLinkInvitacion(token));
    } catch (err) {
      const message = (err as any)?.message || 'No se pudo generar la invitación';
      addToast({ type: 'error', title: 'No se pudo generar la invitación', message });
    } finally {
      setGenerandoLink(false);
    }
  };

  const handleCopiar = async () => {
    if (!linkInvitacion) return;
    try {
      await navigator.clipboard.writeText(linkInvitacion);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      addToast({
        type: 'error',
        title: 'No se pudo copiar',
        message: 'Copiá el link a mano desde el cuadro.',
      });
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Crear jugador nuevo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si el jugador todavía no existe en Overtime, cargalo acá y después mandale el link para
            que reclame su perfil.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAbierto((valor) => !valor);
            if (abierto) limpiar();
          }}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          {abierto ? 'Cerrar' : 'Nuevo jugador'}
        </button>
      </div>

      {abierto ? (
        jugadorCreado ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">{jugadorCreado.nombre} quedó creado.</p>
              <p className="mt-1">
                Todavía no forma parte de tu plantilla: fichalo para abrir el contrato.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAbrirFichaje(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Fichar en {equipoSeleccionado?.nombre || 'mi equipo'}
              </button>
              <button
                type="button"
                onClick={handleGenerarLink}
                disabled={generandoLink || Boolean(linkInvitacion)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
              >
                {generandoLink
                  ? 'Generando…'
                  : linkInvitacion
                  ? 'Link generado'
                  : 'Generar link de invitación'}
              </button>
              <button
                type="button"
                onClick={limpiar}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
              >
                Cargar otro jugador
              </button>
            </div>

            {linkInvitacion ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Mandale este link al jugador. Vence en 7 días y sirve una sola vez.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={linkInvitacion}
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleCopiar}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                  >
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleCrear}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="nuevo-jugador-nombre"
                label="Nombre completo"
                value={nombre}
                onChange={(event) => setNombre((event.target as HTMLInputElement).value)}
                placeholder="Ej. Juan Pérez"
              />
              <Input
                id="nuevo-jugador-alias"
                label="Alias (opcional)"
                value={alias}
                onChange={(event) => setAlias((event.target as HTMLInputElement).value)}
                placeholder="Ej. Juanchi"
              />
              <Input
                id="nuevo-jugador-nacimiento"
                label="Fecha de nacimiento (opcional)"
                type="date"
                value={fechaNacimiento}
                onChange={(event) => setFechaNacimiento((event.target as HTMLInputElement).value)}
              />
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="nuevo-jugador-genero"
                >
                  Género
                </label>
                <select
                  id="nuevo-jugador-genero"
                  value={genero}
                  onChange={(event) => setGenero(event.target.value as typeof genero)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {GENEROS.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {guardando ? 'Creando…' : 'Crear jugador'}
            </button>
          </form>
        )
      ) : null}

      <SolicitudModal
        isOpen={abrirFichaje}
        contexto={{ contexto: 'equipo', entidadId: equipoId }}
        onClose={() => setAbrirFichaje(false)}
        onSuccess={() => {
          setAbrirFichaje(false);
          onSuccess?.();
        }}
        prefillTipo={'jugador-equipo-crear'}
        prefillDatos={{
          jugadorId: jugadorCreado?._id,
          jugadorNombre: jugadorCreado?.nombre,
          jugadorAlias: jugadorCreado?.alias,
          equipoId,
          equipoNombre: equipoSeleccionado?.nombre,
        }}
      />
    </section>
  );
};

export default CrearJugadorSection;
