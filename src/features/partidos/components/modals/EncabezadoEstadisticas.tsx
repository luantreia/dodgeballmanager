// src/components/estadisticas/EncabezadoEstadisticas.tsx
import type { FC } from 'react';

type EncabezadoEstadisticasProps = {
  onClose: () => void;
};

const EncabezadoEstadisticas: FC<EncabezadoEstadisticasProps> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between mb-6 px-4 pt-4">
      <h2 className="mr-auto text-2xl font-bold text-gray-800 md:text-3xl">Captura de Estadísticas</h2>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        aria-label="Cerrar"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  );
};

export default EncabezadoEstadisticas;