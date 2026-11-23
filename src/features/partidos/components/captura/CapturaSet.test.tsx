import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CapturaSet, type ApiCaptura, type EstadoSet, type NuevoEvento } from 'overtime-kit/captura';

// API falsa en memoria: misma forma que /api/eventos-set.
function apiFalsa() {
  let estado: EstadoSet = {
    set: { _id: 's1', numeroSet: 2, tiempo: { desde: 0, hasta: 100 } },
    alineacion: [
      { jugador: 'a1', equipo: 'A' }, { jugador: 'a2', equipo: 'A' },
      { jugador: 'b1', equipo: 'B' }, { jugador: 'b2', equipo: 'B' },
    ],
    alineacionCargada: true,
    eventos: [],
  };
  let n = 0;
  const agregados: NuevoEvento[] = [];
  const api = {
    leer: async () => estado,
    agregarEvento: async (_ref: unknown, e: NuevoEvento) => {
      agregados.push(e);
      estado = { ...estado, eventos: [...estado.eventos, { ...e, _id: `e${++n}` }] };
      return estado;
    },
    borrarEvento: async (id: string) => {
      estado = { ...estado, eventos: estado.eventos.filter((e) => e._id !== id) };
      return estado;
    },
    guardarAlineacion: async () => estado,
    guardarTiempo: async () => estado,
    guardarVideos: async () => ({ videos: [], videoUrl: '' }),
  } as unknown as ApiCaptura;
  return { api, agregados };
}

const equipos = [{ id: 'A', nombre: 'MORAN' }, { id: 'B', nombre: 'MARVIN' }];
const jugadores = [
  { id: 'a1', nombre: 'Ana', equipo: 'A', numero: 4 }, { id: 'a2', nombre: 'Beto', equipo: 'A' },
  { id: 'b1', nombre: 'Caro', equipo: 'B' }, { id: 'b2', nombre: 'Dani', equipo: 'B' },
];

describe('CapturaSet', () => {
  it('marca un out por hit eligiendo quién tiró, y el jugador queda afuera', async () => {
    const { api, agregados } = apiFalsa();
    let t = 12;
    render(<CapturaSet api={api} refSet={{ planillaSet: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => t} />);

    await screen.findByText('Set 2');
    fireEvent.click(screen.getByRole('button', { name: '#4 Ana: out por Hit' }));
    expect(await screen.findByText('¿Quién tiró?')).toBeInTheDocument();
    t = 20; // el tiempo del out es el del clic, no el de la confirmación
    fireEvent.click(screen.getByRole('button', { name: 'Caro' }));

    await waitFor(() => expect(agregados).toHaveLength(1));
    expect(agregados[0]).toMatchObject({ t: 12, tipo: 'out', jugador: 'a1', equipo: 'A', motivo: 'hit', por: 'b1' });
    expect(await screen.findByRole('button', { name: 'Vuelve' })).toBeInTheDocument();
  });

  it('un out por línea no pregunta quién lo sacó', async () => {
    const { api, agregados } = apiFalsa();
    render(<CapturaSet api={api} refSet={{ planillaSet: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => 30} />);
    await screen.findByText('Set 2');
    fireEvent.click(screen.getByRole('button', { name: 'Dani: out por Línea' }));
    await waitFor(() => expect(agregados).toHaveLength(1));
    expect(agregados[0]).toMatchObject({ jugador: 'b2', motivo: 'linea' });
    expect(screen.queryByText('¿Quién atajó?')).not.toBeInTheDocument();
  });

  it('en solo lectura no muestra botones de marcar', async () => {
    const { api } = apiFalsa();
    render(<CapturaSet api={api} refSet={{ planillaSet: 's1' }} equipos={equipos} jugadores={jugadores} soloLectura />);
    await screen.findByText('Set 2');
    expect(screen.queryByRole('button', { name: /out por/ })).not.toBeInTheDocument();
  });
});
