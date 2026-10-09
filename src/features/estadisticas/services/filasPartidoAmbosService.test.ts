import { obtenerFilasAmbosEquipos } from './filasPartidoAmbosService';
import { getSetsConEstadisticas } from './estadisticasService';
import type { PartidoTimeline } from './timelineService';

jest.mock('./estadisticasService', () => ({
  getSetsConEstadisticas: jest.fn(),
}));

jest.mock('../../partidos/services/planillaEquipoService', () => ({
  obtenerPlanilla: jest.fn(),
}));

const mockGetSets = getSetsConEstadisticas as jest.Mock;

const PANTHERS_ID = 'panthers-id';
const RIVAL_ID = 'rival-id';

/**
 * Un partido scouteado: ninguno de los dos equipos que jugaron es el club propio. Se mira «a
 * través» de PANTHERS (`perspectiva`), así que `esLocal`/`rival` ya vienen resueltos desde ese
 * equipo — nunca desde el club que tiene la sesión abierta.
 */
const partidoScouteado = (): PartidoTimeline =>
  ({
    _id: 'partido-1',
    fecha: '2026-07-26T15:00:00.000Z',
    estado: 'finalizado',
    modalidad: 'Cloth',
    categoria: 'Masculino',
    ubicacion: null,
    jornada: null,
    etapa: null,
    nombrePartido: null,
    esLocal: true,
    marcadorEquipo: 26,
    marcadorRival: 12,
    rival: { _id: RIVAL_ID, nombre: 'HYDRA', escudo: null },
    competencia: null,
    temporada: null,
    fase: null,
    datos: {
      oficial: { existe: true, porSets: true, directa: false, verificada: true },
      planilla: null,
      fuenteEfectiva: 'oficial',
    },
  } as unknown as PartidoTimeline);

describe('obtenerFilasAmbosEquipos', () => {
  beforeEach(() => {
    mockGetSets.mockReset();
  });

  it('nombra al equipo de la perspectiva por su nombre, no "Otro equipo" — el bug de un scouteo', async () => {
    mockGetSets.mockResolvedValue([
      {
        _id: 'set-1',
        numeroSet: 1,
        ganadorSet: 'local',
        estadisticas: [
          {
            _id: 'e1',
            jugador: { _id: 'j-panthers', nombre: 'Juan', apellido: 'Panther' },
            equipo: { _id: PANTHERS_ID, nombre: 'PANTHERS' },
            throws: 3,
            hits: 1,
            outs: 0,
            catches: 0,
            survive: true,
          },
          {
            _id: 'e2',
            jugador: { _id: 'j-hydra', nombre: 'Pedro', apellido: 'Hydra' },
            equipo: { _id: RIVAL_ID, nombre: 'HYDRA' },
            throws: 2,
            hits: 0,
            outs: 1,
            catches: 0,
            survive: false,
          },
        ],
      },
    ]);

    const filas = await obtenerFilasAmbosEquipos(partidoScouteado(), PANTHERS_ID, 'PANTHERS');

    const filaPropia = filas.find((f) => f.jugadorId === 'j-panthers');
    const filaRival = filas.find((f) => f.jugadorId === 'j-hydra');

    expect(filaPropia?.equipo).toBe('PANTHERS');
    expect(filaRival?.equipo).toBe('HYDRA');
    expect(filas.some((f) => f.equipo === 'Otro equipo')).toBe(false);
  });
});
