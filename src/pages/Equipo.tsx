import { useEffect, useState } from 'react';
import EquipoCard from '../components/EquipoCard';
import { useEquipo } from '../context/EquipoContext';
import { actualizarEquipo, getEquipo } from '../api/equipo';
import type { Equipo } from '../types';

const EquipoPage = () => {
  const { equipoSeleccionado, recargarEquipos } = useEquipo();
  const [detalleEquipo, setDetalleEquipo] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    logoUrl: '',
  });

  useEffect(() => {
    const equipoId = equipoSeleccionado?.id;
    if (!equipoId) {
      setDetalleEquipo(null);
      setFormData({ nombre: '', descripcion: '', logoUrl: '' });
      return;
    }

    let isCancelled = false;

    const fetchEquipo = async () => {
      try {
        setLoading(true);
        const equipo = await getEquipo(equipoId);
        if (isCancelled) return;
        setDetalleEquipo(equipo);
        setFormData({
          nombre: equipo.nombre,
          descripcion: equipo.descripcion ?? '',
          logoUrl: equipo.logoUrl ?? '',
        });
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          setFeedback('No pudimos cargar los datos del equipo.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchEquipo();

    return () => {
      isCancelled = true;
    };
  }, [equipoSeleccionado?.id]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!equipoSeleccionado) return;

    try {
      setSaving(true);
      await actualizarEquipo(equipoSeleccionado.id, formData);
      setFeedback('Datos actualizados correctamente.');
      await recargarEquipos();
    } catch (error) {
      console.error(error);
      setFeedback('No pudimos guardar los cambios. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!equipoSeleccionado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">No hay equipo seleccionado</h1>
        <p className="mt-2 text-sm text-slate-500">
          Elegí un equipo desde el selector superior para ver y editar la información.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Gestión del equipo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Actualizá la información general, el staff y los datos visibles para tus jugadores.
        </p>
      </header>

      {detalleEquipo ? <EquipoCard equipo={detalleEquipo} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Detalles del equipo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Estos datos se muestran a tus jugadores y organizadores de competencias.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="nombre">
              Nombre del equipo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              value={formData.nombre}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Overtime Tigers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="descripcion">
              Descripción
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={3}
              value={formData.descripcion}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Resumen del equipo, logros o estilo de juego"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="logoUrl">
              URL del logo
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              value={formData.logoUrl}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center justify-between">
            {feedback ? <span className="text-sm text-slate-500">{feedback}</span> : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>

      {loading ? <p className="text-sm text-slate-500">Actualizando información…</p> : null}
    </div>
  );
};

export default EquipoPage;
