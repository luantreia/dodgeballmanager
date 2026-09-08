import { render, screen, fireEvent, within } from '@testing-library/react';
import ToastProvider from '../../../../shared/components/Toast/ToastProvider';
import SeccionAnalisis from './SeccionAnalisis';
import { alineacion } from '../../utils/__fixtures__/filas';
import type { PartidoTimeline } from '../../services/timelineService';

jest.mock('../../services/timelineService', () => ({
  getTimelineEquipo: jest.fn(),
}));

jest.mock('../../services/filasService', () => ({
  getFilasAnaliticas: jest.fn(),
}));

const { getTimelineEquipo } = jest.requireMock('../../services/timelineService');
const { getFilasAnaliticas } = jest.requireMock('../../services/filasService');

const partido = (id: string, over: Partial<PartidoTimeline> = {}): PartidoTimeline =>
  ({
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
    rival: { _id: `r${id}`, nombre: `Rival ${id}`, escudo: null },
    competencia: null,
    temporada: null,
    fase: null,
    datos: {
      oficial: { existe: true, porSets: true, directa: false, verificada: true },
      planilla: null,
      fuenteEfectiva: 'oficial',
    },
    ...over,
  }) as PartidoTimeline;

const montar = () =>
  render(
    <ToastProvider>
      <SeccionAnalisis equipoId="e1" equipoNombre="Mi equipo" token="t" />
    </ToastProvider>,
  );

beforeEach(() => {
  getTimelineEquipo.mockResolvedValue([
    partido('1'),
    partido('2', { modalidad: 'Cloth', rival: { _id: 'r2', nombre: 'Riestra', escudo: null } }),
  ]);
  getFilasAnaliticas.mockResolvedValue([
    ...alineacion(['j1', 'j2', 'j3'], { partidoId: '1', numeroSet: 1, resultadoSet: 'ganado' }),
    ...alineacion(['j1', 'j2', 'j3'], { partidoId: '1', numeroSet: 2, resultadoSet: 'ganado' }),
    ...alineacion(['j1', 'j4'], { partidoId: '2', numeroSet: 1, resultadoSet: 'perdido' }),
  ]);
});

const tab = (nombre: RegExp) => screen.getByRole('button', { name: nombre });

describe('SeccionAnalisis · shell fijo con pestañas', () => {
  it('abre en Resumen y sólo monta la pestaña activa', async () => {
    montar();
    await screen.findByText('Estadísticas');

    // El resumen está; las otras secciones ni siquiera se montaron.
    expect(screen.queryByText('Sinergias', { selector: 'h2' })).not.toBeInTheDocument();
    expect(screen.queryByText('Condiciones del set')).not.toBeInTheDocument();
  });

  it('cambiar de pestaña reemplaza el contenido', async () => {
    montar();
    await screen.findByText('Estadísticas');

    fireEvent.click(tab(/^Sinergias$/i));
    expect(screen.getByRole('heading', { name: 'Sinergias' })).toBeInTheDocument();
    expect(screen.queryByText('Estadísticas')).not.toBeInTheDocument();

    fireEvent.click(tab(/^Sets$/i));
    expect(screen.getByRole('heading', { name: 'Condiciones del set' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sinergias' })).not.toBeInTheDocument();
  });

  it('el chip de filtros resume cuántos partidos quedan y despliega las facetas', async () => {
    montar();
    await screen.findByText('Estadísticas');

    const chip = tab(/2 partidos/);
    expect(chip).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');

    // Filtrar por modalidad actualiza el propio chip, que es el único conteo de la pantalla.
    fireEvent.click(screen.getByRole('button', { name: 'Foam 1' }));
    expect(tab(/1 de 2/)).toBeInTheDocument();
  });

  it('los filtros valen para todas las pestañas, no sólo para la que estaba abierta', async () => {
    montar();
    await screen.findByText('Estadísticas');

    fireEvent.click(tab(/2 partidos/));
    fireEvent.click(screen.getByRole('button', { name: 'Cloth 1' }));
    fireEvent.click(tab(/^Partidos$/i));

    const linea = screen.getByRole('region', { name: /línea temporal/i });
    expect(within(linea).getByText(/Riestra/)).toBeInTheDocument();
    expect(within(linea).queryByText(/Rival 1/)).not.toBeInTheDocument();
  });
});
