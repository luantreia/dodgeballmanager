import React, { useEffect, useState } from 'react';
import type { SolicitudEdicion } from '../types/solicitudesEdicion';
import { actualizarSolicitudEdicion as actualizarSolicitud } from '../services/solicitudesEdicionService';

interface Props {
  solicitud: SolicitudEdicion | null;
  onClose: () => void;
  onSaved: (updated: SolicitudEdicion) => void;
}

export default function SolicitudEditModalSimple({ solicitud, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState<Record<string, any>>({});

  useEffect(() => {
    setDatos(solicitud?.datosPropuestos ? { ...solicitud!.datosPropuestos } : {});
  }, [solicitud]);

  if (!solicitud) return null;

  const handleChange = (k: string, v: any) => setDatos((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    try {
      setLoading(true);
      const updated = await actualizarSolicitud(solicitud._id, { 
        datosPropuestos: datos as any 
      });
      onSaved({ ...updated, id: updated._id }); // Agregar la propiedad id
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="z-10 w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Editar solicitud: {solicitud.tipo}</h3>
          <button onClick={onClose} className="text-sm text-slate-600">Cerrar</button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs text-slate-600">Fecha inicio</label>
          <input value={datos.fechaInicio || ''} onChange={(e) => handleChange('fechaInicio', e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          <label className="block text-xs text-slate-600">Fecha fin</label>
          <input value={datos.fechaFin || ''} onChange={(e) => handleChange('fechaFin', e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Cancelar</button>
            <button disabled={loading} onClick={handleSave} className="rounded bg-brand-600 px-3 py-1 text-sm font-semibold text-white">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}