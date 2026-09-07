import { render, screen, fireEvent, within } from '@testing-library/react';
import SeccionSinergias from './SeccionSinergias';
import SeccionCondicionesSet from './SeccionCondicionesSet';
import { construirSets } from '../../utils/setsAnaliticos';
import { alineacion } from '../../utils/__fixtures__/filas';
import type { FilaAnalitica } from '../../services/filasService';

/**
 * Smoke tests de las dos secciones que analizan el set como unidad.
 *
 * La matemática ya está cubierta en los tests de `utils/`; lo que se verifica acá es que el
 * render no explote —recharts dentro de jsdom es el candidato— y que los números que la tabla
 * muestra sean los que el motor calculó, que es donde un error de cableado pasaría inadvertido.
 *
 * Las consultas se acotan a la tabla: los nombres de un grupo aparecen también en las tarjetas
 * de titular, y una búsqueda suelta encontraría los dos.
 */

const FILAS: FilaAnalitica[] = [
  // j1, j2 y j3 juntos ganan los cuatro sets.
  ...[1, 2, 3, 4].flatMap((n) =>
    alineacion(['j1', 'j2', 'j3'], { partidoId: 'p1', numeroSet: n, resultadoSet: 'ganado' }),
  ),
  // Sueltos, cada uno con j4, pierden.
  ...alineacion(['j1', 'j4'], { partidoId: 'p2', numeroSet: 1, resultadoSet: 'perdido' }),
  ...alineacion(['j2', 'j4'], { partidoId: 'p2', numeroSet: 2, resultadoSet: 'perdido' }),
  // j5 y j6 sólo jugaron entre ellos: no hay con qué comparar.
  ...[1, 2].flatMap((n) =>
    alineacion(['j5', 'j6'], { partidoId: 'p3', numeroSet: n, resultadoSet: 'ganado' }),
  ),
  ...[3, 4].flatMap((n) =>
    alineacion(['j5', 'j6'], { partidoId: 'p3', numeroSet: n, resultadoSet: 'perdido' }),
  ),
];

const SETS = construirSets(FILAS);

/**
 * La fila de la tabla cuyo nombre accesible contiene ese texto.
 *
 * Una fila expone como nombre la concatenación de sus celdas, así que buscar por el nombre del
 * grupo la encuentra sin tener que trepar el DOM desde la celda.
 */
const filaDe = (nombre: string) =>
  within(screen.getByRole('table')).getByRole('row', { name: new RegExp(nombre.replace(/\+/g, '\\+')) });

describe('SeccionSinergias', () => {
  it('muestra la sinergia de una dupla junto a su muestra', () => {
    render(<SeccionSinergias sets={SETS} />);

    // 4 sets juntos, los 4 ganados; 2 sets separados, los 2 perdidos.
    const celdas = within(filaDe('J1 + J2')).getAllByRole('cell');
    expect(celdas[1]).toHaveTextContent('4');
    expect(celdas[2]).toHaveTextContent('100%');
    expect(celdas[3]).toHaveTextContent('2');
    expect(celdas[4]).toHaveTextContent('0%');
    expect(celdas[5]).toHaveTextContent('+100 pts');
  });

  it('marca inseparables a los que nunca jugaron sueltos, sin inventarles un cero', () => {
    render(<SeccionSinergias sets={SETS} />);

    const fila = filaDe('J5 + J6');
    expect(within(fila).getByText('Inseparables')).toBeInTheDocument();
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[3]).toHaveTextContent('0');
    expect(celdas[5]).toHaveTextContent('—');
  });

  it('un grupo no puede estar a la vez entre los mejores y entre los peores', () => {
    render(<SeccionSinergias sets={SETS} />);

    // Con pocos grupos hay titular bueno pero no hay malo: es preferible a repetir el mismo.
    expect(screen.getByText('Mejores químicas')).toBeInTheDocument();
    expect(screen.queryByText('A revisar')).not.toBeInTheDocument();
  });

  it('cambiar el tamaño del grupo cambia la tabla', () => {
    render(<SeccionSinergias sets={SETS} />);
    expect(within(screen.getByRole('table')).queryByText('J1 + J2 + J3')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Grupo/i), { target: { value: '3' } });
    expect(within(screen.getByRole('table')).getByText('J1 + J2 + J3')).toBeInTheDocument();
  });

  it('el mínimo de sets esconde los grupos con poca muestra y nunca agranda la tabla', () => {
    render(<SeccionSinergias sets={SETS} />);
    const antes = within(screen.getByRole('table')).getAllByRole('row').length;

    fireEvent.change(screen.getByLabelText(/Mínimo de sets/i), { target: { value: '2' } });
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThanOrEqual(antes);

    fireEvent.change(screen.getByLabelText(/Mínimo de sets/i), { target: { value: '10' } });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/Bajá el mínimo/i)).toBeInTheDocument();
  });

  it('sin sets lo dice en vez de mostrar una tabla vacía', () => {
    render(<SeccionSinergias sets={[]} />);
    expect(screen.getByText(/no tienen estadísticas cargadas set a set/i)).toBeInTheDocument();
  });
});

describe('SeccionCondicionesSet', () => {
  it('renderiza los tramos del factor y cierra con el total del segmento', () => {
    render(<SeccionCondicionesSet sets={SETS} />);

    // 10 sets en total, 6 ganados.
    const total = within(screen.getByRole('table')).getByRole('row', { name: /^Total/ });
    const celdas = within(total).getAllByRole('cell');
    expect(celdas[1]).toHaveTextContent('10');
    expect(celdas[3]).toHaveTextContent('6');
    expect(celdas[4]).toHaveTextContent('60%');
  });

  it('cambiar de factor recalcula la tabla', () => {
    render(<SeccionCondicionesSet sets={SETS} />);
    fireEvent.change(screen.getByLabelText(/Factor/i), { target: { value: 'concentracion' } });

    const tabla = within(screen.getByRole('table'));
    // Los sets de tres reparten a 33%; los de dos, a 50%.
    expect(tabla.getByText('30 – 40%')).toBeInTheDocument();
    expect(tabla.getByText('50% o más')).toBeInTheDocument();
  });

  it('la suma de los tramos es el total: ningún set se pierde ni se cuenta dos veces', () => {
    render(<SeccionCondicionesSet sets={SETS} />);
    fireEvent.change(screen.getByLabelText(/Factor/i), { target: { value: 'concentracion' } });

    const filas = within(screen.getByRole('table')).getAllByRole('row');
    // Fuera del encabezado y del pie de totales.
    const cuerpo = filas.slice(1, -1);
    const suma = cuerpo.reduce(
      (acc, fila) => acc + Number(within(fila).getAllByRole('cell')[1].textContent),
      0,
    );
    expect(suma).toBe(SETS.length);
  });

  it('sin sets lo dice en vez de dibujar un gráfico vacío', () => {
    render(<SeccionCondicionesSet sets={[]} />);
    expect(screen.getByText(/no tienen estadísticas cargadas set a set/i)).toBeInTheDocument();
  });
});
