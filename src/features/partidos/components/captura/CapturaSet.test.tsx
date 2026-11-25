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
  const ganadores: string[] = [];
  const tiempos: unknown[] = [];
  const alineaciones: { id: string; segundo: number }[] = [];
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
    guardarTiempo: async (_ref: unknown, t: EstadoSet['set']['tiempo']) => {
      tiempos.push(t);
      estado = { ...estado, set: { ...estado.set, tiempo: t } };
      return estado;
    },
    guardarVideos: async () => ({ videos: [], videoUrl: '' }),
    alinearEnVivo: async (id: string, segundo: number) => {
      alineaciones.push({ id, segundo });
      estado = { ...estado, relojEnVivo: { ...estado.relojEnVivo!, alineado: true } };
      return estado;
    },
    alinearEnVivoConReloj: async (_set: string, hora: string, segundo: number) => {
      alineaciones.push({ id: hora, segundo });
      estado = { ...estado, relojEnVivo: { ...estado.relojEnVivo!, alineado: true } };
      return estado;
    },
    guardarGanador: async (_ref: unknown, g: string) => {
      ganadores.push(g);
      estado = { ...estado, set: { ...estado.set, ganadorSet: g as 'local' } };
      return estado;
    },
  } as unknown as ApiCaptura;
  return { api, agregados, ganadores, tiempos, alineaciones, fijar: (e: Partial<EstadoSet>) => { estado = { ...estado, ...e }; } };
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

  it('sugiere el ganador de las marcas y lo carga con un clic', async () => {
    const { api, ganadores, fijar } = apiFalsa();
    fijar({ ganadorSugerido: { ganador: 'local', motivo: 'eliminacion', vivos: { local: 2, visitante: 0 }, equipo: 'A' } });
    render(<CapturaSet api={api} refSet={{ planillaSet: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => 1} />);
    expect(await screen.findByText(/dejó al rival sin jugadores/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar ganador a MORAN' }));
    await waitFor(() => expect(ganadores).toEqual(['local']));
    expect(await screen.findByText(/como dicen las marcas/)).toBeInTheDocument();
  });

  it('carga inicio y duración del set sin prompt, y valida el formato', async () => {
    const { api, tiempos } = apiFalsa();
    render(<CapturaSet api={api} refSet={{ planillaSet: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => 1} />);
    await screen.findByText('Set 2');
    fireEvent.click(screen.getByRole('button', { name: 'Editar tiempo' }));
    fireEvent.change(screen.getByLabelText('Empieza (m:ss)'), { target: { value: '3:12' } });
    fireEvent.change(screen.getByLabelText('Dura (m:ss)'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La duración');
    expect(tiempos).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Dura (m:ss)'), { target: { value: '2:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(tiempos).toHaveLength(1));
    expect(tiempos[0]).toMatchObject({ desde: 192, hasta: 342, confirmado: true });
    expect(screen.queryByLabelText('Dura (m:ss)')).not.toBeInTheDocument();
  });

  it('en vivo, el tiempo sale del reloj del partido y no del que pasa la app', async () => {
    const { api, agregados, fijar } = apiFalsa();
    const ahora = Date.now();
    // El reloj arrancó hace 100 s reales; el servidor y el cliente están en hora.
    fijar({ relojEnVivo: { ancla: new Date(ahora - 100000).toISOString(), segundo: 0, alineado: false }, ahoraServidor: ahora });
    render(<CapturaSet api={api} refSet={{ setPartido: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => 5} origen="en_vivo" />);
    await screen.findByText('Set 2');
    fireEvent.click(screen.getByRole('button', { name: 'Dani: out por Línea' }));
    await waitFor(() => expect(agregados).toHaveLength(1));
    expect(agregados[0].t).toBeGreaterThanOrEqual(100);
    expect(agregados[0].t).toBeLessThan(103);
    expect(agregados[0].origen).toBe('en_vivo');
  });

  it('mirando el video, «Es acá» alinea las marcas en vivo con el segundo del video', async () => {
    const { api, alineaciones, fijar } = apiFalsa();
    fijar({
      relojEnVivo: { ancla: new Date().toISOString(), segundo: 0, alineado: false },
      eventos: [{ _id: 'ev1', t: 30, tipo: 'out', jugador: 'b2', equipo: 'B', motivo: 'linea', hora: new Date().toISOString(), origen: 'en_vivo' }],
    });
    render(<CapturaSet api={api} refSet={{ setPartido: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => 42} />);
    expect(await screen.findByText(/todavía no está alineado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Es acá' }));
    await waitFor(() => expect(alineaciones).toEqual([{ id: 'ev1', segundo: 42 }]));
    expect(screen.queryByRole('button', { name: 'Es acá' })).not.toBeInTheDocument();
  });

  it('muestra el minuto de juego de cada marca y alinea con el arranque de un tiempo', async () => {
    const { api, alineaciones, fijar } = apiFalsa();
    const ancla = '2026-11-24T15:30:00.000Z';
    fijar({
      relojEnVivo: { ancla, segundo: 0, alineado: false },
      // 1T arranca en el ancla con 20:00; time out a los 5 min reales, se reanuda a los 7.
      relojJuego: [
        { tipo: 'inicio', periodo: 1, hora: ancla, restante: 1200 },
        { tipo: 'pausa', periodo: 1, hora: '2026-11-24T15:35:00.000Z', restante: 900, motivo: 'time_out', lado: 'local' },
        { tipo: 'reanuda', periodo: 1, hora: '2026-11-24T15:37:00.000Z', restante: 900 },
      ],
      // Out a los 8 min reales (480 s del video sin alinear): van 6 de juego → quedan 14:00.
      eventos: [{ _id: 'ev1', t: 480, tipo: 'out', jugador: 'b2', equipo: 'B', motivo: 'linea', hora: '2026-11-24T15:38:00.000Z', origen: 'en_vivo' }],
    });
    render(<CapturaSet api={api} refSet={{ setPartido: 's1' }} equipos={equipos} jugadores={jugadores} obtenerTiempo={() => 15} />);
    expect(await screen.findByText('1T 14:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Arranque del 1T es acá' }));
    await waitFor(() => expect(alineaciones).toEqual([{ id: ancla, segundo: 15 }]));
  });
});
