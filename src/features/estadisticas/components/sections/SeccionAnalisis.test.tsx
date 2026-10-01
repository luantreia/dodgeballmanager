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

// Se mockea SÓLO la descarga: el armado del CSV queda real, así que este test también verifica
// el contenido que se entrega y no nada más que se haya llamado a algo.
jest.mock('../../../../shared/utils/csv', () => ({
  ...jest.requireActual('../../../../shared/utils/csv'),
  descargarCsv: jest.fn(),
}));

const { getTimelineEquipo } = jest.requireMock('../../services/timelineService');
const { getFilasAnaliticas } = jest.requireMock('../../services/filasService');
const { descargarCsv } = jest.requireMock('../../../../shared/utils/csv');

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
  getTimelineEquipo.mockResolvedValue({
    partidos: [
      partido('1'),
      partido('2', { modalidad: 'Cloth', rival: { _id: 'r2', nombre: 'Riestra', escudo: null } }),
    ],
    equiposDisponibles: [{ _id: 'e1', nombre: 'Mi equipo', escudo: null }],
  });
  descargarCsv.mockClear();
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

  describe('pestaña Sets · tramos de alineación', () => {
    const SEIS = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
    const CON_SUPLENTE = ['j1', 'j2', 'j3', 'j4', 'j5', 'j7'];

    it('muestra los tramos arriba y las condiciones debajo', async () => {
      montar();
      await screen.findByText('Estadísticas');
      fireEvent.click(tab(/^Sets$/i));

      expect(screen.getByRole('heading', { name: 'Tramos de alineación' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Condiciones del set' })).toBeInTheDocument();
    });

    it('con la alineación incompleta no inventa tramos, y lo dice', async () => {
      // El fixture de este archivo carga 3 jugadores por set, no 6: ningún set es legible, y un
      // set incompleto se ve igual que una sustitución. Mejor no mostrar nada que mostrar un
      // cambio que nunca pasó.
      montar();
      await screen.findByText('Estadísticas');
      fireEvent.click(tab(/^Sets$/i));

      expect(screen.getByText(/sets quedaron afuera/)).toBeInTheDocument();
      expect(screen.queryByText(/^Sets \d/)).not.toBeInTheDocument();
    });

    it('con los seis cargados muestra la racha y el cambio que la cortó', async () => {
      getFilasAnaliticas.mockResolvedValue([
        ...alineacion(SEIS, { partidoId: '1', numeroSet: 1, resultadoSet: 'ganado' }),
        ...alineacion(SEIS, { partidoId: '1', numeroSet: 2, resultadoSet: 'ganado' }),
        ...alineacion(CON_SUPLENTE, { partidoId: '1', numeroSet: 3, resultadoSet: 'perdido' }),
      ]);

      montar();
      await screen.findByText('Estadísticas');
      fireEvent.click(tab(/^Sets$/i));

      expect(screen.getByText('Sets 1–2')).toBeInTheDocument();
      expect(screen.getByText(/sale J6 · entra J7/)).toBeInTheDocument();
      expect(screen.getByText('Set 3')).toBeInTheDocument();
    });
  });
  it('exporta en CSV el recorte que está a la vista', async () => {
    montar();
    await screen.findByText('Estadísticas');

    fireEvent.click(tab(/Exportar/));
    fireEvent.click(screen.getByText('Datos crudos'));

    expect(descargarCsv).toHaveBeenCalledTimes(1);
    const [nombreArchivo, contenido] = descargarCsv.mock.calls[0];

    expect(nombreArchivo).toMatch(/^overtime-filas-.*\.csv$/);
    // 8 filas de datos (3+3+2) más el encabezado.
    expect(contenido.trimEnd().split('\r\n')).toHaveLength(9);
    expect(contenido).toContain('Jugador;Throws;Hits;Outs;Catches');
  });

  it('el CSV respeta el filtro: al acotar a una modalidad baja menos filas', async () => {
    montar();
    await screen.findByText('Estadísticas');

    // Filtrar a Cloth deja sólo el partido 2, que aporta 2 filas.
    fireEvent.click(tab(/2 partidos/));
    fireEvent.click(screen.getByRole('button', { name: /^Cloth/ }));

    fireEvent.click(tab(/Exportar/));
    fireEvent.click(screen.getByText('Datos crudos'));

    const [nombreArchivo, contenido] = descargarCsv.mock.calls[0];
    expect(contenido.trimEnd().split('\r\n')).toHaveLength(3);
    // Y el nombre del archivo dice de qué recorte salió.
    expect(nombreArchivo).toContain('cloth');
  });

  it('la comparación de segmentos sólo se ofrece cuando hay segmentos guardados', async () => {
    montar();
    await screen.findByText('Estadísticas');

    fireEvent.click(tab(/Exportar/));
    expect(screen.queryByText('Comparación de segmentos')).not.toBeInTheDocument();
    fireEvent.click(tab(/Exportar/));

    fireEvent.click(tab(/\+ Segmento/));
    fireEvent.click(tab(/Exportar/));
    expect(screen.getByText('Comparación de segmentos')).toBeInTheDocument();
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
