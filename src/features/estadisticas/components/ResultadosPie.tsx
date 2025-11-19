import type { FC } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { Partido } from '../../../shared/utils/types/types';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

type Props = {
  partidos: Partido[];
  title?: string;
};

export const ResultadosPie: FC<Props> = ({ partidos, title = 'Distribución de resultados' }) => {
  const finalizados = partidos.filter((p) => p.estado === 'finalizado');
  const w = finalizados.filter((p) => (p.resultado?.puntosEquipo ?? 0) > (p.resultado?.puntosRival ?? 0)).length;
  const d = finalizados.filter((p) => (p.resultado?.puntosEquipo ?? 0) === (p.resultado?.puntosRival ?? 0)).length;
  const l = finalizados.filter((p) => (p.resultado?.puntosEquipo ?? 0) < (p.resultado?.puntosRival ?? 0)).length;

  const data = [
    { name: 'Victorias', value: w, fill: COLORS[0] },
    { name: 'Empates', value: d, fill: COLORS[1] },
    { name: 'Derrotas', value: l, fill: COLORS[2] },
  ];

  if (finalizados.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
        <h4 className="text-lg font-semibold mb-2">{title}</h4>
        <p>No hay partidos finalizados para graficar.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="text-center mb-4">
        <h4 className="text-lg font-semibold">{title}</h4>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResultadosPie;
