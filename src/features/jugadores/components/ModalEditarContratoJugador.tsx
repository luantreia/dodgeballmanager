import React, { useMemo, useState } from 'react';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
import { Select } from '../../../shared/components/ui';
import { crearSolicitudEdicion } from '../services/solicitudesEdicionService';

type Props = {
  isOpen: boolean;
  contratoId: string;
  initial: {
    fechaInicio?: string;
    fechaFin?: string;
    rol?: string;
    estadoBackend: 'aceptado' | 'baja';
  };
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

const ModalEditarContratoJugador: React.FC<Props> = ({ isOpen, onClose, contratoId, initial, onSaved }) => {
  const [form, setForm] = useState({
    fechaInicio: initial.fechaInicio ?? '',
    fechaFin: initial.fechaFin ?? '',
    rol: initial.rol ?? 'jugador',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const estadoDeseado = useMemo(() => (form.fechaFin ? 'baja' : 'aceptado'), [form.fechaFin]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement> = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    const cambios: Record<string, string | null> = {};
    const fechaInicioOriginal = initial.fechaInicio ?? '';
    const fechaFinOriginal = initial.fechaFin ?? '';
    const rolOriginal = initial.rol ?? 'jugador';

    if (form.fechaInicio !== fechaInicioOriginal) cambios.desde = form.fechaInicio || null;
    if (form.fechaFin !== fechaFinOriginal) cambios.hasta = form.fechaFin || null;
    if (form.rol !== rolOriginal) cambios.rol = form.rol;
    if (estadoDeseado !== initial.estadoBackend) cambios.estado = estadoDeseado;

    if (Object.keys(cambios).length === 0) {
      setError('No realizaste cambios en el contrato.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      await crearSolicitudEdicion({
        tipo: 'contratoJugadorEquipo',
        entidad: contratoId,
        datosPropuestos: cambios,
      });
      setSuccess('Solicitud enviada para revisión.');
      await onSaved?.();
    } catch (err) {
      console.error(err);
      setError('No pudimos crear la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Editar fechas del contrato" size="md">
      <p className="mt-1 text-sm text-slate-500">
        Ingresá las fechas y enviaremos una solicitud de edición para que sea aprobada.
      </p>
      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <Select
          id="rol"
          name="rol"
          label="Rol en el equipo"
          value={form.rol}
          onChange={handleChange as any}
          options={[
            { value: 'jugador', label: 'Jugador' },
            { value: 'entrenador', label: 'Entrenador' },
          ]}
        />

        <div>
          <label htmlFor="fechaInicio" className="block text-sm font-medium text-slate-700">
            Fecha de inicio
          </label>
          <input
            id="fechaInicio"
            name="fechaInicio"
            type="date"
            value={form.fechaInicio}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label htmlFor="fechaFin" className="block text-sm font-medium text-slate-700">
            Fecha de finalización
          </label>
          <input
            id="fechaFin"
            name="fechaFin"
            type="date"
            value={form.fechaFin}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Cerrar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
          >
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

export default ModalEditarContratoJugador;
