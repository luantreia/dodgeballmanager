import { useEffect, useState } from 'react';
import { Overlay } from 'overtime-kit';
import { type AdminUser } from '../../../types';

interface ModalGestionAdministradoresEntidadProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  title?: string;
  placeholder?: string;
  addButtonText?: string;
  submittingText?: string;
  emptyText?: string;
  removeButtonText?: string;
  manageButtonText?: string;
  addFunction: (entityId: string, data: { email: string }) => Promise<void>;
  getFunction: (entityId: string) => Promise<{ administradores: AdminUser[] }>;
  removeFunction: (entityId: string, adminId: string) => Promise<void>;
  onAdminAdded?: (email: string) => void;
  onAdminRemoved?: (adminId: string) => void;
}

const ModalGestionAdministradoresEntidad = ({ isOpen, onClose, entityId, title = "Administradores", placeholder = "email@ejemplo.com", addButtonText = "Agregar", submittingText = "Agregando…", emptyText = "Sin administradores", removeButtonText = "Quitar", manageButtonText = "Administrar", addFunction, getFunction, removeFunction, onAdminAdded, onAdminRemoved }: ModalGestionAdministradoresEntidadProps) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    if (!entityId) {
      setAdmins([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getFunction(entityId);
      setAdmins(data.administradores || []);
    } catch (error) {
      console.error('Error loading admins:', error);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entityId]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !email.trim()) return;
    setSubmitting(true);
    try {
      await addFunction(entityId, { email });
      setEmail('');
      await refresh();
      onAdminAdded?.(email);
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = async (adminId: string) => {
    if (!entityId) return;
    await removeFunction(entityId, adminId);
    await refresh();
    onAdminRemoved?.(adminId);
  };

  return (
    <Overlay isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onAdd}>
        <input
          type="email"
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? submittingText : addButtonText}
        </button>
      </form>

      <div className="mt-6 max-h-60 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : admins.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {admins.map((a) => (
              <li key={a._id} className="flex items-center justify-between py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{a.nombre ?? a.email ?? a._id}</p>
                  <p className="truncate text-xs text-slate-500">{a.email ?? '—'}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => onRemove(a._id)}
                >
                  {removeButtonText}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Overlay>
  );
};

export default ModalGestionAdministradoresEntidad;
