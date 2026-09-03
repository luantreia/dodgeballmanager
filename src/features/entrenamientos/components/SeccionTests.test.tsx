import { render, screen, within } from '@testing-library/react';
import SeccionTests from './SeccionTests';
import { ToastProvider } from '../../../shared/components/Toast/ToastProvider';
import * as testService from '../services/testService';
import * as entrenamientoService from '../services/entrenamientoService';

jest.mock('../services/testService', () => ({
  ...jest.requireActual('../services/testService'),
  listarTiposTest: jest.fn(),
  listarResultados: jest.fn(),
  getEvolucion: jest.fn(),
}));
jest.mock('../services/entrenamientoService', () => ({
  getResumenAsistencia: jest.fn(),
}));

const mockeado = testService as jest.Mocked<typeof testService>;
const mockEntrenamientos = entrenamientoService as jest.Mocked<typeof entrenamientoService>;

const TIPO_SPRINT: testService.TipoTest = {
  _id: 't1',
  equipo: 'e1',
  nombre: 'Sprint 10 m',
  unidad: 's',
  mejorEs: 'menor',
  decimales: 2,
  descripcion: '',
  activo: true,
};

const evolucion = (over: Partial<testService.EvolucionJugador>): testService.EvolucionJugador => ({
  jugadorId: 'j1',
  jugador: 'Nahum',
  tipoTestId: 't1',
  tipoTest: 'Sprint 10 m',
  unidad: 's',
  decimales: 2,
  mediciones: [
    { fecha: '2026-01-10', valor: 2.1 },
    { fecha: '2026-03-10', valor: 1.9 },
  ],
  primera: 2.1,
  ultima: 1.9,
  delta: -0.2,
  mejoro: true,
  ...over,
});

const montar = () =>
  render(
    <ToastProvider>
      <SeccionTests equipoId="e1" />
    </ToastProvider>,
  );

beforeEach(() => {
  mockeado.listarTiposTest.mockResolvedValue([TIPO_SPRINT]);
  mockeado.listarResultados.mockResolvedValue([]);
  mockeado.getEvolucion.mockResolvedValue([evolucion({})]);
  mockEntrenamientos.getResumenAsistencia.mockResolvedValue({
    totalEntrenamientos: 3,
    jugadores: [
      {
        jugadorId: 'j1',
        jugador: 'Nahum',
        presente: 3,
        tarde: 0,
        ausente: 0,
        justificado: 0,
        convocado: 0,
        porcentaje: 1,
      },
    ],
  });
});

describe('SeccionTests', () => {
  it('muestra el catálogo con la dirección de mejora de cada test', async () => {
    montar();
    // Acotado al catálogo por su landmark: "Más bajo es mejor" también es una <option> del
    // formulario de alta, y el nombre del test aparece en tres lugares de la pantalla.
    const catalogo = await screen.findByRole('region', { name: 'Catálogo de tests' });
    expect(within(catalogo).getByText('Sprint 10 m')).toBeInTheDocument();
    // Sin esta etiqueta nadie sabe por qué bajar cuenta como mejorar en este test.
    expect(within(catalogo).getAllByText('Más bajo es mejor').length).toBeGreaterThan(0);
  });

  it('en un test de tiempo, bajar se muestra como mejora', async () => {
    montar();
    // El delta es negativo (-0.20) pero es una MEJORA: la flecha va hacia arriba y en verde.
    const celda = await screen.findByText(/▲/);
    expect(celda).toHaveTextContent('-0.20');
    expect(celda.className).toContain('emerald');
  });

  it('un test neutro no se juzga', async () => {
    mockeado.getEvolucion.mockResolvedValue([
      evolucion({ tipoTest: 'Peso', unidad: 'kg', decimales: 1, primera: 72, ultima: 78, delta: 6, mejoro: null }),
    ]);
    montar();
    await screen.findByText('Peso');
    // Ni verde ni roja: el sistema no opina sobre el peso de un jugador.
    expect(screen.queryByText(/▲|▼/)).not.toBeInTheDocument();
  });

  it('ofrece los tests sugeridos que todavía no están en el catálogo', async () => {
    montar();
    // Se espera por el botón sugerido y no por el nombre del test: "Sprint 10 m" aparece en el
    // catálogo, en el <option> del selector y en el título de evolución, así que como ancla
    // es ambiguo.
    expect(await screen.findByRole('button', { name: '+ Salto vertical' })).toBeInTheDocument();
    // Sprint ya está en el catálogo: no debería volver a ofrecerse.
    expect(screen.queryByRole('button', { name: '+ Sprint 10 m' })).not.toBeInTheDocument();
  });

  it('lista el plantel para cargar mediciones', async () => {
    montar();
    // El aria-label del input combina test y jugador, así que identifica una sola celda.
    expect(await screen.findByLabelText('Sprint 10 m de Nahum')).toBeInTheDocument();
  });
});
