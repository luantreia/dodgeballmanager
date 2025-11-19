import { useEffect, useState, useCallback } from 'react';
import EquipoCard from '../../../shared/components/EquipoCard/EquipoCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { actualizarEquipo, getEquipo } from '../services/equipoService';
import type { Equipo } from '../../../shared/utils/types/types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { Input, Textarea } from '../../../shared/components/ui';
import ModalGestionAdministradoresEntidad from '../../../shared/components/modalGestionAdministradoresEntidad/ModalGestionAdministradoresEntidad';
import { agregarAdminEquipo, quitarAdminEquipo, getAdminsEquipo, getUsuarioById } from '../../auth/services/usersService';

const EquipoPage = () => {
  const { addToast } = useToast();
  const { equipoSeleccionado, recargarEquipos } = useEquipo();
  const [detalleEquipo, setDetalleEquipo] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Invitaciones movidas a JugadoresPage

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    logoUrl: '',
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<Map<string, any>>(new Map());

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
        // Cargar administradores
        const adminIds = await getAdminsEquipo(equipoId);
        const userPromises = adminIds.map(async (id) => {
          return await getUsuarioById(id).catch(() => ({ id, nombre: id, email: 'Usuario no encontrado' }));
        });
        const users = await Promise.all(userPromises);
        const adminUsersMap = new Map<string, any>();
        users.forEach((user) => {
          adminUsersMap.set(user.id, user);
        });
        setAdminUsers(adminUsersMap);
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
  }, [equipoSeleccionado?.id, addToast]);

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

  const refreshAdmins = async () => {
    if (!equipoSeleccionado) return;
    try {
      const adminIds = await getAdminsEquipo(equipoSeleccionado.id);
      const userPromises = adminIds.map(async (id) => {
        return await getUsuarioById(id).catch(() => ({ id, nombre: id, email: 'Usuario no encontrado' }));
      });
      const users = await Promise.all(userPromises);
      const adminUsersMap = new Map<string, any>();
      users.forEach((user) => {
        adminUsersMap.set(user.id, user);
      });
      setAdminUsers(adminUsersMap);
    } catch (error) {
      console.error('Error refreshing admins:', error);
    }
  };

  const addAdminFunction = async (entityId: string, { email }: { email: string }) => {
    await agregarAdminEquipo(entityId, email);
    await refreshAdmins();
    addToast({ type: 'success', title: 'Agregado', message: 'Administrador agregado' });
  };

  const getAdminsFunction = useCallback(async (entityId: string) => {
    try {
      // Get fresh admin IDs directly from backend
      const adminIds = await getAdminsEquipo(entityId);

      if (!adminIds || adminIds.length === 0) {
        return { administradores: [] };
      }

      // Load user details for all admins
      const userPromises = adminIds.map(async (id: string) => {
        try {
          const user = await getUsuarioById(id);
          return {
            _id: id,
            nombre: user.nombre || 'Sin nombre',
            email: user.email || 'Sin email'
          };
        } catch (error) {
          return {
            _id: id,
            nombre: 'Usuario no encontrado',
            email: 'N/A'
          };
        }
      });

      const administradores = await Promise.all(userPromises);
      return { administradores };

    } catch (error) {
      return { administradores: [] };
    }
  }, []);

  const removeAdminFunction = async (entityId: string, adminId: string) => {
    await quitarAdminEquipo(entityId, adminId);
    await refreshAdmins();
    addToast({ type: 'success', title: 'Quitado', message: 'Administrador removido' });
  };

  // Flujo de invitar jugador movido a JugadoresPage

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

      {/* Invitaciones movidas a JugadoresPage */}

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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Administradores</h3>
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Gestionar
          </button>
        </div>
        <ModalGestionAdministradoresEntidad
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          entityId={equipoSeleccionado.id}
          title="Administradores del Equipo"
          addFunction={addAdminFunction}
          getFunction={getAdminsFunction}
          removeFunction={removeAdminFunction}
        />
      </section>

      {loading ? <p className="text-sm text-slate-500">Actualizando información…</p> : null}

      {/* Modal de invitación movido a JugadoresPage */}
    </div>
  );
};

export default EquipoPage;
