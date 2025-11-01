import { useEffect, useState } from 'react';
import EquipoCard from '../../../shared/components/EquipoCard/EquipoCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { actualizarEquipo, getEquipo } from '../services/equipoService';
import type { Equipo } from '../../../types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { Input, Textarea } from '../../../shared/components/ui';

const EquipoPage = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado, recargarEquipos } = useEquipo();
  const [detalleEquipo, setDetalleEquipo] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  

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
          addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar los datos del equipo.' });
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
      addToast({ type: 'success', title: 'Guardado', message: 'Datos del equipo actualizados' });
      await recargarEquipos();
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error al guardar', message: 'No pudimos guardar los cambios' });
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
          <Input
            id="nombre"
            name="nombre"
            label="Nombre del equipo"
            type="text"
            required
            value={formData.nombre}
            onChange={handleChange as any}
            placeholder="Overtime Tigers"
          />

          <Textarea
            id="descripcion"
            name="descripcion"
            label="Descripción"
            rows={3}
            value={formData.descripcion}
            onChange={handleChange as any}
            placeholder="Resumen del equipo, logros o estilo de juego"
          />

          <Input
            id="logoUrl"
            name="logoUrl"
            label="URL del logo"
            type="url"
            value={formData.logoUrl}
            onChange={handleChange as any}
            placeholder="https://..."
          />

          <div className="flex items-center justify-end">
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
