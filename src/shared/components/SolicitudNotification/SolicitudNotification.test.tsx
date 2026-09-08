import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolicitudNotification } from './SolicitudNotification';

const mockNavigate = jest.fn();
let mockPendientes = 0;

jest.mock('../../features/solicitudes/hooks/usePendientesDelEquipo', () => ({
  usePendientesDelEquipo: () => mockPendientes,
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const montar = () =>
  render(
    <MemoryRouter>
      <SolicitudNotification />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockPendientes = 0;
  mockNavigate.mockClear();
});

describe('SolicitudNotification', () => {
  /**
   * El bug original: `onClick` era opcional y el Navbar montaba el componente sin pasarla, así
   * que la campanita se apretaba y no pasaba nada. Un botón sin handler se ve idéntico a uno que
   * funciona, por eso hace falta un test que lo mire.
   */
  it('lleva a Notificaciones al tocarla', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Notificaciones/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/notificaciones');
  });

  it('sigue estando cuando no hay pendientes', () => {
    montar();
    // Antes devolvía null en cero. Desde que Notificaciones salió del menú, esconderla dejaba la
    // pantalla sin ninguna puerta de entrada.
    const boton = screen.getByRole('button', { name: /no hay solicitudes pendientes/i });
    expect(boton).toBeInTheDocument();
    fireEvent.click(boton);
    expect(mockNavigate).toHaveBeenCalledWith('/notificaciones');
  });

  it('muestra el conteo cuando hay pendientes', () => {
    mockPendientes = 3;
    montar();
    expect(screen.getByRole('button', { name: /3 solicitudes pendientes/ })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('corta el badge en 99+', () => {
    mockPendientes = 150;
    montar();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
