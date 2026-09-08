import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileTabBar from './MobileTabBar';

const mockLogout = jest.fn();
const mockNavigate = jest.fn();
let mockAutenticado = true;
let mockPendientes = 0;

jest.mock('../providers/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockAutenticado, logout: mockLogout }),
}));

jest.mock('../../shared/features/solicitudes/hooks/usePendientesDelEquipo', () => ({
  usePendientesDelEquipo: () => mockPendientes,
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const montar = (ruta = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <MobileTabBar />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockAutenticado = true;
  mockPendientes = 0;
  mockLogout.mockClear();
  mockNavigate.mockClear();
});

describe('MobileTabBar', () => {
  it('muestra los cuatro destinos del día a día y el botón Más', () => {
    montar();
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });

    expect(within(nav).getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/dashboard');
    expect(within(nav).getByRole('link', { name: /Partidos/ })).toHaveAttribute('href', '/partidos');
    expect(within(nav).getByRole('link', { name: /Equipo/ })).toHaveAttribute('href', '/equipo');
    expect(within(nav).getByRole('link', { name: /Stats/ })).toHaveAttribute('href', '/estadisticas');
    expect(within(nav).getByRole('button', { name: /Más/ })).toBeInTheDocument();
  });

  it('marca la sección activa según la ruta', () => {
    montar('/estadisticas');
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    // `NavLink` marca la activa con aria-current, que es lo que anuncia un lector de pantalla.
    expect(within(nav).getByRole('link', { name: /Stats/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Inicio/ })).not.toHaveAttribute('aria-current');
  });

  it('el panel Más abre el resto de las secciones y cierra al elegir una', () => {
    montar();
    const mas = screen.getByRole('button', { name: /Más/ });

    expect(screen.queryByRole('link', { name: /Entrenamientos/ })).not.toBeInTheDocument();

    fireEvent.click(mas);
    expect(mas).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Competencias/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Entrenamientos/ }));
    expect(mas).toHaveAttribute('aria-expanded', 'false');
  });

  it('avisa de pendientes sin obligar a abrir el panel', () => {
    mockPendientes = 3;
    montar();

    // Un punto en la pestaña: notificaciones vive adentro del panel, así que sin esto un
    // pendiente nuevo no se vería hasta abrirlo.
    expect(screen.getByLabelText('3 solicitudes pendientes')).toBeInTheDocument();

    // El conteo exacto está adentro, al lado de la sección.
    fireEvent.click(screen.getByRole('button', { name: /Más/ }));
    expect(screen.getByRole('link', { name: /Notificaciones 3/ })).toBeInTheDocument();
  });

  it('cerrar sesión desde el panel desloguea y manda al login', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Más/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('sin sesión no se dibuja', () => {
    mockAutenticado = false;
    montar();
    expect(screen.queryByRole('navigation', { name: /navegación principal/i })).not.toBeInTheDocument();
  });
});
