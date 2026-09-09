import { useEffect, useState } from 'react';
import { Overlay } from 'overtime-kit';
import type { SolicitudEdicion } from '../types/solicitudesEdicion';
import { actualizarSolicitudEdicion as actualizarSolicitud } from '../services/solicitudesEdicionService';
import { useToast } from '../../../components/Toast/ToastProvider';

interface Props {
  solicitud: SolicitudEdicion | null;
  onClose: () => void;
  onSaved: (updated: SolicitudEdicion) => void;
}

export default function SolicitudEditModalSimple({ solicitud, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState<Record<string, any>>({});
  const { addToast } = useToast();

  useEffect(() => {
    setDatos(solicitud?.datosPropuestos ? { ...solicitud!.datosPropuestos } : {});
  }, [solicitud]);

  const handleChange = (k: string, v: any) => setDatos((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    try {
      setLoading(true);
      const updated = await actualizarSolicitud(solicitud!._id, {
        datosPropuestos: datos as any
      });
      onSaved({ ...updated, id: updated._id }); // Agregar la propiedad id
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.message || 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Overlay
      isOpen={!!solicitud}
      onClose={onClose}
      size="lg"
      title={solicitud ? `Editar solicitud: ${solicitud.tipo}` : ''}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Cancelar</button>
          <button disabled={loading} onClick={handleSave} className="rounded bg-brand-600 px-3 py-1 text-sm font-semibold text-white">Guardar</button>
        </div>
      }
    >
      {solicitud && (
        <div className="space-y-3">
          <label className="block text-xs text-slate-600">Fecha inicio</label>
          <input value={datos.fechaInicio || ''} onChange={(e) => handleChange('fechaInicio', e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          <label className="block text-xs text-slate-600">Fecha fin</label>
          <input value={datos.fechaFin || ''} onChange={(e) => handleChange('fechaFin', e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
      )}
    </Overlay>
  );
}
