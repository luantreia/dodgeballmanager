import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { crearPartidoAmistoso } from '../../services/partidoService';
import { obtenerOpcionesEquipos, type EquipoOpcion } from '../../../equipo/services/equipoService';

const MODALIDAD_OPCIONES = ['Foam', 'Cloth'] as const;
const CATEGORIA_OPCIONES = ['Masculino', 'Femenino', 'Mixto', 'Libre'] as const;

type ModalidadPartido = (typeof MODALIDAD_OPCIONES)[number];
type CategoriaPartido = (typeof CATEGORIA_OPCIONES)[number];

type CrearFormState = {
  rival: string;
  fecha: string;
  hora: string;
  escenario: string;
  rivalId: string;
  modalidad: ModalidadPartido;
  categoria: CategoriaPartido;
};

type ModalCrearPartidoProps = {
  isOpen: boolean;
  equipoId?: string;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
};

const crearFormDefault = (): CrearFormState => ({
  rival: '',
  fecha: '',
  hora: '',
  escenario: '',
  rivalId: '',
  modalidad: 'Foam',
  categoria: 'Mixto',
});

export const ModalCrearPartido = ({ isOpen, equipoId, onClose, onSuccess }: ModalCrearPartidoProps) => {
  const [form, setForm] = useState<CrearFormState>(crearFormDefault);
  const [equiposOpciones, setEquiposOpciones] = useState<EquipoOpcion[]>([]);
  const [equiposLoading, setEquiposLoading] = useState(false);
  const [rivalSeleccionado, setRivalSeleccionado] = useState<EquipoOpcion | null>(null);
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setForm(crearFormDefault());
    setEquiposOpciones([]);
    setEquiposLoading(false);
    setRivalSeleccionado(null);
    setCrearLoading(false);
    setCrearError(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const buscar = async () => {
      try {
        setEquiposLoading(true);
        const termino = form.rival?.trim?.() ?? '';
        const opciones = await obtenerOpcionesEquipos(termino, equipoId);
        if (!controller.signal.aborted) {
          setEquiposOpciones(opciones);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEquiposLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(buscar, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [form.rival, isOpen, equipoId]);

  if (!isOpen) {
    return null;
  }

  const handleCerrar = () => {
    onClose();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'rival' ? { rivalId: '' } : {}),
    }));
    if (name === 'rival') {
      setRivalSeleccionado(null);
    }
  };

  const handleSeleccionarRival = (equipo: EquipoOpcion) => {
    setForm((prev) => ({ ...prev, rival: equipo.nombre, rivalId: equipo.id }));
    setRivalSeleccionado(equipo);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!equipoId) {
      setCrearError('Seleccioná un equipo antes de crear un partido.');
      return;
    }

    if (!form.rivalId || !form.fecha || !form.modalidad || !form.categoria) {
      setCrearError('Seleccioná un equipo rival, la fecha, modalidad y categoría del partido.');
      return;
    }

    try {
      setCrearLoading(true);
      setCrearError(null);

      await crearPartidoAmistoso({
        equipoId,
        rival: form.rival.trim(),
        fecha: form.fecha,
        hora: form.hora || undefined,
        escenario: form.escenario || undefined,
        rivalId: form.rivalId,
        modalidad: form.modalidad,
        categoria: form.categoria,
      });

      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (error) {
      console.error(error);
      setCrearError('No pudimos crear el partido. Intenta nuevamente.');
    } finally {
      setCrearLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nuevo partido amistoso</h2>
            <p className="text-sm text-slate-500">Completá los datos básicos para agendarlo.</p>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Cerrar
          </button>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="crear-rival">
              Rival
            </label>
            <input
              id="crear-rival"
              name="rival"
              type="text"
              value={form.rival}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Buscar equipo por nombre"
              required
            />
            {equiposLoading ? (
              <p className="mt-2 text-xs text-slate-400">Buscando equipos…</p>
            ) : null}
            {!equiposLoading && equiposOpciones.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No encontramos equipos. Probá con otro nombre.</p>
            ) : null}
            {equiposOpciones.length ? (
              <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {equiposOpciones.map((equipo) => {
                  const seleccionado = rivalSeleccionado?.id === equipo.id;
                  return (
                    <li
                      key={equipo.id}
                      className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${
                        seleccionado ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                      }`}
                      onClick={() => handleSeleccionarRival(equipo)}
                      role="button"
                    >
                      <p className="font-medium text-slate-900">{equipo.nombre}</p>
                      {equipo.pais ? <p className="text-xs text-slate-500">{equipo.pais}</p> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {rivalSeleccionado ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">Rival seleccionado:</p>
              <p>{rivalSeleccionado.nombre}</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="crear-fecha">
                Fecha
              </label>
              <input
                id="crear-fecha"
                name="fecha"
                type="date"
                value={form.fecha}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="crear-hora">
                Hora
              </label>
              <input
                id="crear-hora"
                name="hora"
                type="time"
                value={form.hora}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="crear-escenario">
              Escenario
            </label>
            <input
              id="crear-escenario"
              name="escenario"
              type="text"
              value={form.escenario}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Cancha o lugar (opcional)"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="crear-modalidad">
                Modalidad
              </label>
              <select
                id="crear-modalidad"
                name="modalidad"
                value={form.modalidad}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                required
              >
                {MODALIDAD_OPCIONES.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="crear-categoria">
                Categoría
              </label>
              <select
                id="crear-categoria"
                name="categoria"
                value={form.categoria}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                required
              >
                {CATEGORIA_OPCIONES.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {crearError ? <p className="text-sm text-rose-600">{crearError}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCerrar}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={crearLoading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              {crearLoading ? 'Guardando…' : 'Guardar partido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCrearPartido;
