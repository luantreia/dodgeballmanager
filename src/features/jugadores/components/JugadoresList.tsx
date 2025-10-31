import type { Jugador } from '../../../types';

interface JugadoresListProps {
  jugadores: Jugador[];
}

const JugadoresList = ({ jugadores }: JugadoresListProps) => {
  return (
    <ul className="space-y-2">
      {jugadores.map((jugador) => (
        <li key={jugador.id} className="rounded-lg bg-slate-50 px-3 py-2">
          {jugador.nombre}
        </li>
      ))}
    </ul>
  );
};

export default JugadoresList;
