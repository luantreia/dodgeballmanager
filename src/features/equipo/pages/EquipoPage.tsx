import { useEffect, useState, useCallback } from 'react';
import EquipoCard from '../../../shared/components/EquipoCard/EquipoCard';
import { useEquipo } from '../../../app/providers/EquipoContext';
import {
  getRolePresetPermissions,
  TEAM_MEMBER_ROLE_OPTIONS,
  TEAM_PERMISSION_OPTIONS,
  actualizarEquipo,
  actualizarMiembroEquipo,
  buscarUsuarioPorEmail,
  crearMiembroEquipo,
  eliminarMiembroEquipo,
  getEquipo,
  listarMiembrosEquipo,
  type TeamMember,
  type TeamMemberRole,
  type TeamPermission,
} from '../services/equipoService';
import type { Equipo } from '../../../shared/utils/types/types';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { Input, Textarea } from '../../../shared/components/ui';
import ModalGestionAdministradoresEntidad from '../../../shared/components/modalGestionAdministradoresEntidad/ModalGestionAdministradoresEntidad';
import ModalBase from '../../../shared/components/ModalBase/ModalBase';
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
  const [miembros, setMiembros] = useState<TeamMember[]>([]);
  const [miembroUsers, setMiembroUsers] = useState<Map<string, { nombre?: string; email?: string }>>(new Map());
  const [loadingMiembros, setLoadingMiembros] = useState(false);
  const [savingMiembro, setSavingMiembro] = useState(false);
  const [nuevoMiembroEmail, setNuevoMiembroEmail] = useState('');
  const [nuevoMiembroRol, setNuevoMiembroRol] = useState<TeamMemberRole>('video_analista');
  const [nuevoMiembroPermisos, setNuevoMiembroPermisos] = useState<TeamPermission[]>(['stats.capture']);
  const [confirmPresetOpen, setConfirmPresetOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    usuarioId: string;
    nextRole: TeamMemberRole;
  } | null>(null);

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

  const refreshMiembros = useCallback(async () => {
    if (!equipoSeleccionado?.id) {
      setMiembros([]);
      return;
    }

    try {
      setLoadingMiembros(true);
      const data = await listarMiembrosEquipo(equipoSeleccionado.id);
      setMiembros(data);

      const usuarios = await Promise.all(
        data.map(async (miembro) => {
          try {
            const u = await getUsuarioById(miembro.usuarioId);
            return [miembro.usuarioId, { nombre: u.nombre, email: u.email }] as const;
          } catch (_error) {
            return [miembro.usuarioId, { nombre: miembro.usuarioId, email: '' }] as const;
          }
        })
      );

      const map = new Map<string, { nombre?: string; email?: string }>();
      usuarios.forEach(([id, userInfo]) => map.set(id, userInfo));
      setMiembroUsers(map);
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos cargar los miembros del equipo.' });
    } finally {
      setLoadingMiembros(false);
    }
  }, [equipoSeleccionado?.id, addToast]);

  useEffect(() => {
    void refreshMiembros();
  }, [refreshMiembros]);

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

  const toggleNuevoPermiso = (permiso: TeamPermission) => {
    setNuevoMiembroPermisos((prev) => {
      if (prev.includes(permiso)) {
        return prev.filter((p) => p !== permiso);
      }
      return [...prev, permiso];
    });
  };

  const aplicarPresetNuevoMiembro = () => {
    setNuevoMiembroPermisos(getRolePresetPermissions(nuevoMiembroRol));
  };

  const handleCrearMiembro = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!equipoSeleccionado?.id || !nuevoMiembroEmail.trim()) return;

    try {
      setSavingMiembro(true);
      const usuario = await buscarUsuarioPorEmail(nuevoMiembroEmail.trim());

      await crearMiembroEquipo(equipoSeleccionado.id, {
        usuarioId: usuario.id,
        rol: nuevoMiembroRol,
        permisos: nuevoMiembroPermisos,
        estado: 'activo',
      });

      addToast({ type: 'success', title: 'Miembro agregado', message: 'El miembro fue agregado correctamente.' });
      setNuevoMiembroEmail('');
      setNuevoMiembroRol('video_analista');
      setNuevoMiembroPermisos(['stats.capture']);
      await refreshMiembros();
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos agregar el miembro.' });
    } finally {
      setSavingMiembro(false);
    }
  };

  const handleGuardarMiembro = async (miembro: TeamMember) => {
    if (!equipoSeleccionado?.id) return;
    try {
      setSavingMiembro(true);
      await actualizarMiembroEquipo(equipoSeleccionado.id, miembro.usuarioId, {
        rol: miembro.rol,
        permisos: miembro.permisos,
        estado: miembro.estado,
      });
      addToast({ type: 'success', title: 'Miembro actualizado', message: 'Permisos actualizados correctamente.' });
      await refreshMiembros();
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos actualizar el miembro.' });
    } finally {
      setSavingMiembro(false);
    }
  };

  const aplicarPresetMiembro = (usuarioId: string, rol: TeamMemberRole) => {
    const preset = getRolePresetPermissions(rol);
    setMiembros((prev) => prev.map((item) => (
      item.usuarioId === usuarioId
        ? { ...item, permisos: preset }
        : item
    )));
  };

  const samePermissionSet = (a: TeamPermission[] = [], b: TeamPermission[] = []) => {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((item) => setA.has(item));
  };

  const applyRoleChange = (usuarioId: string, nextRole: TeamMemberRole, replaceWithPreset: boolean) => {
    setMiembros((prev) => prev.map((item) => {
      if (item.usuarioId !== usuarioId) return item;
      const nextPermisos = replaceWithPreset ? getRolePresetPermissions(nextRole) : (item.permisos || []);
      return { ...item, rol: nextRole, permisos: nextPermisos };
    }));
  };

  const handleChangeRolMiembro = (usuarioId: string, nextRole: TeamMemberRole) => {
    const current = miembros.find((item) => item.usuarioId === usuarioId);
    if (!current) return;

    const preset = getRolePresetPermissions(nextRole);
    const permisosActuales = current.permisos || [];
    const tienePermisosPersonalizados = permisosActuales.length > 0 && !samePermissionSet(permisosActuales, preset);

    if (tienePermisosPersonalizados) {
      setPendingRoleChange({ usuarioId, nextRole });
      setConfirmPresetOpen(true);
      return;
    }

    applyRoleChange(usuarioId, nextRole, false);
  };

  const confirmarAplicarPreset = () => {
    if (!pendingRoleChange) return;
    applyRoleChange(pendingRoleChange.usuarioId, pendingRoleChange.nextRole, true);
    setConfirmPresetOpen(false);
    setPendingRoleChange(null);
  };

  const mantenerPermisosActuales = () => {
    if (!pendingRoleChange) return;
    applyRoleChange(pendingRoleChange.usuarioId, pendingRoleChange.nextRole, false);
    setConfirmPresetOpen(false);
    setPendingRoleChange(null);
  };

  const cancelarCambioRolPendiente = () => {
    setConfirmPresetOpen(false);
    setPendingRoleChange(null);
  };

  const togglePermisoMiembro = (usuarioId: string, permiso: TeamPermission) => {
    setMiembros((prev) => prev.map((item) => {
      if (item.usuarioId !== usuarioId) return item;

      const actuales = item.permisos || [];
      const nextPermisos = actuales.includes(permiso)
        ? actuales.filter((p) => p !== permiso)
        : [...actuales, permiso];

      return { ...item, permisos: nextPermisos };
    }));
  };

  const handleQuitarMiembro = async (usuarioId: string) => {
    if (!equipoSeleccionado?.id) return;
    try {
      setSavingMiembro(true);
      await eliminarMiembroEquipo(equipoSeleccionado.id, usuarioId);
      addToast({ type: 'success', title: 'Miembro removido', message: 'El miembro fue removido del equipo.' });
      await refreshMiembros();
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Error', message: 'No pudimos remover el miembro.' });
    } finally {
      setSavingMiembro(false);
    }
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Miembros y permisos</h3>
            <p className="text-sm text-slate-500">Asigna roles como video analista o staff sin dar admin total.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshMiembros()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Recargar
          </button>
        </div>

        <form onSubmit={handleCrearMiembro} className="mt-5 space-y-4 rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Agregar miembro</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              id="nuevoMiembroEmail"
              name="nuevoMiembroEmail"
              label="Email del usuario"
              type="email"
              required
              value={nuevoMiembroEmail}
              onChange={(event) => setNuevoMiembroEmail(event.target.value)}
              placeholder="usuario@correo.com"
            />

            <label className="block text-sm font-medium text-slate-700">
              Rol del miembro
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={nuevoMiembroRol}
                onChange={(event) => setNuevoMiembroRol(event.target.value as TeamMemberRole)}
              >
                {TEAM_MEMBER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={aplicarPresetNuevoMiembro}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Aplicar preset del rol
            </button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Permisos extra</p>
            <div className="grid gap-2 md:grid-cols-2">
              {TEAM_PERMISSION_OPTIONS.map((option) => {
                const checked = nuevoMiembroPermisos.includes(option.value);
                return (
                  <label key={option.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNuevoPermiso(option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingMiembro}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingMiembro ? 'Agregando…' : 'Agregar miembro'}
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Permisos</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {miembros.map((miembro) => (
                <tr key={`${miembro.equipo}-${miembro.usuarioId}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">
                      {miembroUsers.get(miembro.usuarioId)?.nombre || miembro.usuarioId}
                    </div>
                    <div className="text-xs text-slate-500">
                      {miembroUsers.get(miembro.usuarioId)?.email || miembro.usuarioId}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1"
                      value={miembro.rol}
                      onChange={(event) => handleChangeRolMiembro(miembro.usuarioId, event.target.value as TeamMemberRole)}
                    >
                      {TEAM_MEMBER_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => aplicarPresetMiembro(miembro.usuarioId, miembro.rol)}
                      className="mt-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Aplicar preset
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1"
                      value={miembro.estado}
                      onChange={(event) => {
                        const nextEstado = event.target.value as TeamMember['estado'];
                        setMiembros((prev) => prev.map((item) => (
                          item.usuarioId === miembro.usuarioId
                            ? { ...item, estado: nextEstado }
                            : item
                        )));
                      }}
                    >
                      <option value="activo">Activo</option>
                      <option value="invitado">Invitado</option>
                      <option value="suspendido">Suspendido</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <div className="grid gap-1">
                      {TEAM_PERMISSION_OPTIONS.map((option) => {
                        const checked = (miembro.permisos || []).includes(option.value);
                        return (
                          <label key={`${miembro.usuarioId}-${option.value}`} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermisoMiembro(miembro.usuarioId, option.value)}
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGuardarMiembro(miembro)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuitarMiembro(miembro.usuarioId)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loadingMiembros ? (
            <p className="px-3 py-3 text-sm text-slate-500">Cargando miembros…</p>
          ) : null}

          {!loadingMiembros && miembros.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">No hay miembros configurados todavia.</p>
          ) : null}
        </div>
      </section>

      {loading ? <p className="text-sm text-slate-500">Actualizando información…</p> : null}

      <ModalBase isOpen={confirmPresetOpen} onClose={cancelarCambioRolPendiente} title="Cambiar rol del miembro" size="sm">
        <div className="p-4">
          <p className="text-sm text-slate-700">
            Este miembro tiene permisos personalizados. Elige cómo continuar con el cambio de rol.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cancelarCambioRolPendiente}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              Cancelar cambio
            </button>
            <button
              type="button"
              onClick={mantenerPermisosActuales}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Mantener permisos actuales
            </button>
            <button
              type="button"
              onClick={confirmarAplicarPreset}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Reemplazar por preset
            </button>
          </div>
        </div>
      </ModalBase>

      {/* Modal de invitación movido a JugadoresPage */}
    </div>
  );
};

export default EquipoPage;
