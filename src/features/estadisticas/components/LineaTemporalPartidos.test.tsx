import { render, screen, fireEvent, within } from '@testing-library/react';
import { useFiltrosPartidos } from '../hooks/useFiltrosPartidos';
import PanelFiltrosPartidos from './PanelFiltrosPartidos';
import LineaTemporalPartidos from './LineaTemporalPartidos';
import type { PartidoTimeline } from '../services/timelineService';

const base = (id: string, over: Partial<PartidoTimeline>): PartidoTimeline => ({
  _id: id,
  fecha: '2026-03-10T23:00:00.000Z',
  estado: 'finalizado',
  modalidad: 'Foam',
  categoria: 'Mixto',
  ubicacion: null,
  jornada: null,
  etapa: null,
  nombrePartido: null,
  esLocal: true,
  marcadorEquipo: 3,
  marcadorRival: 1,
  rival: { _id: 'r1', nombre: 'Marvin', escudo: null },
  competencia: null,
  temporada: null,
  fase: null,
  datos: {
    oficial: { existe: false, porSets: false, directa: false, verificada: false },
    planilla: null,
    fuenteEfectiva: 'sin_datos',
  },
  ...over,
});

const PARTIDOS: PartidoTimeline[] = [
  base('1', {
    modalidad: 'Foam',
    datos: {
      oficial: { existe: true, porSets: true, directa: false, verificada: true },
      planilla: null,
      fuenteEfectiva: 'oficial',
    },
  }),
  base('2', {
    modalidad: 'Cloth',
    fecha: '2026-05-20T23:00:00.000Z',
    rival: { _id: 'r2', nombre: 'Riestra', escudo: null },
    datos: {
      oficial: { existe: true, porSets: true, directa: false, verificada: false },
      planilla: { _id: 'p2', estado: 'borrador', modo: 'sets', fuentePreferida: 'planilla' },
      fuenteEfectiva: 'planilla',
    },
  }),
];

const Harness = () => {
  const filtros = useFiltrosPartidos(PARTIDOS);
  return (
    <>
      <PanelFiltrosPartidos filtros={filtros} totalPartidos={PARTIDOS.length} />
      <LineaTemporalPartidos partidos={filtros.partidosFiltrados} onAbrir={() => {}} />
    </>
  );
};

describe('Línea temporal con filtros', () => {
  it('marca cada partido según los datos que tiene', () => {
    render(<Harness />);

    expect(screen.getByText('Verificada')).toBeInTheDocument();
    expect(screen.getByText('Usando mi planilla')).toBeInTheDocument();
    // Sólo el segundo tiene las dos fuentes.
    expect(screen.getAllByText('2 fuentes')).toHaveLength(1);
  });

  it('agrupa por mes usando la fecha local, no la UTC', () => {
    render(<Harness />);
    // 2026-03-10T23:00Z es el 10/03 a las 20:00 en Argentina. Leído en UTC seguiría siendo
    // marzo, pero un partido de las 22:00 locales cruzaría a UTC del día siguiente; el
    // agrupado usa componentes locales justamente por eso.
    expect(screen.getByText(/marzo 2026/)).toBeInTheDocument();
    expect(screen.getByText(/mayo 2026/)).toBeInTheDocument();
  });

  it('filtrar por modalidad reduce la línea temporal', () => {
    render(<Harness />);
    // Las consultas van acotadas a la línea: los nombres de rival también aparecen como chips
    // en el panel de filtros, y sin acotar el matcher es ambiguo.
    const linea = () => screen.getByRole('region', { name: /línea temporal/i });

    expect(within(linea()).getByText(/Marvin/)).toBeInTheDocument();
    expect(within(linea()).getByText(/Riestra/)).toBeInTheDocument();

    // El chip de la faceta se llama "Foam 1" (etiqueta + contador). Nombre exacto: los botones
    // de la línea temporal también contienen "Foam" en su badge de modalidad.
    fireEvent.click(screen.getByRole('button', { name: 'Foam 1' }));

    expect(within(linea()).queryByText(/Riestra/)).not.toBeInTheDocument();
    expect(within(linea()).getByText(/Marvin/)).toBeInTheDocument();
    expect(screen.getByText('1 de 2 partidos')).toBeInTheDocument();
  });
});
