import React, { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useSolicitudEditarPartido } from '../../hooks/useSolicitudEditarPartido';

interface ModalSolicitudEditarPartidoProps {
  isOpen: boolean;
  partidoId: string;
  onClose: () => void;
}

type CampoPartido = 'ubicacion' | 'fecha' | 'hora' | 'marcadorLocal' | 'marcadorVisitante' | 'estado' | 'setGanador';

const CAMPOS_DISPONIBLES: Array<{ value: CampoPartido; label: string }> = [
  { value: 'ubicacion', label: 'Ubicación' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'hora', label: 'Hora' },
  { value: 'marcadorLocal', label: 'Marcador Local' },
  { value: 'marcadorVisitante', label: 'Marcador Visitante' },
  { value: 'estado', label: 'Estado' },
  { value: 'setGanador', label: 'Set Ganador' },
];

const ModalSolicitudEditarPartido: React.FC<ModalSolicitudEditarPartidoProps> = ({
  isOpen,
  partidoId,
  onClose,
}) => {
  const { solicitarCambio, loading } = useSolicitudEditarPartido();
  const [campo, setCampo] = useState<CampoPartido>('ubicacion');
  const [valorPropuesto, setValorPropuesto] = useState('');
  const [razon, setRazon] = useState('');

  const handleCampoChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setCampo(e.target.value as CampoPartido);
  };

  const handleValorChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValorPropuesto(e.target.value);
  };

  const handleRazonChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setRazon(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valorPropuesto.trim() || !razon.trim()) {
      return;
    }

    const success = await solicitarCambio(partidoId, {
      campo,
      valorPropuesto,
      razon,
    });

    if (success) {
      setCampo('ubicacion');
      setValorPropuesto('');
      setRazon('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Solicitar cambio en competencia</h2>
            <p className="text-sm text-slate-500">Detalla qué campo necesitás cambiar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Cerrar
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Campo a modificar</label>
            <select
              value={campo}
              onChange={handleCampoChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {CAMPOS_DISPONIBLES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Valor propuesto</label>
            <input
              type="text"
              value={valorPropuesto}
              onChange={handleValorChange}
              placeholder="Ej: Nuevo estadio, 2024-12-01, 19:00"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Razón de la solicitud</label>
            <textarea
              value={razon}
              onChange={handleRazonChange}
              placeholder="Explica por qué es necesario este cambio..."
              required
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !valorPropuesto.trim() || !razon.trim()}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalSolicitudEditarPartido;
